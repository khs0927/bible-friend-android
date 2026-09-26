# Open-source voice fallback (CPU): Supertonic 3 TTS + faster-whisper STT.
# docker build -t bible-friend-voice-cpu services/voice-cpu
# docker run -p 8808:8808 -e VOICE_API_KEY=... -v voice-models:/models bible-friend-voice-cpu
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models/hf \
    VOICE_MODEL_DIR=/models \
    HF_HUB_DISABLE_SYMLINKS_WARNING=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends libsndfile1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .

RUN useradd --create-home --uid 10001 voice && mkdir -p /models && chown voice /models
USER voice
VOLUME ["/models"]
EXPOSE 8808
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8808/healthz')"
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8808", "--workers", "1"]
