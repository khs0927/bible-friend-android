// Provider chains, configured by environment. Order = preference.
//
//   TTS  gemini TTS models → Qwen3-TTS (GPU, optional) → Supertonic 3 (CPU) → [app: on-device voice]
//   STT  gemini models → faster-whisper (CPU)
//   LLM  gemini models → open-weight model via OpenAI-compatible API (optional) → [caller: safe canned answer]
import { geminiLlm, geminiStt, geminiTts } from './gemini.ts';
import { openAiCompatibleLlm, qwen3Tts, supertonicTts, whisperStt } from './openai.ts';
import type { LlmProvider, SttProvider, TtsProvider } from './types.ts';

export { runChain } from './breaker.ts';
export type { ChatTurn, LlmProvider, SttProvider, TtsProvider } from './types.ts';

const DEFAULTS = {
  // Separate models have separate free-tier quotas, so a second model is a real fallback.
  chat: 'gemini-flash-latest,gemini-flash-lite-latest',
  tts: 'gemini-3.8-flash-tts,gemini-3.8-flash-lite-tts',
  stt: 'gemini-flash-latest,gemini-flash-lite-latest',
};

type Env = (name: string) => string | undefined;
const denoEnv: Env = (name) => Deno.env.get(name) || undefined;

function list(value: string | undefined, fallback: string): string[] {
  return (value ?? fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function llmChain(env: Env = denoEnv): LlmProvider[] {
  const providers: LlmProvider[] = [];
  const key = env('GEMINI_API_KEY');
  if (key) providers.push(...list(env('GEMINI_CHAT_MODELS'), DEFAULTS.chat).map((m) => geminiLlm(key, m)));
  const ossUrl = env('OSS_LLM_URL');
  const ossModel = env('OSS_LLM_MODEL');
  if (ossUrl && ossModel) providers.push(openAiCompatibleLlm(ossUrl, ossModel, env('OSS_LLM_API_KEY')));
  return providers;
}

export function ttsChain(env: Env = denoEnv): TtsProvider[] {
  const providers: TtsProvider[] = [];
  const key = env('GEMINI_API_KEY');
  if (key) providers.push(...list(env('GEMINI_TTS_MODELS'), DEFAULTS.tts).map((m) => geminiTts(key, m)));
  const qwenUrl = env('QWEN_TTS_URL');
  if (qwenUrl) providers.push(qwen3Tts(qwenUrl, env('QWEN_TTS_API_KEY'), env('QWEN_TTS_VOICE') ?? 'sohee'));
  const cpuUrl = env('VOICE_CPU_URL');
  if (cpuUrl) providers.push(supertonicTts(cpuUrl, env('VOICE_API_KEY')));
  return providers;
}

export function sttChain(env: Env = denoEnv): SttProvider[] {
  const providers: SttProvider[] = [];
  const key = env('GEMINI_API_KEY');
  if (key) providers.push(...list(env('GEMINI_STT_MODELS'), DEFAULTS.stt).map((m) => geminiStt(key, m)));
  const cpuUrl = env('VOICE_CPU_URL');
  if (cpuUrl) providers.push(whisperStt(cpuUrl, env('VOICE_API_KEY')));
  return providers;
}
