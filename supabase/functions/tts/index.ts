// POST /functions/v1/tts
// Returns a signed URL to a WAV rendering of the text.
//
// Providers are tried in preference order (see _shared/providers): Gemini TTS
// models, then open-source Qwen3-TTS (GPU) and Supertonic 3 (CPU). Renderings
// are cached per provider in the private `tts-cache` bucket; a cached rendering
// from the most preferred provider wins, so repeated phrases cost nothing.
import { withSupabase } from '@supabase/server';
import { DAILY_LIMITS, VOICE_PROFILES, speakableText, ttsRequestSchema, type TtsResponse } from '../_shared/core/index.ts';
import { consumeQuota, requireConsent, requireUserId } from '../_shared/guard.ts';
import { ApiError, handle, json, parseBody } from '../_shared/http.ts';
import { runChain, ttsChain } from '../_shared/providers/index.ts';

const BUCKET = 'tts-cache';
const URL_TTL_SECONDS = 60 * 60;

function relativePath(url: string) {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
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
      const providers = ttsChain();
      if (providers.length === 0) throw new ApiError('upstream_error', '음성 서비스가 설정되지 않았어요.');

      const textKey = await sha256(`${body.speaker}\u0000${text}`);
      const pathFor = (tag: string) => `${tag}/${textKey}.wav`;

      // 1. Cached rendering, most preferred provider first.
      const paths = providers.map((provider) => pathFor(provider.cacheTag));
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrls(paths, URL_TTL_SECONDS);
      for (let i = 0; i < paths.length; i += 1) {
        const hit = signed?.find((entry) => entry.path === paths[i] && entry.signedUrl && !entry.error);
        if (hit?.signedUrl) {
          const response: TtsResponse = {
            url: hit.signedUrl,
            path: relativePath(hit.signedUrl),
            cached: true,
            provider: providers[i]!.id,
          };
          return json(response);
        }
      }

      // 2. Synthesize through the chain.
      await consumeQuota(admin, guardianId, 'tts_chars', text.length, DAILY_LIMITS.ttsChars);
      let outcome;
      try {
        outcome = await runChain(providers, (provider) => provider.synthesize({ text, speaker: body.speaker, profile }));
      } catch {
        throw new ApiError('upstream_error');
      }
      const path = pathFor(outcome.provider.cacheTag);
      const upload = await admin.storage.from(BUCKET).upload(path, outcome.result, {
        contentType: 'audio/wav',
        upsert: true,
      });
      if (upload.error) throw upload.error;

      const url = await admin.storage.from(BUCKET).createSignedUrl(path, URL_TTL_SECONDS);
      if (!url.data?.signedUrl) throw url.error ?? new ApiError('internal');
      const response: TtsResponse = {
        url: url.data.signedUrl,
        path: relativePath(url.data.signedUrl),
        cached: false,
        provider: outcome.provider.id,
      };
      return json(response);
    }),
  ),
};
