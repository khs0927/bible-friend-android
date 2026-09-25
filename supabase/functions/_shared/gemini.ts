// Minimal Gemini REST client (generateContent). Server-only: the API key never
// leaves the Edge Function.
import { ApiError } from './http.ts';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const MODELS = {
  chat: Deno.env.get('GEMINI_CHAT_MODEL') || 'gemini-flash-latest',
  tts: Deno.env.get('GEMINI_TTS_MODEL') || 'gemini-2.5-flash-preview-tts',
  stt: Deno.env.get('GEMINI_STT_MODEL') || 'gemini-flash-latest',
};

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

function apiKey(): string {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new ApiError('upstream_error', 'GEMINI_API_KEY is not configured');
  return key;
}

async function generate(model: string, body: unknown, timeoutMs: number): Promise<GenerateResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    console.warn(`[gemini] ${model} request failed`, error);
    throw new ApiError('upstream_error');
  }
  if (response.status === 429) {
    console.warn(`[gemini] ${model} rate limited`);
    throw new ApiError('upstream_error');
  }
  if (!response.ok) {
    console.warn(`[gemini] ${model} HTTP ${response.status}`, (await response.text()).slice(0, 500));
    throw new ApiError('upstream_error');
  }
  return (await response.json()) as GenerateResponse;
}

function firstCandidate(result: GenerateResponse) {
  const candidate = result.candidates?.[0];
  const blocked =
    Boolean(result.promptFeedback?.blockReason) ||
    candidate?.finishReason === 'SAFETY' ||
    candidate?.finishReason === 'PROHIBITED_CONTENT' ||
    candidate?.finishReason === 'BLOCKLIST';
  return { candidate, blocked };
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export async function generateText(options: {
  system: string;
  turns: ChatTurn[];
  maxOutputTokens?: number;
}): Promise<{ text: string; blocked: boolean }> {
  const result = await generate(
    MODELS.chat,
    {
      systemInstruction: { parts: [{ text: options.system }] },
      contents: options.turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
      safetySettings: SAFETY_SETTINGS,
      generationConfig: { temperature: 0.7, maxOutputTokens: options.maxOutputTokens ?? 2048 },
    },
    15_000,
  );
  const { candidate, blocked } = firstCandidate(result);
  const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('').trim();
  return { text, blocked };
}

export async function generateJson<T>(options: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
}): Promise<T | null> {
  const result = await generate(
    MODELS.chat,
    {
      systemInstruction: { parts: [{ text: options.system }] },
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      safetySettings: SAFETY_SETTINGS,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: options.schema,
      },
    },
    15_000,
  );
  const { candidate, blocked } = firstCandidate(result);
  if (blocked) return null;
  const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('');
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Synthesizes speech and returns a playable WAV file. */
export async function synthesizeSpeech(options: {
  text: string;
  voice: string;
  direction: string;
}): Promise<Uint8Array> {
  const result = await generate(
    MODELS.tts,
    {
      contents: [{ parts: [{ text: `${options.direction}: ${options.text}` }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: options.voice } } },
      },
    },
    25_000,
  );
  const part = result.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData) throw new ApiError('upstream_error');
  const bytes = base64ToBytes(part.inlineData.data);
  if (isWav(bytes)) return bytes;
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType)?.[1] ?? 24_000);
  return pcmToWav(bytes, rate);
}

export async function transcribeAudio(options: { base64: string; mimeType: string }): Promise<string> {
  const result = await generate(
    MODELS.stt,
    {
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: options.mimeType, data: options.base64 } },
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
  const { candidate } = firstCandidate(result);
  return (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('').trim();
}

// --- audio helpers ------------------------------------------------------------

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isWav(bytes: Uint8Array): boolean {
  return bytes.length > 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF';
}

/** Wraps 16-bit little-endian mono PCM in a WAV container. */
export function pcmToWav(pcm: Uint8Array, sampleRate = 24_000, channels = 1, bitsPerSample = 16): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  const blockAlign = (channels * bitsPerSample) / 8;
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, pcm.length, true);
  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);
  return wav;
}
