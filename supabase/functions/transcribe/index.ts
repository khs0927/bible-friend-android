// POST /functions/v1/transcribe
// Speech-to-text for the child's voice questions: Gemini first, then
// open-source faster-whisper. Audio is processed in memory and never stored.
import { withSupabase } from '@supabase/server';
import { DAILY_LIMITS, MAX_AUDIO_BYTES, transcribeRequestSchema, type TranscribeResponse } from '../_shared/core/index.ts';
import { consumeQuota, requireConsent, requireUserId } from '../_shared/guard.ts';
import { ApiError, handle, json, parseBody } from '../_shared/http.ts';
import { base64ToBytes } from '../_shared/providers/audio.ts';
import { runChain, sttChain } from '../_shared/providers/index.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, (req, ctx) =>
    handle(async () => {
      const guardianId = requireUserId(ctx.userClaims);
      const admin = ctx.supabaseAdmin;
      const body = await parseBody(req, transcribeRequestSchema);

      let audio: Uint8Array;
      try {
        audio = base64ToBytes(body.audioBase64);
      } catch {
        throw new ApiError('bad_request');
      }
      if (audio.length > MAX_AUDIO_BYTES) throw new ApiError('bad_request');

      await requireConsent(admin, guardianId);
      const providers = sttChain();
      if (providers.length === 0) throw new ApiError('upstream_error', '음성 인식이 설정되지 않았어요.');
      await consumeQuota(admin, guardianId, 'transcribe', 1, DAILY_LIMITS.transcribe);

      // Android/iOS recordings are AAC in an MP4 container.
      const mimeType = body.mimeType === 'audio/m4a' ? 'audio/mp4' : body.mimeType;
      let outcome;
      try {
        outcome = await runChain(providers, (provider) => provider.transcribe({ audio, mimeType }));
      } catch {
        throw new ApiError('upstream_error');
      }
      const response: TranscribeResponse = { text: outcome.result.slice(0, 600), provider: outcome.provider.id };
      return json(response);
    }),
  ),
};
