#!/usr/bin/env node
// End-to-end smoke test against the LOCAL Supabase stack.
//
//   pnpm db:start && pnpm functions:serve   (in another terminal)
//   pnpm smoke
//
// Exercises: sign-up trigger, consent gate, RLS isolation between guardians,
// function-only tables, chat (model fallback works without GEMINI_API_KEY),
// idempotent growth rewards + treasure cards, and cascading account deletion.
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const URL = status.API_URL;
const KEY = status.PUBLISHABLE_KEY ?? status.ANON_KEY;

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function newGuardian(tag) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } });
  const email = `smoke-${tag}-${Date.now()}@dev.local`;
  const { data, error } = await client.auth.signUp({ email, password: 'smoke-test-password' });
  if (error) throw error;
  return { client, userId: data.user.id };
}

async function invoke(client, name, body) {
  const { data, error } = await client.functions.invoke(name, { body });
  if (error) {
    const payload = await error.context?.json?.().catch(() => null);
    return { error: payload ?? { error: error.message } };
  }
  return { data };
}

const a = await newGuardian('a');
const b = await newGuardian('b');

// 1. Guardian row is created by the auth trigger.
const guardianRow = await a.client.from('guardians').select('*').eq('id', a.userId).single();
check('guardian row created on sign-up', Boolean(guardianRow.data), guardianRow.error?.message);

// 2. Children cannot be created before consent.
const early = await a.client.from('children').insert({ guardian_id: a.userId, nickname: '하늘', birth_year: 2018 });
check('child insert blocked before consent', Boolean(early.error));

// 3. AI functions refuse guardians without consent.
const earlyChat = await invoke(a.client, 'tts', { text: '안녕' });
check('AI blocked before consent', earlyChat.error?.error === 'forbidden', JSON.stringify(earlyChat.error));

// 4. Consent, then create a child.
await a.client.from('guardians').update({ consented_at: new Date().toISOString(), consent_version: 'smoke' }).eq('id', a.userId);
const child = await a.client.from('children').insert({ guardian_id: a.userId, nickname: '하늘', birth_year: 2018 }).select().single();
check('child created after consent', Boolean(child.data), child.error?.message);
const childId = child.data.id;

// 5. RLS isolation: guardian B sees nothing of A.
const peek = await b.client.from('children').select('*').eq('id', childId);
check('other guardian cannot read the child', (peek.data ?? []).length === 0);
const hijack = await b.client.from('prayer_notes').insert({ child_id: childId, body: '남의 기도' });
check('other guardian cannot write to the child', Boolean(hijack.error));
const bGrowth = await invoke(b.client, 'growth', { action: 'get', childId });
check('other guardian cannot use growth function', bGrowth.error?.error === 'forbidden');

// 6. Function-only tables reject direct client writes.
const forged = await a.client.from('chat_messages').insert({ child_id: childId, role: 'friend', content: 'forged' });
check('client cannot forge chat messages', Boolean(forged.error));
const forgedGrowth = await a.client.from('growth_profiles').insert({ child_id: childId, profile: { soulPoints: 9999 } });
check('client cannot forge growth', Boolean(forgedGrowth.error));

// 7. Chat works end to end (falls back to the safe answer without a Gemini key).
const chat = await invoke(a.client, 'chat', { mode: 'ask', childId, message: '노아는 왜 방주를 만들었어?' });
check('chat answers', typeof chat.data?.reply === 'string' && chat.data.reply.length > 0, JSON.stringify(chat.error ?? ''));
const stored = await a.client.from('chat_messages').select('role').eq('child_id', childId);
check('chat stored both turns', stored.data?.length === 2);

// 8. Safety screen short-circuits risky input without calling the model.
const risky = await invoke(a.client, 'chat', { mode: 'ask', childId, message: '너무 힘들어서 죽고 싶어' });
check('self-harm input gets the safe reply', risky.data?.flagged === true && risky.data.reply.includes('1388'));

// 9. Growth claims are idempotent and grant a treasure card once.
const first = await invoke(a.client, 'growth', { action: 'claim', childId, activity: 'scripture_read', sourceId: 'noah' });
const second = await invoke(a.client, 'growth', { action: 'claim', childId, activity: 'scripture_read', sourceId: 'noah' });
check('first story claim rewards', first.data?.claimed === true, JSON.stringify(first.error ?? ''));
check('second story claim is a no-op', second.data?.claimed === false);
check('wisdom XP counted once', first.data?.profile.wisdomXp === second.data?.profile.wisdomXp);
const cards = await a.client.from('treasure_cards').select('card_id').eq('child_id', childId);
check('treasure card granted once', cards.data?.length === 1);
const badSource = await invoke(a.client, 'growth', { action: 'claim', childId, activity: 'scripture_read', sourceId: 'not-a-story' });
check('unknown story rejected', badSource.error?.error === 'bad_request');

// 10. Quota counter moved.
const usage = await a.client.from('ai_usage').select('kind, units');
check('usage recorded', (usage.data ?? []).some((row) => row.kind === 'chat' && row.units >= 2));

// 11. Account deletion cascades.
const deleted = await invoke(a.client, 'delete-account', {});
check('account deleted', deleted.data?.deleted === true, JSON.stringify(deleted.error ?? ''));
const admin = createClient(URL, status.SECRET_KEY ?? status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const leftovers = await admin.from('children').select('id').eq('id', childId);
const leftoverChat = await admin.from('chat_messages').select('id').eq('child_id', childId);
check('child data removed with the account', (leftovers.data ?? []).length === 0 && (leftoverChat.data ?? []).length === 0);

await invoke(b.client, 'delete-account', {});
console.log(failures ? `\n${failures} check(s) failed` : '\nAll smoke checks passed');
process.exit(failures ? 1 : 0);
