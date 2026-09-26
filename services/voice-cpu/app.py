"""Open-source voice fallback for 성경 친구 (CPU only).

OpenAI-compatible endpoints so the Edge Functions (or any client) can swap
providers by URL:

  POST /v1/audio/speech          Supertonic 3 (MIT, ONNX)      -> audio/wav
  POST /v1/audio/transcriptions  faster-whisper large-v3-turbo -> {"text": ...}
  GET  /healthz

Auth: `Authorization: Bearer $VOICE_API_KEY` (required unless VOICE_ALLOW_NO_AUTH=true).
"""

from __future__ import annotations

import asyncio
import hmac
import io
import logging
import os
import tempfile
import time
import wave
from contextlib import asynccontextmanager
from typing import Literal

import numpy as np
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

log = logging.getLogger("voice-cpu")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

API_KEY = os.environ.get("VOICE_API_KEY", "")
ALLOW_NO_AUTH = os.environ.get("VOICE_ALLOW_NO_AUTH", "false").lower() == "true"
TTS_MODEL = os.environ.get("SUPERTONIC_MODEL", "supertonic-3")
TTS_STEPS = int(os.environ.get("SUPERTONIC_STEPS", "8"))
STT_MODEL = os.environ.get("WHISPER_MODEL", "large-v3-turbo")
STT_ENABLED = os.environ.get("WHISPER_ENABLED", "true").lower() == "true"
MODEL_DIR = os.environ.get("VOICE_MODEL_DIR")  # persistent volume for downloads
MAX_TEXT_CHARS = 1000
MAX_AUDIO_BYTES = 5 * 1024 * 1024

# App speaker → Supertonic preset. Override with VOICE_MAP="CHILD_FRIEND=F3,NARRATOR=M2".
DEFAULT_VOICE_MAP = {
    "CHILD_FRIEND": "F3",
    "NARRATOR": "F1",
    "JESUS": "M1",
    "DAVID": "M3",
    "PETER": "M2",
    "MARY": "F2",
}
PRESETS = {f"{g}{i}" for g in ("F", "M") for i in range(1, 6)}


def _voice_map() -> dict[str, str]:
    mapping = dict(DEFAULT_VOICE_MAP)
    for pair in filter(None, os.environ.get("VOICE_MAP", "").split(",")):
        key, _, value = pair.partition("=")
        if value.strip() in PRESETS:
            mapping[key.strip()] = value.strip()
    return mapping


VOICE_MAP = _voice_map()
state: dict[str, object] = {}
tts_lock = asyncio.Lock()
stt_lock = asyncio.Lock()


def _load_models() -> None:
    from supertonic import TTS

    started = time.time()
    tts_dir = os.path.join(MODEL_DIR, TTS_MODEL) if MODEL_DIR else None
    tts = TTS(model=TTS_MODEL, model_dir=tts_dir)
    state["tts"] = tts
    state["styles"] = {name: tts.get_voice_style(name) for name in sorted(PRESETS)}
    log.info("supertonic loaded in %.1fs", time.time() - started)
    if STT_ENABLED:
        from faster_whisper import WhisperModel

        started = time.time()
        state["stt"] = WhisperModel(
            STT_MODEL,
            device="cpu",
            compute_type="int8",
            download_root=os.path.join(MODEL_DIR, "whisper") if MODEL_DIR else None,
        )
        log.info("faster-whisper %s loaded in %.1fs", STT_MODEL, time.time() - started)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not API_KEY and not ALLOW_NO_AUTH:
        raise RuntimeError("VOICE_API_KEY is required (or set VOICE_ALLOW_NO_AUTH=true for local dev)")
    await asyncio.to_thread(_load_models)
    yield


app = FastAPI(title="bible-friend voice-cpu", lifespan=lifespan)


def require_auth(authorization: str | None = Header(default=None)) -> None:
    if ALLOW_NO_AUTH and not API_KEY:
        return
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not token or not hmac.compare_digest(token, API_KEY):
        raise HTTPException(status_code=401, detail="unauthorized")


def _to_wav(samples: np.ndarray, sample_rate: int) -> bytes:
    pcm = np.clip(np.asarray(samples, dtype=np.float32).reshape(-1), -1.0, 1.0)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes((pcm * 32767.0).astype("<i2").tobytes())
    return buffer.getvalue()


class SpeechRequest(BaseModel):
    input: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)
    voice: str = "CHILD_FRIEND"
    model: str | None = None
    response_format: Literal["wav"] = "wav"
    speed: float = Field(default=1.0, ge=0.7, le=1.3)
    language: str = "ko"


@app.get("/healthz")
def health() -> dict[str, object]:
    return {"ok": "tts" in state, "tts": TTS_MODEL, "stt": STT_MODEL if "stt" in state else None}


@app.post("/v1/audio/speech", dependencies=[Depends(require_auth)])
async def speech(body: SpeechRequest) -> Response:
    tts = state.get("tts")
    if tts is None:
        raise HTTPException(status_code=503, detail="model loading")
    preset = body.voice if body.voice in PRESETS else VOICE_MAP.get(body.voice, "F3")
    style = state["styles"][preset]  # type: ignore[index]
    started = time.time()
    async with tts_lock:  # ONNX session is not re-entrant
        samples, durations = await asyncio.to_thread(
            tts.synthesize,  # type: ignore[attr-defined]
            body.input,
            voice_style=style,
            lang=body.language,
            total_steps=TTS_STEPS,
            speed=body.speed,
        )
    sample_rate = int(getattr(tts, "sample_rate", 44100))
    wav = _to_wav(samples, sample_rate)
    log.info("speech voice=%s chars=%d took=%.2fs", preset, len(body.input), time.time() - started)
    return Response(content=wav, media_type="audio/wav", headers={"X-Voice-Preset": preset})


@app.post("/v1/audio/transcriptions", dependencies=[Depends(require_auth)])
async def transcriptions(
    file: UploadFile = File(...),
    language: str = Form(default="ko"),
    model: str | None = Form(default=None),  # accepted for OpenAI compatibility
    prompt: str | None = Form(default=None),
) -> dict[str, str]:
    stt = state.get("stt")
    if stt is None:
        raise HTTPException(status_code=503, detail="transcription disabled")
    data = await file.read()
    if not data or len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="audio too large or empty")
    suffix = os.path.splitext(file.filename or "audio.m4a")[1] or ".m4a"
    # faster-whisper decodes through PyAV, which needs a seekable file.
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
        handle.write(data)
        path = handle.name
    try:
        async with stt_lock:

            def run() -> str:
                segments, _info = stt.transcribe(  # type: ignore[attr-defined]
                    path,
                    language=language,
                    beam_size=1,
                    vad_filter=True,
                    initial_prompt=prompt,
                )
                return "".join(segment.text for segment in segments).strip()

            text = await asyncio.to_thread(run)
    except Exception as error:  # undecodable / corrupt audio
        if type(error).__module__.startswith("av"):
            raise HTTPException(status_code=400, detail="unsupported or corrupt audio") from error
        raise
    finally:
        os.unlink(path)
    return {"text": text}
