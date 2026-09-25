// POST /functions/v1/growth
// The only writer of growth state: { action: 'get' | 'claim' | 'upgrade' }.
import { withSupabase } from '@supabase/server';
import { canUpgrade, growthRequestSchema, upgradeEquipment, type GrowthResponse } from '../_shared/core/index.ts';
import { claimGrowth, getGrowth, upgradeGrowth } from '../_shared/growth.ts';
import { requireChild, requireUserId } from '../_shared/guard.ts';
import { ApiError, handle, json, parseBody } from '../_shared/http.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, (req, ctx) =>
    handle(async () => {
      const guardianId = requireUserId(ctx.userClaims);
      const admin = ctx.supabaseAdmin;
      const body = await parseBody(req, growthRequestSchema);
      await requireChild(admin, guardianId, body.childId);

      if (body.action === 'get') {
        const response: GrowthResponse = {
          profile: await getGrowth(admin, body.childId),
          claimed: false,
          message: null,
          reward: null,
          stageChanged: false,
        };
        return json(response);
      }

      if (body.action === 'claim') {
        return json(await claimGrowth(admin, body.childId, body.activity, body.sourceId));
      }

      const current = await getGrowth(admin, body.childId);
      const check = canUpgrade(current, body.equipmentId);
      if (!check.ok) throw new ApiError('bad_request', check.reason);
      const profile = await upgradeGrowth(admin, body.childId, (p) => upgradeEquipment(p, body.equipmentId));
      const response: GrowthResponse = {
        profile,
        claimed: true,
        message: '장비가 한 단계 더 빛나기 시작했어요! ✨',
        reward: null,
        stageChanged: false,
      };
      return json(response);
    }),
  ),
};
