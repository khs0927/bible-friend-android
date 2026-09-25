import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BIBLE_STORIES,
  DAILY_CONVERSATION_REWARD_LIMIT,
  INITIAL_GROWTH_PROFILE,
  activityEventKey,
  claimActivity,
  getServiceMission,
  getVerse,
  normalizeProfile,
  seoulDateKey,
  settleProfile,
  treasureForStoryIndex,
  type GrowthActivityType,
  type GrowthProfile,
  type GrowthResponse,
} from './core/index.ts';
import { ApiError } from './http.ts';

interface StoredProfile {
  profile: GrowthProfile;
  /** `updated_at` of the row, used for optimistic concurrency. Null when no row exists yet. */
  version: string | null;
}

async function loadProfile(admin: SupabaseClient, childId: string): Promise<StoredProfile> {
  const { data, error } = await admin
    .from('growth_profiles')
    .select('profile, updated_at')
    .eq('child_id', childId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { profile: INITIAL_GROWTH_PROFILE, version: null };
  return { profile: normalizeProfile(data.profile), version: data.updated_at as string };
}

/** Compare-and-swap write; returns false when another request updated the row first. */
async function saveProfile(
  admin: SupabaseClient,
  childId: string,
  profile: GrowthProfile,
  version: string | null,
): Promise<boolean> {
  if (version === null) {
    const { error } = await admin.from('growth_profiles').insert({ child_id: childId, profile });
    if (error?.code === '23505') return false; // created concurrently
    if (error) throw error;
    return true;
  }
  const { data, error } = await admin
    .from('growth_profiles')
    .update({ profile })
    .eq('child_id', childId)
    .eq('updated_at', version)
    .select('child_id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function updateProfile(
  admin: SupabaseClient,
  childId: string,
  mutate: (profile: GrowthProfile) => GrowthProfile,
): Promise<GrowthProfile> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { profile, version } = await loadProfile(admin, childId);
    const next = mutate(profile);
    if (await saveProfile(admin, childId, next, version)) return next;
  }
  throw new ApiError('internal', '잠시 뒤에 다시 해 볼까?');
}

export async function getGrowth(admin: SupabaseClient, childId: string): Promise<GrowthProfile> {
  const { profile } = await loadProfile(admin, childId);
  return settleProfile(profile);
}

function validateSource(activity: GrowthActivityType, sourceId: string) {
  const ok =
    (activity === 'scripture_read' && BIBLE_STORIES.some((story) => story.id === sourceId)) ||
    (activity === 'verse_memorized' && Boolean(getVerse(sourceId))) ||
    (activity === 'service_mission' && Boolean(getServiceMission(sourceId))) ||
    activity === 'prayer' ||
    activity === 'bible_conversation' ||
    activity === 'wilderness_victory';
  if (!ok) throw new ApiError('bad_request');
}

async function conversationRewardsToday(admin: SupabaseClient, childId: string, now: Date) {
  const { count, error } = await admin
    .from('growth_events')
    .select('id', { count: 'exact', head: true })
    .eq('child_id', childId)
    .eq('activity', 'bible_conversation')
    .like('event_key', `bible_conversation:${seoulDateKey(now)}:%`);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Grants an activity reward exactly once per idempotency key. Repeated claims
 * return the current profile with `claimed: false`.
 */
export async function claimGrowth(
  admin: SupabaseClient,
  childId: string,
  activity: GrowthActivityType,
  sourceId: string,
  now: Date = new Date(),
): Promise<GrowthResponse> {
  validateSource(activity, sourceId);
  const unchanged = async (message: string | null): Promise<GrowthResponse> => ({
    profile: await getGrowth(admin, childId),
    claimed: false,
    message,
    reward: null,
    stageChanged: false,
  });

  if (
    activity === 'bible_conversation' &&
    (await conversationRewardsToday(admin, childId, now)) >= DAILY_CONVERSATION_REWARD_LIMIT
  ) {
    return unchanged(null);
  }

  const eventKey = activityEventKey(activity, sourceId, now);
  const { error: eventError } = await admin.from('growth_events').insert({
    child_id: childId,
    event_key: eventKey,
    activity,
    source_id: sourceId,
  });
  if (eventError?.code === '23505') return unchanged('오늘은 이미 받은 선물이에요. 내일 또 만나요!');
  if (eventError) throw eventError;

  let result: ReturnType<typeof claimActivity> | null = null;
  const profile = await updateProfile(admin, childId, (current) => {
    result = claimActivity(current, activity, now);
    return result.profile;
  });
  const claimed = result as ReturnType<typeof claimActivity> | null;

  await admin.from('growth_events').update({ reward: claimed?.reward ?? {} }).eq('child_id', childId).eq('event_key', eventKey);

  if (activity === 'scripture_read') {
    const index = BIBLE_STORIES.findIndex((story) => story.id === sourceId);
    const card = treasureForStoryIndex(Math.max(0, index));
    await admin
      .from('treasure_cards')
      .upsert({ child_id: childId, card_id: card.id }, { onConflict: 'child_id,card_id', ignoreDuplicates: true });
  }

  return {
    profile,
    claimed: true,
    message: claimed?.message ?? null,
    reward: claimed?.reward ?? null,
    stageChanged: claimed?.stageChanged ?? false,
  };
}

export async function upgradeGrowth(
  admin: SupabaseClient,
  childId: string,
  mutate: (profile: GrowthProfile) => GrowthProfile,
): Promise<GrowthProfile> {
  return updateProfile(admin, childId, (current) => mutate(settleProfile(current)));
}
