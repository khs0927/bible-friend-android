// POST /functions/v1/transcribe
// Speech-to-text for the child's voice questions. Audio is processed in memory
// and never stored.
import { withSupabase } from '@supabase/server';
import { DAILY_LIMITS, MAX_AUDIO_BYTES, transcribeRequestSchema, type TranscribeResponse } from '../_shared/core/index.ts';
import { transcribeAudio } from '../_shared/gemini.ts';
import { consumeQuota, requireConsent, requireUserId } from '../_shared/guard.ts';
import { ApiError, handle, json, parseBody } from '../_shared/http.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, (req, ctx) =>
    handle(async () => {
      const guardianId = requireUserId(ctx.userClaims);
      const admin = ctx.supabaseAdmin;
      const body = await parseBody(req, transcribeRequestSchema);
      if ((body.audioBase64.length * 3) / 4 > MAX_AUDIO_BYTES) throw new ApiError('bad_request');

      await requireConsent(admin, guardianId);
      await consumeQuota(admin, guardianId, 'transcribe', 1, DAILY_LIMITS.transcribe);

      // Android/iOS recordings are AAC in an MP4 container.
      const mimeType = body.mimeType === 'audio/m4a' ? 'audio/mp4' : body.mimeType;
      const text = await transcribeAudio({ base64: body.audioBase64, mimeType });
      const response: TranscribeResponse = { text: text.slice(0, 600) };
      return json(response);
    }),
  ),
};
