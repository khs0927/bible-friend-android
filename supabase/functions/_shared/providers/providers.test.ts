// deno test --config supabase/functions/deno.json supabase/functions/_shared/providers/
import { VOICE_PROFILES } from '../core/index.ts';
import { isWav, pcmToWav, wavSeconds } from './audio.ts';
import { ProviderError, isCoolingDown, reset, runChain } from './breaker.ts';
import { geminiTts } from './gemini.ts';
import { llmChain, sttChain, ttsChain } from './index.ts';
import { supertonicTts } from './openai.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function assertEquals<T>(actual: T, expected: T, message = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message} expected ${e}, got ${a}`);
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;
async function withFetch<T>(handler: Handler, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(handler(String(input instanceof Request ? input.url : input), init ?? {}))) as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

const tinyWav = pcmToWav(new Uint8Array(4800), 24_000); // 0.1 s of silence
const env = (values: Record<string, string>) => (name: string) => values[name];

Deno.test('chains follow env configuration and preference order', () => {
  const tts = ttsChain(env({ GEMINI_API_KEY: 'k', QWEN_TTS_URL: 'http://gpu', VOICE_CPU_URL: 'http://cpu' }));
  assertEquals(
    tts.map((p) => p.id),
    ['gemini:gemini-3.8-flash-tts', 'gemini:gemini-3.8-flash-lite-tts', 'oss:qwen3-tts', 'oss:supertonic'],
  );
  assertEquals(ttsChain(env({ VOICE_CPU_URL: 'http://cpu' })).map((p) => p.id), ['oss:supertonic'], 'no Gemini key:');
  assertEquals(
    sttChain(env({ GEMINI_API_KEY: 'k', GEMINI_STT_MODELS: 'm1', VOICE_CPU_URL: 'http://cpu' })).map((p) => p.id),
    ['gemini:m1', 'oss:whisper'],
  );
  assertEquals(
    llmChain(env({ GEMINI_API_KEY: 'k', OSS_LLM_URL: 'http://llm', OSS_LLM_MODEL: 'qwen3:8b' })).map((p) => p.id),
    ['gemini:gemini-flash-latest', 'gemini:gemini-flash-lite-latest', 'oss:qwen3:8b'],
  );
});

Deno.test('regression: Gemini TTS receives the plain text only (no style direction)', async () => {
  let sent: any = null;
  const profile = VOICE_PROFILES.CHILD_FRIEND;
  const audio = await withFetch(
    (_url, init) => {
      sent = JSON.parse(String(init.body));
      return Response.json({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: btoa(String.fromCharCode(...tinyWav)) } }] } }],
      });
    },
    () => geminiTts('k', 'gemini-3.8-flash-tts').synthesize({ text: '안녕!', speaker: 'CHILD_FRIEND', profile }),
  );
  assertEquals(sent.contents[0].parts[0].text, '안녕!', 'prompt text');
  assert(!JSON.stringify(sent).includes(profile.direction), 'direction must not be sent to Gemini TTS');
  assertEquals(sent.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, profile.voice);
  assert(isWav(audio), 'returns a WAV');
});

Deno.test('Gemini raw PCM (older models) is wrapped as WAV with the reported rate', async () => {
  const pcm = new Uint8Array(4800);
  const audio = await withFetch(
    () =>
      Response.json({
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: btoa(String.fromCharCode(...pcm)) } }] } },
        ],
      }),
    () => geminiTts('k', 'gemini-3.1-flash-tts-preview').synthesize({ text: '안녕', speaker: 'NARRATOR', profile: VOICE_PROFILES.NARRATOR }),
  );
  assert(isWav(audio), 'wrapped as WAV');
  assertEquals(Math.round(wavSeconds(audio) * 10) / 10, 0.1, 'duration');
});

