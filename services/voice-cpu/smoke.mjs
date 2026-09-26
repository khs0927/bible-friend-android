// node services/voice-cpu/smoke.mjs [baseUrl]
// Round-trip check: synthesize Korean speech, transcribe it back, compare.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] ?? 'http://127.0.0.1:8808';
const env = readFileSync(join(here, '../../supabase/functions/.env'), 'utf8');
const key = /^VOICE_API_KEY=(.+)$/m.exec(env)?.[1]?.trim();
const text = '다윗은 작은 물매돌 하나로 골리앗에게 맞섰어요. 하나님이 주신 용기였지요!';
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const unauth = await fetch(`${base}/v1/audio/speech`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ input: '안녕' }),
});
check('rejects requests without the API key', unauth.status === 401, `HTTP ${unauth.status}`);

const t0 = Date.now();
const speech = await fetch(`${base}/v1/audio/speech`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
  body: JSON.stringify({ input: text, voice: 'CHILD_FRIEND' }),
});
const wav = Buffer.from(await speech.arrayBuffer());
const seconds = wav.length > 44 ? (wav.length - 44) / (wav.readUInt32LE(24) * 2) : 0;
check('synthesizes Korean speech', speech.ok && wav.toString('ascii', 0, 4) === 'RIFF',
  `HTTP ${speech.status}, ${seconds.toFixed(1)}s audio in ${Date.now() - t0}ms, preset ${speech.headers.get('x-voice-preset')}`);
writeFileSync(join(here, 'smoke-output.wav'), wav);

const form = new FormData();
form.append('file', new Blob([wav], { type: 'audio/wav' }), 'speech.wav');
form.append('language', 'ko');
const t1 = Date.now();
const stt = await fetch(`${base}/v1/audio/transcriptions`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}` },
  body: form,
});
const { text: heard = '' } = stt.ok ? await stt.json() : {};
// Spoken Korean liaison (골리앗에게 → "골리아세게") changes a few syllables, so
// compare by longest-common-subsequence ratio instead of exact equality.
const norm = (s) => [...s.replace(/[^\p{L}\p{N}]/gu, '')];
function similarity(a, b) {
  const x = norm(a);
  const y = norm(b);
  const row = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i += 1) {
    let diag = 0;
    for (let j = 1; j <= y.length; j += 1) {
      const up = row[j];
      row[j] = x[i - 1] === y[j - 1] ? diag + 1 : Math.max(up, row[j - 1]);
      diag = up;
    }
  }
  return row[y.length] / Math.max(x.length, y.length);
}
const score = similarity(text, heard);
check('transcribes it back (≥85% match)', stt.ok && score >= 0.85, `${(score * 100).toFixed(0)}% in ${Date.now() - t1}ms: ${heard}`);

const bad = new FormData();
bad.append('file', new Blob([Buffer.from('not audio')], { type: 'audio/wav' }), 'bad.wav');
const badRes = await fetch(`${base}/v1/audio/transcriptions`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}` },
  body: bad,
});
check('corrupt audio is a 400, not a crash', badRes.status === 400, `HTTP ${badRes.status}`);

process.exit(failures ? 1 : 0);
