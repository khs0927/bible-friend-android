// POST /functions/v1/delete-account
// Permanently deletes the guardian's account. All child data is removed through
// ON DELETE CASCADE (guardians → children → activity tables). Required by the
// App Store / Play Store account-deletion policies.
import { withSupabase } from '@supabase/server';
import { requireUserId } from '../_shared/guard.ts';
import { ApiError, handle, json } from '../_shared/http.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, (req, ctx) =>
    handle(async () => {
      if (req.method !== 'POST') throw new ApiError('bad_request');
      const guardianId = requireUserId(ctx.userClaims);
      const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(guardianId);
      if (error) throw error;
      return json({ deleted: true });
    }),
  ),
};
