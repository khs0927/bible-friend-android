"""Qwen3-TTS (CustomVoice, speaker "sohee") on Modal via vLLM-Omni.

Most natural open-source Korean voice tier. OpenAI-compatible /v1/audio/speech,
consumed by supabase/functions/_shared/providers/openai.ts (qwen3Tts).

NOT DEPLOYED / NOT TESTED in this repo yet (GPU costs money). Deploy with:

    modal secret create bible-friend-voice-gpu VOICE_GPU_API_KEY=<random>
    modal deploy services/voice-gpu/modal_app.py

Then set in Supabase secrets:
    QWEN_TTS_URL=https://<workspace>--bible-friend-voice-gpu-serve.modal.run
    QWEN_TTS_API_KEY=<same random value>

Cost control: min_containers=0 + short scaledown window, so the GPU only runs
while requests arrive (cold start ~1–2 min; the app falls back to Supertonic meanwhile).
"""

import subprocess

import modal

MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
PORT = 8000

model_volume = modal.Volume.from_name("bible-friend-qwen3-tts", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "libsndfile1")
    # vLLM-Omni pins its matching vLLM release.
    .pip_install("vllm-omni", "huggingface_hub[hf_transfer]")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1", "HF_HOME": "/models"})
)

app = modal.App("bible-friend-voice-gpu")


@app.function(
    image=image,
    gpu="L4",
    volumes={"/models": model_volume},
    secrets=[modal.Secret.from_name("bible-friend-voice-gpu")],
    min_containers=0,
    scaledown_window=180,
    timeout=60 * 60,
)
@modal.concurrent(max_inputs=8)
@modal.web_server(port=PORT, startup_timeout=15 * 60)
def serve() -> None:
    import os

    subprocess.Popen(
        [
            "vllm",
            "serve",
            MODEL_ID,
            "--omni",
            "--host",
            "0.0.0.0",
            "--port",
            str(PORT),
            "--trust-remote-code",
            # Standard vLLM OpenAI-server bearer auth for /v1/* routes.
            "--api-key",
            os.environ["VOICE_GPU_API_KEY"],
        ]
    )
