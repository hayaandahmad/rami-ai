"""
Local developer control plane for the rami-qwen-poc Modal app.

Commands:
  python control.py auth-check
  python control.py ensure-model   # CPU-only volume populate (preferred before GPU)
  python control.py deploy
  python control.py start          # min_containers=1 + real health warm-up → READY
  python control.py status
  python control.py test [prompt]  # warm smoke (requires READY or cold invoke)
  python control.py stop           # min_containers=0 + short scaledown
  python control.py local-compare  # same prompts on local Ollama vs Modal warm
  python control.py usage

Never prints token secrets. Never uploads RFP/Excel/.env data.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
STATE_PATH = ROOT / ".session-state.json"
USAGE_DIR = ROOT / ".usage"
USAGE_DIR.mkdir(exist_ok=True)
USAGE_PATH = USAGE_DIR / "poc-usage.json"

APP_NAME = "rami-qwen-poc"
CLS_NAME = "QwenInfer"
MODEL_TAG = "qwen3:8b"
GPU_TYPE = "T4"
T4_USD_PER_SEC = 0.000164  # modal.com/pricing
POC_IDLE_SEC = 120
SESSION_SCALEDOWN_SEC = 120
STOP_SCALEDOWN_SEC = 30
MAX_SESSION_SEC = 600  # hard PoC cap (10 min) — not the future 2–3h product default

LOCAL_OLLAMA = os.environ.get("RAMI_OLLAMA_BASE_URL", "http://localhost:11434")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _usage() -> dict[str, Any]:
    return _load_json(
        USAGE_PATH,
        {
            "t4_usd_per_sec": T4_USD_PER_SEC,
            "t4_usd_per_hour_estimate": T4_USD_PER_SEC * 3600,
            "sessions": [],
            "inferences": [],
            "total_gpu_seconds_estimate": 0.0,
            "estimated_cost_usd": 0.0,
            "note": "ESTIMATED local tracker — Modal billing is source of truth",
        },
    )


def _save_usage(u: dict[str, Any]) -> None:
    u["estimated_cost_usd"] = round(
        float(u.get("total_gpu_seconds_estimate", 0.0)) * T4_USD_PER_SEC, 6
    )
    u["updated_at"] = _utc_now()
    _save_usage_write(u)


def _save_usage_write(u: dict[str, Any]) -> None:
    _save_json(USAGE_PATH, u)


def _state() -> dict[str, Any]:
    return _load_json(
        STATE_PATH,
        {
            "local_state": "OFF",
            "remote_min_containers": None,
            "session_started_at": None,
            "last_inference_at": None,
            "last_error": None,
            "model": MODEL_TAG,
            "gpu": GPU_TYPE,
        },
    )


def _save_state(s: dict[str, Any]) -> None:
    s["updated_at"] = _utc_now()
    _save_json(STATE_PATH, s)


def _get_infer():
    import modal

    return modal.Cls.from_name(APP_NAME, CLS_NAME)


def _get_generate_fn():
    """Bound method accessors after deploy."""
    Infer = _get_infer()
    return Infer()


def cmd_auth_check(_: argparse.Namespace) -> int:
    import modal

    print(f"modal_sdk={getattr(modal, '__version__', 'unknown')}")
    cfg_path = Path.home() / ".modal.toml"
    print(f"auth_file_exists={cfg_path.exists()}")
    if not cfg_path.exists():
        print("NOT AUTHENTICATED — run: .\\.venv-modal\\Scripts\\python.exe -m modal setup")
        return 1
    # Avoid printing secrets
    try:
        import tomllib

        data = tomllib.loads(cfg_path.read_text(encoding="utf-8"))
        profiles = list(data.keys())
        print(f"profiles={profiles}")
        for name, cfg in data.items():
            if isinstance(cfg, dict):
                print(
                    f"profile={name} has_token_id={'token_id' in cfg} "
                    f"has_token_secret={'token_secret' in cfg} "
                    f"workspace={cfg.get('workspace') or cfg.get('active') or 'unknown'}"
                )
    except Exception as e:
        print(f"profile_parse_warning={e}")
    # Lightweight authenticated call
    try:
        from modal.client import Client

        Client.from_env()
        print("client_from_env=ok")
    except Exception as e:
        print(f"client_from_env_error={type(e).__name__}: {e}")
        return 1
    print("AUTH_OK")
    return 0


def cmd_ensure_model(_: argparse.Namespace) -> int:
    """CPU-only model cache populate — run BEFORE first GPU start when possible."""
    print("Ensuring qwen3:8b on Modal Volume (CPU — no T4 billing for download)...")
    import modal

    ensure = modal.Function.from_name(APP_NAME, "ensure_model_cached")
    # If not deployed yet, run ephemerally via local entry of app module
    try:
        result = ensure.remote()
    except Exception as e:
        print(f"from_name failed ({e}); running ensure via app lookup after deploy required.")
        print("Deploy first: python control.py deploy")
        return 1
    print(json.dumps(result, indent=2))
    return 0


def cmd_deploy(_: argparse.Namespace) -> int:
    print("Deploying rami-qwen-poc (min_containers=0, max=1, gpu=T4)...")
    # Use modal CLI deploy
    import subprocess

    py = sys.executable
    app_path = ROOT / "app.py"
    proc = subprocess.run(
        [py, "-m", "modal", "deploy", str(app_path)],
        cwd=str(ROOT),
    )
    return proc.returncode


def _autoscaler_update(*, min_containers: int, scaledown_window: int) -> dict[str, Any]:
    """Modal 1.5: call update_autoscaler on the Cls *instance* (Obj), not the Cls type."""
    Infer = _get_infer()
    inst = Infer()
    settings = inst.update_autoscaler(
        min_containers=min_containers,
        max_containers=1,
        scaledown_window=scaledown_window,
    )
    return {
        "via": "Cls().update_autoscaler",
        "min_containers": min_containers,
        "scaledown_window": scaledown_window,
        "settings": str(settings),
    }


def _get_stats() -> dict[str, Any]:
    """REMOTE FACT where possible."""
    Infer = _get_infer()
    out: dict[str, Any] = {"remote_stats_available": False}
    try:
        # Function stats via health method handle
        handle = Infer().health
        if hasattr(handle, "get_current_stats"):
            stats = handle.get_current_stats()
            out["remote_stats_available"] = True
            out["remote_stats"] = {
                "backslash": str(stats),
                "repr": repr(stats),
            }
            for attr in (
                "num_total_runners",
                "backlog",
                "num_running_tasks",
                "num_running_inputs",
            ):
                if hasattr(stats, attr):
                    out[attr] = getattr(stats, attr)
        elif hasattr(Infer, "get_current_stats"):
            stats = Infer.get_current_stats()
            out["remote_stats_available"] = True
            out["remote_stats_repr"] = repr(stats)
    except Exception as e:
        out["remote_stats_error"] = f"{type(e).__name__}: {e}"
    return out


def cmd_start(_: argparse.Namespace) -> int:
    s = _state()
    if s.get("local_state") == "READY":
        # Check idle / max session
        print("LOCAL TRACKED STATE already READY — running health re-check")
    print("LOCAL TRACKED STATE → STARTING_GPU")
    s["local_state"] = "STARTING"
    s["last_error"] = None
    _save_state(s)

    t_start = time.time()
    try:
        print("Setting autoscaler min_containers=1 (keep one T4 warm)...")
        auto = _autoscaler_update(
            min_containers=1, scaledown_window=SESSION_SCALEDOWN_SEC
        )
        print(f"autoscaler={auto}")
        s["local_state"] = "LOADING_MODEL"
        s["remote_min_containers"] = 1
        _save_state(s)

        print("WARMING_UP — real health inference (READY requires success)...")
        s["local_state"] = "WARMING_UP"
        _save_state(s)

        infer = _get_generate_fn()
        health = infer.health.remote()
        print(json.dumps(health, indent=2))
        if not health.get("ok"):
            s["local_state"] = "ERROR"
            s["last_error"] = "health returned ok=false"
            _save_state(s)
            print("STOPPING warm pool after failed health to protect credits...")
            _autoscaler_update(min_containers=0, scaledown_window=STOP_SCALEDOWN_SEC)
            return 1

        wall = time.time() - t_start
        s["local_state"] = "READY"
        s["session_started_at"] = _utc_now()
        s["last_inference_at"] = _utc_now()
        s["last_cold_start_seconds"] = wall
        s["last_health"] = health
        _save_state(s)

        u = _usage()
        u["sessions"].append(
            {
                "started_at": s["session_started_at"],
                "cold_start_seconds": wall,
                "gpu": GPU_TYPE,
                "model": MODEL_TAG,
            }
        )
        # Approximate: from start until now counted as GPU time for cold path
        u["total_gpu_seconds_estimate"] = float(u.get("total_gpu_seconds_estimate", 0)) + wall
        u["inferences"].append(
            {
                "kind": "health_warmup",
                "at": _utc_now(),
                "seconds": health.get("health_inference_seconds"),
                "cold_wall_seconds": wall,
            }
        )
        _save_usage(u)

        print(f"READY in {wall:.1f}s (LOCAL TRACKED). GPU kept warm via min_containers=1.")
        print(f"PoC idle auto-stop target: {POC_IDLE_SEC}s without inference.")
        print(f"PoC max session: {MAX_SESSION_SEC}s.")
        return 0
    except Exception as e:
        s["local_state"] = "ERROR"
        s["last_error"] = f"{type(e).__name__}: {e}"
        _save_state(s)
        print(f"START FAILED: {e}")
        try:
            _autoscaler_update(min_containers=0, scaledown_window=STOP_SCALEDOWN_SEC)
        except Exception as e2:
            print(f"emergency stop also failed: {e2}")
        return 1


def _maybe_auto_stop(s: dict[str, Any]) -> dict[str, Any]:
    """Local + remote safety: idle / max session."""
    if s.get("local_state") != "READY":
        return s
    now = time.time()
    last = s.get("last_inference_at")
    started = s.get("session_started_at")
    if last:
        idle = now - datetime.fromisoformat(last).timestamp()
        if idle >= POC_IDLE_SEC:
            print(f"AUTO-STOP: idle {idle:.0f}s >= {POC_IDLE_SEC}s")
            cmd_stop(argparse.Namespace())
            return _state()
    if started:
        dur = now - datetime.fromisoformat(started).timestamp()
        if dur >= MAX_SESSION_SEC:
            print(f"AUTO-STOP: session {dur:.0f}s >= max {MAX_SESSION_SEC}s")
            cmd_stop(argparse.Namespace())
            return _state()
    return s


def cmd_status(_: argparse.Namespace) -> int:
    s = _maybe_auto_stop(_state())
    remote = {}
    try:
        remote = _get_stats()
    except Exception as e:
        remote = {"error": f"{type(e).__name__}: {e}"}

    idle = None
    session_dur = None
    if s.get("last_inference_at"):
        idle = time.time() - datetime.fromisoformat(s["last_inference_at"]).timestamp()
    if s.get("session_started_at"):
        session_dur = time.time() - datetime.fromisoformat(s["session_started_at"]).timestamp()

    report = {
        "LOCAL_TRACKED_STATE": s.get("local_state"),
        "model": MODEL_TAG,
        "gpu": GPU_TYPE,
        "session_started_at": s.get("session_started_at"),
        "session_duration_sec": session_dur,
        "last_inference_at": s.get("last_inference_at"),
        "idle_sec": idle,
        "remote_min_containers_tracked": s.get("remote_min_containers"),
        "last_error": s.get("last_error"),
        "REMOTE_FACT": remote,
        "estimated_usage": {
            "gpu_seconds": _usage().get("total_gpu_seconds_estimate"),
            "estimated_cost_usd": _usage().get("estimated_cost_usd"),
            "label": "ESTIMATED",
        },
        "safety": {
            "poc_idle_sec": POC_IDLE_SEC,
            "max_session_sec": MAX_SESSION_SEC,
            "static_max_containers": 1,
        },
    }
    print(json.dumps(report, indent=2))
    return 0


def cmd_test(args: argparse.Namespace) -> int:
    s = _state()
    prompt = args.prompt or "Say hello in one short sentence."
    print(f"TEST prompt={prompt!r}")
    if s.get("local_state") != "READY":
        print("WARNING: local state is not READY — this may cold-start a T4 (billable).")
        print("ABOUT TO START BILLABLE T4 INFERENCE (possible cold start)")

    t0 = time.time()
    infer = _get_generate_fn()
    result = infer.generate.remote(prompt, temperature=0.2, num_predict=48)
    wall = time.time() - t0
    result["client_wall_seconds"] = wall
    print(json.dumps(result, indent=2))

    s = _state()
    s["last_inference_at"] = _utc_now()
    if s.get("local_state") not in ("READY", "STARTING", "WARMING_UP"):
        # opportunistic
        pass
    _save_state(s)

    u = _usage()
    u["inferences"].append(
        {
            "kind": "test",
            "at": _utc_now(),
            "client_wall_seconds": wall,
            "server_wall_seconds": result.get("wall_seconds"),
            "eval_count": result.get("eval_count"),
            "tokens_per_sec": result.get("tokens_per_sec"),
        }
    )
    u["total_gpu_seconds_estimate"] = float(u.get("total_gpu_seconds_estimate", 0)) + wall
    _save_usage(u)
    return 0 if result.get("ok") else 1


def cmd_stop(_: argparse.Namespace) -> int:
    print("LOCAL TRACKED STATE → SHUTTING_DOWN")
    s = _state()
    s["local_state"] = "SHUTTING_DOWN"
    _save_state(s)
    started = s.get("session_started_at")
    session_sec = 0.0
    if started:
        session_sec = max(0.0, time.time() - datetime.fromisoformat(started).timestamp())

    try:
        auto = _autoscaler_update(min_containers=0, scaledown_window=STOP_SCALEDOWN_SEC)
        print(f"autoscaler={auto}")
    except Exception as e:
        print(f"autoscaler stop error: {e}")
        s["last_error"] = f"stop: {e}"
        s["local_state"] = "ERROR"
        _save_state(s)
        return 1

    s["local_state"] = "OFF"
    s["remote_min_containers"] = 0
    s["session_stopped_at"] = _utc_now()
    s["last_session_duration_sec"] = session_sec
    _save_state(s)

    u = _usage()
    # Prefer tracking intentional warm-session duration
    u["total_gpu_seconds_estimate"] = float(u.get("total_gpu_seconds_estimate", 0)) + session_sec
    u["sessions_stopped"] = u.get("sessions_stopped", [])
    u["sessions_stopped"].append(
        {"stopped_at": s["session_stopped_at"], "duration_sec": session_sec}
    )
    _save_usage(u)

    print("STOP requested: min_containers=0, scaledown_window=30s")
    print("GPU should release after idle scaledown. Modal billing is source of truth.")
    print(
        f"ESTIMATED PoC usage so far: ${_usage().get('estimated_cost_usd')} "
        f"(~{_usage().get('total_gpu_seconds_estimate')} GPU-sec @ ${T4_USD_PER_SEC}/s)"
    )
    return 0


def _local_ollama_chat(prompt: str) -> dict[str, Any]:
    body = json.dumps(
        {
            "model": MODEL_TAG,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "options": {"temperature": 0.2, "num_predict": 48},
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{LOCAL_OLLAMA}/api/chat",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"ok": False, "error": str(e), "wall_seconds": time.time() - t0}
    text = (data.get("message") or {}).get("content", "")
    if "</think>" in text:
        text = text.split("</think>", 1)[-1].strip()
    wall = time.time() - t0
    eval_count = data.get("eval_count") or 0
    eval_duration_ns = data.get("eval_duration") or 0
    tps = eval_count / (eval_duration_ns / 1e9) if eval_count and eval_duration_ns else None
    return {
        "ok": True,
        "output": text,
        "wall_seconds": wall,
        "eval_count": eval_count,
        "tokens_per_sec": tps,
        "model": data.get("model"),
    }


def cmd_local_compare(_: argparse.Namespace) -> int:
    prompts = [
        "Say hello in one short sentence.",
        "What is 2+2? Reply with one number.",
        "Name one color. One word only.",
    ]
    rows = []
    s = _state()
    if s.get("local_state") != "READY":
        print("ERROR: Modal must be READY for warm compare. Run: python control.py start")
        return 1

    infer = _get_generate_fn()
    for p in prompts:
        print(f"\n=== PROMPT: {p} ===")
        local = _local_ollama_chat(p)
        print("LOCAL:", json.dumps({k: local.get(k) for k in ('ok', 'wall_seconds', 'tokens_per_sec', 'output')}, indent=2))
        t0 = time.time()
        remote = infer.generate.remote(p, temperature=0.2, num_predict=48)
        remote["client_wall_seconds"] = time.time() - t0
        print("MODAL:", json.dumps({k: remote.get(k) for k in ('ok', 'wall_seconds', 'client_wall_seconds', 'tokens_per_sec', 'output')}, indent=2))
        rows.append({"prompt": p, "local": local, "modal": remote})
        s = _state()
        s["last_inference_at"] = _utc_now()
        _save_state(s)
        u = _usage()
        u["inferences"].append({"kind": "compare_modal", "at": _utc_now(), "seconds": remote.get("client_wall_seconds")})
        u["total_gpu_seconds_estimate"] = float(u.get("total_gpu_seconds_estimate", 0)) + float(
            remote.get("client_wall_seconds") or 0
        )
        _save_usage(u)

    out_path = USAGE_DIR / f"compare-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    _save_json(out_path, {"rows": rows, "model": MODEL_TAG, "gpu": GPU_TYPE})
    print(f"\nWrote {out_path}")
    return 0


def cmd_usage(_: argparse.Namespace) -> int:
    u = _usage()
    print(json.dumps(u, indent=2))
    print(
        f"\nESTIMATED PoC usage: ${u.get('estimated_cost_usd')} "
        f"| ESTIMATED T4 runtime: {float(u.get('total_gpu_seconds_estimate') or 0):.1f}s "
        f"| rate ${T4_USD_PER_SEC}/s (official Modal T4)"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Rami Modal PoC controls")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("auth-check")
    sub.add_parser("deploy")
    sub.add_parser("ensure-model")
    sub.add_parser("start")
    sub.add_parser("status")
    p_test = sub.add_parser("test")
    p_test.add_argument("prompt", nargs="?", default=None)
    sub.add_parser("stop")
    sub.add_parser("local-compare")
    sub.add_parser("usage")

    args = parser.parse_args()
    cmds = {
        "auth-check": cmd_auth_check,
        "deploy": cmd_deploy,
        "ensure-model": cmd_ensure_model,
        "start": cmd_start,
        "status": cmd_status,
        "test": cmd_test,
        "stop": cmd_stop,
        "local-compare": cmd_local_compare,
        "usage": cmd_usage,
    }
    return cmds[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main())
