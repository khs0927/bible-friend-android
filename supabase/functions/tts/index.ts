// POST /functions/v1/tts
// Returns a signed URL to a WAV rendering of the text. Renderings are cached in
// the private `tts-cache` bucket, keyed by model + voice + text, so repeated
// phrases (stories, greetings, verses) cost nothing after the first request.
import { withSupabase } from '@supabase/server';
import { DAILY_LIMITS, VOICE_PROFILES, speakableText, ttsRequestSchema, type TtsResponse } from '../_shared/core/index.ts';
import { MODELS, synthesizeSpeech } from '../_shared/gemini.ts';
import { consumeQuota, requireConsent, requireUserId } from '../_shared/guard.ts';
import { ApiError, handle, json, parseBody } from '../_shared/http.ts';

const BUCKET = 'tts-cache';
const URL_TTL_SECONDS = 60 * 60;

async function cacheKey(parts: string[]) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\u0000')));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  fetch: withSupabase({ auth: 'user' }, (req, ctx) =>
    handle(async () => {
      const guardianId = requireUserId(ctx.userClaims);
      const admin = ctx.supabaseAdmin;
      const body = await parseBody(req, ttsRequestSchema);
      await requireConsent(admin, guardianId);

      const text = speakableText(body.text);
      if (!text) throw new ApiError('bad_request');
      const profile = VOICE_PROFILES[body.speaker];
      const key = await cacheKey([MODELS.tts, profile.voice, profile.direction, text]);
      const path = `${MODELS.tts}/${profile.voice}/${key}.wav`;

      const existing = await admin.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SECONDS);
      if (existing.data?.signedUrl) {
        const response: TtsResponse = { url: existing.data.signedUrl, cached: true };
        return json(response);
      }

      await consumeQuota(admin, guardianId, 'tts_chars', text.length, DAILY_LIMITS.ttsChars);
      const wav = await synthesizeSpeech({ text, voice: profile.voice, direction: profile.direction });
      const upload = await admin.storage.from(BUCKET).upload(path, wav, {
        contentType: 'audio/wav',
        upsert: true,
      });
      if (upload.error) throw upload.error;

      const signed = await admin.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SECONDS);
      if (!signed.data?.signedUrl) throw signed.error ?? new ApiError('internal');
      const response: TtsResponse = { url: signed.data.signedUrl, cached: false };
      return json(response);
    }),
  ),
};