Deno.test('chain falls back after a 429 and skips the rate-limited provider next time', async () => {
  reset();
  const calls: string[] = [];
  const providers = [
    geminiTts('k', 'gemini-3.8-flash-tts'),
    supertonicTts('http://cpu', 'secret'),
  ];
  const handler: Handler = (url, init) => {
    calls.push(url.includes('googleapis') ? 'gemini' : 'cpu');
    if (url.includes('googleapis')) return new Response('quota', { status: 429 });
    assertEquals((init.headers as Record<string, string>).Authorization, 'Bearer secret', 'voice-cpu auth');
    return new Response(new Uint8Array(tinyWav), { headers: { 'Content-Type': 'audio/wav' } });
  };
  const run = () =>
    runChain(providers, (p) => p.synthesize({ text: '안녕', speaker: 'CHILD_FRIEND', profile: VOICE_PROFILES.CHILD_FRIEND }));

  const first = await withFetch(handler, run);
  assertEquals(first.provider.id, 'oss:supertonic');
  assertEquals(first.attempts.map((a) => a.ok), [false, true]);
  assert(isCoolingDown('gemini:gemini-3.8-flash-tts'), 'gemini is cooling down');

  calls.length = 0;
  const second = await withFetch(handler, run);
  assertEquals(calls, ['cpu'], 'second request skips the rate-limited provider:');
  assertEquals(second.provider.id, 'oss:supertonic');
  reset();
});

Deno.test('non-audio responses are rejected so the chain moves on', async () => {
  reset();
  let error: unknown = null;
  await withFetch(
    () => Response.json({ detail: 'oops' }),
    () =>
      supertonicTts('http://cpu')
        .synthesize({ text: '안녕', speaker: 'CHILD_FRIEND', profile: VOICE_PROFILES.CHILD_FRIEND })
        .catch((e) => (error = e)),
  );
  assert(error instanceof ProviderError && error.status === 'invalid', 'invalid audio is a ProviderError');
});

Deno.test('when every provider is cooling down, all are still attempted', async () => {
  reset();
  const provider = supertonicTts('http://cpu');
  await withFetch(
    () => new Response('down', { status: 503 }),
    () => runChain([provider], (p) => p.synthesize({ text: 'a', speaker: 'CHILD_FRIEND', profile: VOICE_PROFILES.CHILD_FRIEND })).catch(() => null),
  );
  assert(isCoolingDown('oss:supertonic'), 'tripped');
  const recovered = await withFetch(
    () => new Response(new Uint8Array(tinyWav)),
    () => runChain([provider], (p) => p.synthesize({ text: 'a', speaker: 'CHILD_FRIEND', profile: VOICE_PROFILES.CHILD_FRIEND })),
  );
  assertEquals(recovered.provider.id, 'oss:supertonic');
  reset();
});

Deno.test('open-weight LLM: OpenAI chat format, roles mapped, <think> stripped', async () => {
  const { openAiCompatibleLlm } = await import('./openai.ts');
  let sent: any = null;
  const result = await withFetch(
    (url, init) => {
      assertEquals(url, 'http://llm/v1/chat/completions', 'endpoint');
      sent = JSON.parse(String(init.body));
      return Response.json({ choices: [{ message: { content: '<think>생각 중</think>다윗은 용기를 냈어요.' } }] });
    },
    () =>
      openAiCompatibleLlm('http://llm/', 'qwen3:8b').chat({
        system: 'SYS',
        turns: [
          { role: 'user', text: '질문' },
          { role: 'model', text: '답' },
          { role: 'user', text: '다윗은?' },
        ],
      }),
  );
  assertEquals(result.text, '다윗은 용기를 냈어요.', 'think block removed');
  assertEquals(sent.model, 'qwen3:8b');
  assertEquals(sent.messages.map((m: any) => m.role), ['system', 'user', 'assistant', 'user'], 'roles');
});

Deno.test('whisper STT: multipart upload with language and bearer auth', async () => {
  const { whisperStt } = await import('./openai.ts');
  let form: FormData | null = null;
  let auth = '';
  const text = await withFetch(
    (url, init) => {
      assertEquals(url, 'http://cpu/v1/audio/transcriptions', 'endpoint');
      form = init.body as FormData;
      auth = (init.headers as Record<string, string>).Authorization ?? '';
      return Response.json({ text: ' 다윗은 하나님을 믿었어요. ' });
    },
    () => whisperStt('http://cpu', 'secret').transcribe({ audio: new Uint8Array([1, 2, 3]), mimeType: 'audio/mp4' }),
  );
  assertEquals(text, '다윗은 하나님을 믿었어요.', 'trimmed text');
  assertEquals(auth, 'Bearer secret', 'auth header');
  assertEquals((form as unknown as FormData).get('language'), 'ko', 'language field');
  assertEquals(((form as unknown as FormData).get('file') as File).name, 'speech.m4a', 'file name from mime');
});
