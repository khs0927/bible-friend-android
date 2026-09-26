// Gemini REST (generateContent). Server-only — the key never reaches the app.
import { base64ToBytes, isWav, pcmToWav } from './audio.ts';
import { ProviderError, providerFetch } from './breaker.ts';
import type { ChatTurn, LlmProvider, SttProvider, TtsProvider } from './types.ts';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Strictest thresholds — this is a children's product.
const SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map((category) => ({ category, threshold: 'BLOCK_LOW_AND_ABOVE' }));

interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}
interface GenerateResponse {
  candidates?: Array<{ content?: { parts?: Part[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
}

async function generate(apiKey: string, id: string, model: string, body: unknown, timeoutMs: number) {
  const response = await providerFetch(
    id,
    `${API_BASE}/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  return (await response.json()) as GenerateResponse;
}

function textOf(result: GenerateResponse): { text: string; blocked: boolean } {
  const candidate = result.candidates?.[0];
  const blocked =
    Boolean(result.promptFeedback?.blockReason) ||
    ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST'].includes(candidate?.finishReason ?? '');
  const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('').trim();
  return { text, blocked };
}

export function geminiLlm(apiKey: string, model: string): LlmProvider {
  const id = `gemini:${model}`;
  return {
    id,
    async chat({ system, turns, maxOutputTokens }) {
      const result = await generate(
        apiKey,
        id,
        model,
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: turns.map((turn: ChatTurn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
          safetySettings: SAFETY_SETTINGS,
          generationConfig: { temperature: 0.7, maxOutputTokens: maxOutputTokens ?? 2048 },
        },
        15_000,
      );
      const { text, blocked } = textOf(result);
      if (!blocked && !text) throw new ProviderError(id, 'invalid', `${id}: empty answer`);
      return { text, blocked };
    },
    async json({ system, prompt, schema }) {
      const result = await generate(
        apiKey,
        id,
        model,
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          safetySettings: SAFETY_SETTINGS,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
            responseSchema: schema,
          },
        },
        15_000,
      );
      const { text, blocked } = textOf(result);
      if (blocked) return null;
      try {
        return JSON.parse(text);
      } catch {
        throw new ProviderError(id, 'invalid', `${id}: invalid JSON`);
      }
    },
  };
}

/**
 * Gemini TTS. IMPORTANT: send the plain text only. Tested 2026-09-26 with
 * gemini-3.8-flash(-lite)-tts: a style prefix such as "밝게 읽어 줘: …" makes the
 * model improvise unrelated speech, and "Say cheerfully: …" is read aloud. Voice
 * character comes from the prebuilt voice instead.
 */
export function geminiTts(apiKey: string, model: string): TtsProvider {
  const id = `gemini:${model}`;
  return {
    id,
    cacheTag: model,
    async synthesize({ text, profile }) {
      const result = await generate(
        apiKey,
        id,
        model,
        {
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: profile.voice } } },
          },
        },
        25_000,
      );
      const part = result.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData) throw new ProviderError(id, 'invalid', `${id}: no audio`);
      const bytes = base64ToBytes(part.inlineData.data);
      // 3.8 models return audio/wav; older ones return raw PCM (audio/L16;rate=24000).
      if (isWav(bytes)) return bytes;
      const rate = Number(/rate=(\d+)/i.exec(part.inlineData.mimeType)?.[1] ?? 24_000);
      return pcmToWav(bytes, rate);
    },
  };
}

export function geminiStt(apiKey: string, model: string): SttProvider {
  const id = `gemini:${model}`;
  return {
    id,
    async transcribe({ audio, mimeType }) {
      let binary = '';
      for (let i = 0; i < audio.length; i += 0x8000) {
        binary += String.fromCharCode(...audio.subarray(i, i + 0x8000));
      }
      const result = await generate(
        apiKey,
        id,
        model,
        {
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: btoa(binary) } },
                {
                  text: '어린이가 한국어로 말한 녹음이야. 들리는 말을 그대로 한국어 문장으로 받아 적어 줘. 설명이나 따옴표 없이 받아 적은 문장만 출력해. 말소리가 없으면 빈 문자열을 출력해.',
                },
              ],
            },
          ],
          safetySettings: SAFETY_SETTINGS,
          generationConfig: { temperature: 0, maxOutputTokens: 1024 },
        },
        20_000,
      );
      return textOf(result).text;
    },
  };
}
