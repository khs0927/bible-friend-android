# 음성 · AI 공급자 구조 (Gemini + 오픈소스 폴백)

모든 AI 기능은 **공급자 체인**으로 동작합니다. 앞의 공급자가 실패하거나 한도(429)에 걸리면 다음 공급자로 넘어가고, 실패한 공급자는 잠시(429는 60초) 건너뜁니다(`supabase/functions/_shared/providers`).

| 기능 | 1순위 | 2순위 | 3순위 | 최후 |
|---|---|---|---|---|
| 읽어주기 (TTS) | `gemini-3.8-flash-tts` | `gemini-3.8-flash-lite-tts` | **Qwen3-TTS** "sohee" (GPU, 선택) → **Supertonic 3** (CPU) | 앱 기기 음성 (`expo-speech`) |
| 받아쓰기 (STT) | `gemini-flash-latest` | `gemini-flash-lite-latest` | **faster-whisper** large-v3-turbo (CPU) | — |
| 대화 | `gemini-flash-latest` | `gemini-flash-lite-latest` | 오픈 웨이트 LLM (OpenAI 호환, 선택) | 안전한 기본 답변 |

Gemini는 모델마다 무료 한도가 따로라서, 같은 키로 두 번째 모델을 두는 것만으로도 실제 폴백이 됩니다. 2026-09-26 테스트 중 `flash-latest`가 429일 때 `flash-lite-latest`가 대신 답했습니다.

## 오픈소스 음성 선정 (2026-09 조사)

| 모델 | 라이선스 | 한국어 | 실행 | 선택 이유 |
|---|---|---|---|---|
| **Qwen3-TTS 1.7B CustomVoice** | Apache-2.0 | 네이티브 화자 **Sohee**, 감정 지시 | GPU (vLLM-Omni, OpenAI 호환 `/v1/audio/speech`) | 가장 자연스러운 오픈소스 한국어 음성. 10개 언어 테스트셋에서 한국어 WER이 가장 낮았음. HS-TTS 저장소에서 쓰던 엔진 |
| **Supertonic 3** (2026-07) | MIT 코드, OpenRAIL-M 모델 | 지원, 프리셋 10종(F1–F5, M1–M5) | **CPU만으로** 실시간 (ONNX, 99M) | GPU 없이 항상 켜 둘 수 있는 폴백 |
| faster-whisper large-v3-turbo | MIT | 지원 | CPU int8 | STT 폴백 |

검토 후 제외한 모델:
- Chatterbox: 한국어 품질 정보 부족
- IndexTTS2: 상업 사용 제한
- CosyVoice: Qwen3-TTS와 역할이 겹침
- Kokoro: 한국어 미지원

## 검증 결과

실제로 합성한 음성을 faster-whisper로 받아 적어 비교했습니다.

| 샘플 | 받아 적은 결과 | 판정 |
|---|---|---|
| Gemini 3.8 flash-tts, **텍스트만** | 문장 그대로 | ✅ |
| Gemini 3.8 flash-lite-tts, **텍스트만** | 문장 그대로 | ✅ |
| Gemini + "Say cheerfully…" 지시문 | 지시문만 읽음 | ❌ |
| Gemini + "밝게 읽어 줘: 문장" | 전혀 다른 말을 지어냄 | ❌ |
| Supertonic 3 F1–F5 (CPU) | 5종 모두 문장 그대로 | ✅ |

→ **Gemini TTS에는 텍스트만 보냅니다.** 말투는 프리셋 음성(`voiceName`)으로 정합니다. 회귀 테스트: `providers.test.ts`

→ 말투 지시(`VoiceProfile.direction`)는 지시 필드가 따로 있는 Qwen3-TTS(`instructions`)에만 보냅니다.

## 실행

### CPU 음성 서버 (Supertonic 3 + faster-whisper)

```bash
# Docker (권장, 모델은 볼륨에 저장)
docker build -t bible-friend-voice-cpu services/voice-cpu
docker run -d -p 8808:8808 -e VOICE_API_KEY=<비밀값> -v voice-models:/models bible-friend-voice-cpu

# 또는 로컬 Python 3.12
cd services/voice-cpu
uv venv --python 3.12 .venv && uv pip install --python .venv -r requirements.txt
VOICE_API_KEY=<비밀값> .venv/Scripts/python -m uvicorn app:app --port 8808
```

환경 변수:

| 변수 | 설명 |
|---|---|
| `VOICE_API_KEY` | 필수. 없으면 서버가 시작을 거부합니다 |
| `WHISPER_MODEL` | 기본 `large-v3-turbo`. 메모리가 부족한 PC에서는 `small` |
| `VOICE_MAP` | 화자와 프리셋 연결 (예: `CHILD_FRIEND=F3,NARRATOR=F1`) |
| `SUPERTONIC_STEPS` | 품질·속도 조절 (기본 8) |

메모리: Supertonic 약 0.5GB, whisper large-v3-turbo(int8) 약 1.5GB, small은 약 0.5GB입니다.

확인:

```bash
node services/voice-cpu/smoke.mjs
```

(인증, 합성, 되받아쓰기 ≥85%, 손상된 오디오 → 400)

### GPU 음성 (Qwen3-TTS, 선택)

`services/voice-gpu/modal_app.py`를 참고하세요. **아직 배포·검증하지 않았습니다(GPU 비용 발생).** 배포 후 `QWEN_TTS_URL`, `QWEN_TTS_API_KEY`를 설정하면 체인에 자동으로 들어갑니다.

### Edge Functions 연결

`supabase/functions/.env.example`을 참고하세요. 로컬 Docker 안의 함수는 호스트에 `http://host.docker.internal:8808`로 접근합니다.

### 전체 확인

```bash
pnpm functions:test   # 공급자 체인 단위 테스트 (Deno)
pnpm smoke:voice      # 실제 함수 경유: 대화, TTS(+캐시), 앱 URL 다운로드, STT. 사용된 공급자 출력
```

## 참고 자료

- [QwenLM/Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)
- [vLLM-Omni Speech API](https://docs.vllm.ai/projects/vllm-omni/en/latest/serving/speech_api/)
- [MarkTechPost: Qwen3-TTS 공개 (2026-01)](https://www.marktechpost.com/2026/01/22/qwen-researchers-release-qwen3-tts-an-open-multilingual-tts-suite-with-real-time-latency-and-fine-grained-voice-control/)
- [Supertone/supertonic-3](https://huggingface.co/Supertone/supertonic-3)
- [supertone-inc/supertonic](https://github.com/supertone-inc/supertonic)
- [오픈소스 TTS 비교 2026 (Pinggy)](https://pinggy.io/blog/best_open_source_self_hosted_text_to_speech_models/)
- [오픈소스 TTS 비교 2026 (OCDevel)](https://ocdevel.com/blog/20250720-tts)
