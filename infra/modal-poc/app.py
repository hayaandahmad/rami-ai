"""
Rami Modal inference app — thin Qwen3-8B on NVIDIA T4 (Ollama).

Reuses PoC app name/volume so cached weights stay warm across deploys.
No Rami business logic here — messages in, tokens out.
"""

from __future__ import annotations

import json
import subprocess
import time
from typing import Any, Iterator

import modal

APP_NAME = "rami-qwen-poc"
MODEL_TAG = "qwen3:8b"
GPU_TYPE = "T4"
T4_USD_PER_SEC = 0.000164

# Static defaults: scale to zero. Warm sessions raise min_containers via control plane.
DEFAULT_SCALEDOWN_SEC = 60
# Modal-side orphan safety while intentionally warm (matches ~15 min idle)
WARM_SCALEDOWN_SEC = 900

app = modal.App(APP_NAME)

ollama_vol = modal.Volume.from_name("rami-qwen-poc-ollama", create_if_missing=True)

ollama_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("curl", "ca-certificates", "pciutils", "zstd")
    .run_commands("curl -fsSL https://ollama.com/install.sh | sh")
    .pip_install("httpx==0.28.1")
    .env({"OLLAMA_HOST": "127.0.0.1:11434"})
)


def _start_ollama_daemon() -> None:
    subprocess.Popen(
        ["ollama", "serve"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + 60
    import httpx

    while time.time() < deadline:
        try:
            r = httpx.get("http://127.0.0.1:11434/api/tags", timeout=2.0)
            if r.status_code == 200:
                return
        except Exception:
            time.sleep(0.5)
    raise RuntimeError("ollama serve failed to become ready within 60s")


def _model_installed(tag: str) -> bool:
    import httpx

    data = httpx.get("http://127.0.0.1:11434/api/tags", timeout=30.0).json()
    names = {m.get("name") for m in data.get("models", [])}
    if tag in names or f"{tag}:latest" in names:
        return True
    return any(tag.split(":")[0] in (n or "") for n in names)


def _ensure_model(tag: str) -> dict[str, Any]:
    t0 = time.time()
    if _model_installed(tag):
        return {"pulled": False, "seconds": time.time() - t0, "tag": tag}
    proc = subprocess.run(
        ["ollama", "pull", tag],
        capture_output=True,
        text=True,
        timeout=3600,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"ollama pull failed: {proc.stderr[-500:]}")
    ollama_vol.commit()
    return {"pulled": True, "seconds": time.time() - t0, "tag": tag}


def _strip_think(text: str) -> str:
    if not text:
        return ""
    if "</think>" in text:
        return text.split("</think>", 1)[-1].strip()
    return text


@app.function(
    image=ollama_image,
    volumes={"/root/.ollama": ollama_vol},
    timeout=3600,
    memory=8192,
    cpu=2,
)
def ensure_model_cached() -> dict[str, Any]:
    _start_ollama_daemon()
    result = _ensure_model(MODEL_TAG)
    import httpx

    tags = httpx.get("http://127.0.0.1:11434/api/tags", timeout=30.0).json()
    match = next(
        (m for m in tags.get("models", []) if MODEL_TAG in m.get("name", "")),
        None,
    )
    result["model_list_entry"] = match
    result["volume"] = "rami-qwen-poc-ollama"
    return result


@app.cls(
    image=ollama_image,
    gpu=GPU_TYPE,
    volumes={"/root/.ollama": ollama_vol},
    timeout=600,
    memory=8192,
    min_containers=0,
    max_containers=1,
    scaledown_window=DEFAULT_SCALEDOWN_SEC,
)
class QwenInfer:
    @modal.enter()
    def load(self) -> None:
        self._enter_t0 = time.time()
        _start_ollama_daemon()
        self._model_ensure = _ensure_model(MODEL_TAG)
        self._load_seconds = time.time() - self._enter_t0
        import httpx

        httpx.get("http://127.0.0.1:11434/api/tags", timeout=30.0)

    @modal.method()
    def health(self) -> dict[str, Any]:
        import httpx

        t0 = time.time()
        payload = {
            "model": MODEL_TAG,
            "messages": [
                {"role": "user", "content": "/no_think\nReply with exactly the two letters: OK"},
            ],
            "stream": False,
            "think": False,
            "options": {"temperature": 0, "num_predict": 16},
        }
        r = httpx.post("http://127.0.0.1:11434/api/chat", json=payload, timeout=180.0)
        r.raise_for_status()
        data = r.json()
        text = _strip_think((data.get("message") or {}).get("content", "") or "")
        eval_count = data.get("eval_count") or 0
        ok = ("OK" in text.upper()) or (len(text.strip()) > 0) or (eval_count > 0)
        return {
            "ok": bool(ok),
            "output_preview": text[:200],
            "health_inference_seconds": time.time() - t0,
            "container_load_seconds": getattr(self, "_load_seconds", None),
            "model": MODEL_TAG,
            "gpu": GPU_TYPE,
            "model_ensure": getattr(self, "_model_ensure", None),
            "eval_count": eval_count,
            "prompt_eval_count": data.get("prompt_eval_count"),
            "eval_duration_ns": data.get("eval_duration"),
            "total_duration_ns": data.get("total_duration"),
        }

    @modal.method()
    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.7,
        format_schema: dict[str, Any] | None = None,
        num_predict: int | None = None,
    ) -> dict[str, Any]:
        """Non-streaming chat. Optional JSON schema via Ollama `format`."""
        import httpx

        t0 = time.time()
        options: dict[str, Any] = {"temperature": temperature}
        if num_predict is not None:
            options["num_predict"] = num_predict
        payload: dict[str, Any] = {
            "model": MODEL_TAG,
            "messages": messages,
            "stream": False,
            "think": False,
            "options": options,
        }
        if format_schema is not None:
            payload["format"] = format_schema
        r = httpx.post("http://127.0.0.1:11434/api/chat", json=payload, timeout=300.0)
        r.raise_for_status()
        data = r.json()
        text = _strip_think((data.get("message") or {}).get("content", "") or "")
        eval_count = data.get("eval_count") or 0
        eval_duration_ns = data.get("eval_duration") or 0
        toks_per_sec = (
            eval_count / (eval_duration_ns / 1e9) if eval_count and eval_duration_ns else None
        )
        return {
            "ok": True,
            "text": text,
            "wall_seconds": time.time() - t0,
            "model": data.get("model") or MODEL_TAG,
            "gpu": GPU_TYPE,
            "prompt_eval_count": data.get("prompt_eval_count"),
            "eval_count": eval_count,
            "eval_duration_ns": eval_duration_ns,
            "total_duration_ns": data.get("total_duration"),
            "tokens_per_sec": toks_per_sec,
        }

    @modal.method()
    def chat_stream(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float = 0.7,
    ) -> Iterator[dict[str, Any]]:
        """Streaming chat — yields {type:chunk|done|error, ...}."""
        import httpx

        t0 = time.time()
        first_token_at: float | None = None
        payload = {
            "model": MODEL_TAG,
            "messages": messages,
            "stream": True,
            "think": False,
            "options": {"temperature": temperature},
        }
        strip_buf = ""
        decided = False
        emitted_any = False
        try:
            with httpx.stream(
                "POST",
                "http://127.0.0.1:11434/api/chat",
                json=payload,
                timeout=300.0,
            ) as resp:
                resp.raise_for_status()
                for line in resp.iter_lines():
                    if not line.strip():
                        continue
                    data = json.loads(line)
                    piece = (data.get("message") or {}).get("content") or ""
                    if piece:
                        if not decided:
                            strip_buf += piece
                            if strip_buf.startswith("<think>"):
                                close = strip_buf.find("</think>")
                                if close != -1:
                                    decided = True
                                    after = strip_buf[close + len("</think>") :].lstrip()
                                    strip_buf = ""
                                    if after:
                                        if first_token_at is None:
                                            first_token_at = time.time()
                                        emitted_any = True
                                        yield {"type": "chunk", "text": after}
                                elif len(strip_buf) > 8000:
                                    decided = True
                                    if first_token_at is None:
                                        first_token_at = time.time()
                                    emitted_any = True
                                    yield {"type": "chunk", "text": strip_buf}
                                    strip_buf = ""
                            else:
                                decided = True
                                if first_token_at is None:
                                    first_token_at = time.time()
                                emitted_any = True
                                yield {"type": "chunk", "text": strip_buf}
                                strip_buf = ""
                        else:
                            if first_token_at is None:
                                first_token_at = time.time()
                            emitted_any = True
                            yield {"type": "chunk", "text": piece}
                    if data.get("done"):
                        if not decided and strip_buf:
                            if first_token_at is None:
                                first_token_at = time.time()
                            yield {"type": "chunk", "text": strip_buf}
                        eval_count = data.get("eval_count") or 0
                        eval_duration_ns = data.get("eval_duration") or 0
                        toks = (
                            eval_count / (eval_duration_ns / 1e9)
                            if eval_count and eval_duration_ns
                            else None
                        )
                        yield {
                            "type": "done",
                            "wall_seconds": time.time() - t0,
                            "ttft_seconds": (
                                (first_token_at - t0) if first_token_at is not None else None
                            ),
                            "emitted_any": emitted_any,
                            "model": data.get("model") or MODEL_TAG,
                            "gpu": GPU_TYPE,
                            "prompt_eval_count": data.get("prompt_eval_count"),
                            "eval_count": eval_count,
                            "tokens_per_sec": toks,
                        }
                        return
        except Exception as e:
            yield {"type": "error", "message": f"{type(e).__name__}: {e}"}

    # Back-compat for PoC control.py smoke tests
    @modal.method()
    def generate(
        self,
        prompt: str,
        *,
        temperature: float = 0.2,
        num_predict: int = 64,
        system: str | None = None,
    ) -> dict[str, Any]:
        import httpx

        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        user = prompt if prompt.lstrip().startswith("/no_think") else f"/no_think\n{prompt}"
        messages.append({"role": "user", "content": user})
        t0 = time.time()
        payload = {
            "model": MODEL_TAG,
            "messages": messages,
            "stream": False,
            "think": False,
            "options": {"temperature": temperature, "num_predict": num_predict},
        }
        r = httpx.post("http://127.0.0.1:11434/api/chat", json=payload, timeout=300.0)
        r.raise_for_status()
        data = r.json()
        text = _strip_think((data.get("message") or {}).get("content", "") or "")
        eval_count = data.get("eval_count") or 0
        eval_duration_ns = data.get("eval_duration") or 0
        return {
            "ok": True,
            "output": text,
            "wall_seconds": time.time() - t0,
            "model": data.get("model") or MODEL_TAG,
            "gpu": GPU_TYPE,
            "prompt_eval_count": data.get("prompt_eval_count"),
            "eval_count": eval_count,
            "eval_duration_ns": eval_duration_ns,
            "total_duration_ns": data.get("total_duration"),
            "tokens_per_sec": (
                eval_count / (eval_duration_ns / 1e9) if eval_count and eval_duration_ns else None
            ),
            "ttft_note": "use chat_stream for TTFT",
        }


@app.local_entrypoint()
def main() -> None:
    print(json.dumps({"app": APP_NAME, "model": MODEL_TAG, "gpu": GPU_TYPE}))
