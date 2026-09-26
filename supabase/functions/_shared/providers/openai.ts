// OpenAI-compatible providers. Any server that speaks these routes can be
// plugged in by URL:
//   services/voice-cpu            Supertonic 3 TTS + faster-whisper STT (CPU)
//   vLLM-Omni + Qwen3-TTS         /v1/audio/speech (GPU)
//   Ollama / vLLM / OpenRouter    /v1/chat/completions (open-weight LLM)
import { isWav } from './audio.ts';
import { ProviderError, providerFetch } from './breaker.ts';
import type { LlmProvider, SttProvider, TtsProvider } from './types.ts';

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, '')}${path}`;
}

function authHeaders(apiKey?: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

/** services/voice-cpu (Supertonic 3). `voice` is the app speaker id; the server maps it to a preset. */
export function supertonicTts(baseUrl: string, apiKey?: string): TtsProvider {
  const id = 'oss:supertonic';
  return {
    id,
    cacheTag: 'supertonic-3',
    async synthesize({ text, speaker }) {
      const response = await providerFetch(
        id,
        joinUrl(baseUrl, '/v1/audio/speech'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders(apiKey) },
          body: JSON.stringify({ input: text, voice: speaker, language: 'ko', response_format: 'wav' }),
        },
        20_000,
      );
      const wav = new Uint8Array(await response.arrayBuffer());
      if (!isWav(wav)) throw new ProviderError(id, 'invalid', `${id}: not a WAV response`);
      return wav;
    },
  };
}

/**
 * Qwen3-TTS CustomVoice served by vLLM-Omni. "sohee" is the native Korean
 * speaker; style goes in `instructions` (a separate field, so it is never read aloud).
 */
export function qwen3Tts(baseUrl: string, apiKey?: string, voice = 'sohee'): TtsProvider {
  const id = 'oss:qwen3-tts';
  return {
    id,
    cacheTag: `qwen3-tts-${voice}`,
    async synthesize({ text, profile }) {
      const response = await providerFetch(
        id,
        joinUrl(baseUrl, '/v1/audio/speech'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders(apiKey) },
          body: JSON.stringify({
            input: text,
            voice,
            task_type: 'CustomVoice',
            language: 'Korean',
            instructions: profile.direction,
            response_format: 'wav',
          }),
        },
        30_000,
      );
      const wav = new Uint8Array(await response.arrayBuffer());
      if (!isWav(wav)) throw new ProviderError(id, 'invalid', `${id}: not a WAV response`);
      return wav;
    },
  };
}

export function whisperStt(baseUrl: string, apiKey?: string): SttProvider {
  const id = 'oss:whisper';
  return {
    id,
    async transcribe({ audio, mimeType }) {
      const extension = mimeType.includes('wav') ? 'wav' : mimeType.includes('webm') ? 'webm' : 'm4a';
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), `speech.${extension}`);
      form.append('language', 'ko');
      form.append('model', 'whisper-1');
      const response = await providerFetch(
        id,
        joinUrl(baseUrl, '/v1/audio/transcriptions'),
        { method: 'POST', headers: authHeaders(apiKey), body: form },
        45_000,
      );
      const body = (await response.json()) as { text?: string };
      return (body.text ?? '').trim();
    },
  };
}

/** Open-weight chat model behind an OpenAI-compatible /v1/chat/completions. */
export function openAiCompatibleLlm(baseUrl: string, model: string, apiKey?: string): LlmProvider {
  const id = `oss:${model}`;
  const complete = async (messages: Array<{ role: string; content: string }>, jsonMode: boolean) => {
    const response = await providerFetch(
      id,
      joinUrl(baseUrl, '/v1/chat/completions'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(apiKey) },
        body: JSON.stringify({
          model,
          messages,
          temperature: jsonMode ? 0.3 : 0.7,
          max_tokens: 800,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      },
      30_000,
    );
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    // Some reasoning models wrap their thinking in <think> tags.
    return (body.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  };
  return {
    id,
    async chat({ system, turns }) {
      const text = await complete(
        [
          { role: 'system', content: system },
          ...turns.map((turn) => ({ role: turn.role === 'model' ? 'assistant' : 'user', content: turn.text })),
        ],
        false,
      );
      if (!text) throw new ProviderError(id, 'invalid', `${id}: empty answer`);
      return { text, blocked: false };
    },
    async json({ system, prompt, schema }) {
      const text = await complete(
        [
          { role: 'system', content: `${system}\n다음 JSON 스키마로만 답해: ${JSON.stringify(schema)}` },
          { role: 'user', content: prompt },
        ],
        true,
      );
      try {
        return JSON.parse(text);
      } catch {
        throw new ProviderError(id, 'invalid', `${id}: invalid JSON`);
      }
    },
  };
}
