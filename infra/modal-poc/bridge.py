"""
JSON-line bridge between Next.js and Modal rami-qwen-poc.

Protocol (stdin one JSON object, stdout one JSON object — or NDJSON for stream):
  {"op":"start"}
  {"op":"stop"}
  {"op":"status"}
  {"op":"health"}
  {"op":"chat","messages":[...],"temperature":0.7,"format":null}
  {"op":"chat_stream","messages":[...],"temperature":0.65}

Never prints token secrets. Never logs prompt bodies to files.
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

APP_NAME = "rami-qwen-poc"
CLS_NAME = "QwenInfer"
MODEL_TAG = "qwen3:8b"
GPU_TYPE = "T4"
WARM_SCALEDOWN_SEC = 900
STOP_SCALEDOWN_SEC = 45


def _utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _infer():
    import modal

    return modal.Cls.from_name(APP_NAME, CLS_NAME)()


def _stats(inst) -> dict[str, Any]:
    out: dict[str, Any] = {"remote_stats_available": False}
    try:
        st = inst.health.get_current_stats()
        out["remote_stats_available"] = True
        out["num_total_runners"] = getattr(st, "num_total_runners", None)
        out["num_running_inputs"] = getattr(st, "num_running_inputs", None)
        out["backlog"] = getattr(st, "backlog", None)
        out["remote_stats_repr"] = repr(st)
    except Exception as e:
        out["remote_stats_error"] = f"{type(e).__name__}: {e}"
    return out


def op_start(_: dict[str, Any]) -> dict[str, Any]:
    inst = _infer()
    t0 = time.time()
    inst.update_autoscaler(
        min_containers=1,
        max_containers=1,
        scaledown_window=WARM_SCALEDOWN_SEC,
    )
    health = inst.health.remote()
    wall = time.time() - t0
    if not health.get("ok"):
        inst.update_autoscaler(
            min_containers=0,
            max_containers=1,
            scaledown_window=STOP_SCALEDOWN_SEC,
        )
        return {
            "ok": False,
            "state": "ERROR",
            "error": "health_failed",
            "health": health,
            "cold_start_seconds": wall,
            "at": _utc(),
        }
    return {
        "ok": True,
        "state": "READY",
        "health": health,
        "cold_start_seconds": wall,
        "model": MODEL_TAG,
        "gpu": GPU_TYPE,
        "warm_scaledown_sec": WARM_SCALEDOWN_SEC,
        "remote": _stats(inst),
        "at": _utc(),
    }


def op_stop(_: dict[str, Any]) -> dict[str, Any]:
    inst = _infer()
    settings = inst.update_autoscaler(
        min_containers=0,
        max_containers=1,
        scaledown_window=STOP_SCALEDOWN_SEC,
    )
    return {
        "ok": True,
        "state": "OFF",
        "settings": str(settings),
        "remote": _stats(inst),
        "at": _utc(),
    }


def op_status(_: dict[str, Any]) -> dict[str, Any]:
    inst = _infer()
    remote = _stats(inst)
    return {
        "ok": True,
        "model": MODEL_TAG,
        "gpu": GPU_TYPE,
        "remote": remote,
        "at": _utc(),
    }


def op_health(_: dict[str, Any]) -> dict[str, Any]:
    inst = _infer()
    health = inst.health.remote()
    return {"ok": bool(health.get("ok")), "health": health, "remote": _stats(inst), "at": _utc()}


def op_chat(req: dict[str, Any]) -> dict[str, Any]:
    inst = _infer()
    messages = req.get("messages") or []
    temperature = float(req.get("temperature", 0.7))
    format_schema = req.get("format")
    num_predict = req.get("num_predict")
    t0 = time.time()
    result = inst.chat.remote(
        messages,
        temperature=temperature,
        format_schema=format_schema,
        num_predict=num_predict,
    )
    result["client_wall_seconds"] = time.time() - t0
    result["at"] = _utc()
    return result


def op_chat_stream(req: dict[str, Any]) -> None:
    """Write NDJSON events to stdout."""
    inst = _infer()
    messages = req.get("messages") or []
    temperature = float(req.get("temperature", 0.7))
    try:
        for event in inst.chat_stream.remote_gen(messages, temperature=temperature):
            sys.stdout.write(json.dumps(event, ensure_ascii=False) + "\n")
            sys.stdout.flush()
    except Exception as e:
        sys.stdout.write(
            json.dumps({"type": "error", "message": f"{type(e).__name__}: {e}"}) + "\n"
        )
        sys.stdout.flush()


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        sys.stdout.write(json.dumps({"ok": False, "error": "empty_stdin"}) + "\n")
        return 1
    req = json.loads(raw)
    op = req.get("op")
    try:
        if op == "chat_stream":
            op_chat_stream(req)
            return 0
        handlers = {
            "start": op_start,
            "stop": op_stop,
            "status": op_status,
            "health": op_health,
            "chat": op_chat,
        }
        if op not in handlers:
            sys.stdout.write(json.dumps({"ok": False, "error": f"unknown_op:{op}"}) + "\n")
            return 1
        out = handlers[op](req)
        sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
        return 0 if out.get("ok", True) else 2
    except Exception as e:
        sys.stdout.write(
            json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}", "at": _utc()}) + "\n"
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
