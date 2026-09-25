// POST /functions/v1/chat
// The child's conversation with the Bible friend, plus prayer-verse suggestions.
// Order of checks: auth → consent → child ownership → quota → safety screen → model.
import { withSupabase } from '@supabase/server';
import {
  DAILY_LIMITS,
  FALLBACK_PRAYER_VERSE,
  PRAYER_VERSE_PROMPT,
  ageBand,
  buildSystemPrompt,
  chatRequestSchema,
  fallbackAnswer,
  getStory,
  prayerVerseSchema,
  sanitizeReply,
  screenChildInput,
  storyContext,
  type ChatAskResponse,
  type ChatPrayerVerseResponse,
} from '../_shared/core/index.ts';
import { generateJson, generateText, type ChatTurn } from '../_shared/gemini.ts';
import { claimGrowth } from '../_shared/growth.ts';
import { consumeQuota, requireChild, requireConsent, requireUserId } from '../_shared/guard.ts';
import { handle, json, parseBody } from '../_shared/http.ts';

const HISTORY_TURNS = 8;

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  fetch: withSupabase({ auth: 'user' }, (req, ctx) =>
    handle(async () => {
      const guardianId = requireUserId(ctx.userClaims);
      const admin = ctx.supabaseAdmin;
      const body = await parseBody(req, chatRequestSchema);

      await requireConsent(admin, guardianId);
      const child = await requireChild(admin, guardianId, body.childId);
      await consumeQuota(admin, guardianId, 'chat', 1, DAILY_LIMITS.chat);

      // --- Prayer verse suggestion (not stored as chat) ------------------------
      if (body.mode === 'prayer_verse') {
        const screen = screenChildInput(body.message);
        let suggestion = FALLBACK_PRAYER_VERSE as ChatPrayerVerseResponse['suggestion'];
        if (screen.category === 'ok') {
          const raw = await generateJson<unknown>({
            system: PRAYER_VERSE_PROMPT,
            prompt: `기도 내용: "${body.message}"`,
            schema: {
              type: 'OBJECT',
              properties: {
                verseRef: { type: 'STRING' },
                verseText: { type: 'STRING' },
                encouragement: { type: 'STRING' },
              },
              required: ['verseRef', 'verseText', 'encouragement'],
            },
          }).catch(() => null);
          const parsed = prayerVerseSchema.safeParse(raw);
          if (parsed.success) suggestion = parsed.data;
        }
        const response: ChatPrayerVerseResponse = { mode: 'prayer_verse', suggestion };
        return json(response);
      }

      // --- Conversation ----------------------------------------------------------
      const screen = screenChildInput(body.message);
      let reply: string;
      let flagged = screen.category !== 'ok';

      if (screen.cannedReply) {
        reply = screen.cannedReply;
      } else {
        const { data: history } = await admin
          .from('chat_messages')
          .select('role, content')
          .eq('child_id', child.id)
          .eq('flagged', false)
          .order('created_at', { ascending: false })
          .limit(HISTORY_TURNS);
        const turns: ChatTurn[] = (history ?? [])
          .reverse()
          .map((m) => ({ role: m.role === 'child' ? 'user' : 'model', text: m.content as string }));
        turns.push({ role: 'user', text: body.message });

        const story = body.storyId ? getStory(body.storyId) : undefined;
        try {
          const result = await generateText({
            system: buildSystemPrompt({
              ageBand: ageBand(child.birth_year),
              storyContext: story ? storyContext(story) : undefined,
            }),
            turns,
          });
          if (result.blocked) flagged = true;
          reply = result.blocked || !result.text ? fallbackAnswer(body.message) : sanitizeReply(result.text);
        } catch (error) {
          console.warn('[chat] model unavailable, using fallback', error);
          reply = fallbackAnswer(body.message);
        }
      }

      const { error: insertError } = await admin.from('chat_messages').insert([
        { child_id: child.id, role: 'child', content: body.message, story_id: body.storyId ?? null, flagged },
        { child_id: child.id, role: 'friend', content: reply, story_id: body.storyId ?? null, flagged },
      ]);
      if (insertError) console.error('[chat] could not store messages', insertError);

      let growth: ChatAskResponse['growth'] = null;
      if (!flagged) {
        const sourceId = (await sha256Hex(body.message.toLowerCase())).slice(0, 16);
        const result = await claimGrowth(admin, child.id, 'bible_conversation', sourceId).catch((error) => {
          console.warn('[chat] growth claim failed', error);
          return null;
        });
        if (result?.claimed && result.message) {
          growth = { claimed: true, message: result.message, stageChanged: result.stageChanged };
        }
      }

      const response: ChatAskResponse = { mode: 'ask', reply, flagged, growth };
      return json(response);
    }),
  ),
};
