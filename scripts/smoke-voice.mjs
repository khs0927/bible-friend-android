#!/usr/bin/env node
// Voice / AI end-to-end check against the LOCAL stack, through the real Edge Functions.
//   pnpm db:start && pnpm functions:serve && (services/voice-cpu running)
//   pnpm smoke:voice
// Prints which provider answered each request, so fallbacks are visible.
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const URL = status.API_URL;
const client = createClient(URL, status.PUBLISHABLE_KEY ?? status.ANON_KEY, { auth: { persistSession: false } });

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};
async function invoke(name, body) {
  const started = Date.now();
  const { data, error } = await client.functions.invoke(name, { body });
  const ms = Date.now() - started;
  if (error) return { error: (await error.context?.json?.().catch(() => null)) ?? { error: error.message }, ms };
  return { data, ms };
}

const { data: auth, error } = await client.auth.signUp({ email: `voice-${Date.now()}@dev.local`, password: 'smoke-test-password' });
if (error) throw error;
const userId = auth.user.id;
await client.from('guardians').update({ consented_at: new Date().toISOString(), consent_version: 'smoke' }).eq('id', userId);
const { data: child } = await client.from('children').insert({ guardian_id: userId, nickname: '하늘', birth_year: 2018 }).select().single();

// Chat
const chat = await invoke('chat', { mode: 'ask', childId: child.id, message: '다윗은 어떻게 골리앗을 이겼어?' });
check('chat answers', typeof chat.data?.reply === 'string' && chat.data.reply.length > 10,
  `${chat.ms}ms via ${chat.data?.provider}: ${chat.data?.reply?.slice(0, 60)}…`);

// TTS (fresh text so the cache is cold), then again (cache hit)
const sentence = `성경 친구가 들려주는 이야기 ${Date.now() % 100000}번이에요. 다윗은 하나님을 믿었어요.`;
const tts = await invoke('tts', { text: sentence, speaker: 'CHILD_FRIEND' });
check('tts renders audio', Boolean(tts.data?.path?.startsWith('/storage/v1/object/sign/')),
  `${tts.ms}ms via ${tts.data?.provider}${tts.error ? ` ${JSON.stringify(tts.error)}` : ''}`);
const again = await invoke('tts', { text: sentence, speaker: 'CHILD_FRIEND' });
check('tts cache hit on repeat', again.data?.cached === true && again.data?.provider === tts.data?.provider, `${again.ms}ms`);

// Download through the client-side URL (origin + path), exactly like the app does
let wav = null;
if (tts.data?.path) {
  const res = await fetch(`${URL}${tts.data.path}`);
  wav = new Uint8Array(await res.arrayBuffer());
  check('audio is downloadable from the app-facing URL', res.ok && Buffer.from(wav.subarray(0, 4)).toString() === 'RIFF',
    `HTTP ${res.status}, ${(wav.length / 1024).toFixed(0)}KB`);
}

// STT on the audio we just rendered
if (wav) {
  const stt = await invoke('transcribe', { audioBase64: Buffer.from(wav).toString('base64'), mimeType: 'audio/wav' });
  // Spoken Korean liaison (다윗은 → "다위슨") changes spelling, so compare by
  // longest-common-subsequence ratio rather than exact text.
  const norm = (s) => [...(s ?? '').replace(/[^\p{L}\p{N}]/gu, '')];
  const x = norm(sentence);
  const y = norm(stt.data?.text);
  const row = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i += 1) {
    let diag = 0;
    for (let j = 1; j <= y.length; j += 1) {
      const up = row[j];
      row[j] = x[i - 1] === y[j - 1] ? diag + 1 : Math.max(up, row[j - 1]);
      diag = up;
    }
  }
  const score = row[y.length] / Math.max(x.length, y.length, 1);
  check('transcribe hears the sentence (≥85% match)', score >= 0.85,
    `${(score * 100).toFixed(0)}% in ${stt.ms}ms via ${stt.data?.provider}: ${stt.data?.text ?? JSON.stringify(stt.error)}`);
}

await invoke('delete-account', {});
console.log(failures ? `\n${failures} check(s) failed` : '\nAll voice smoke checks passed');
process.exit(failures ? 1 : 0);
