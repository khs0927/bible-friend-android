import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './http.ts';

export interface ChildRecord {
  id: string;
  guardian_id: string;
  nickname: string;
  birth_year: number | null;
}

/** Loads a child and verifies it belongs to the calling guardian. */
export async function requireChild(
  admin: SupabaseClient,
  guardianId: string,
  childId: string,
): Promise<ChildRecord> {
  const { data, error } = await admin
    .from('children')
    .select('id, guardian_id, nickname, birth_year')
    .eq('id', childId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.guardian_id !== guardianId) throw new ApiError('forbidden');
  return data as ChildRecord;
}

/** Requires that the guardian has given 법정대리인 consent before any AI use. */
export async function requireConsent(admin: SupabaseClient, guardianId: string): Promise<void> {
  const { data, error } = await admin
    .from('guardians')
    .select('consented_at')
    .eq('id', guardianId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.consented_at) throw new ApiError('forbidden', '보호자 동의가 필요해요.');
}

/** Atomically consumes daily quota; throws `quota_exceeded` when over the limit. */
export async function consumeQuota(
  admin: SupabaseClient,
  guardianId: string,
  kind: 'chat' | 'tts_chars' | 'transcribe',
  units: number,
  limit: number,
): Promise<void> {
  const { data, error } = await admin.rpc('consume_ai_quota', {
    p_guardian_id: guardianId,
    p_kind: kind,
    p_units: units,
    p_limit: limit,
  });
  if (error) throw error;
  if (data !== true) throw new ApiError('quota_exceeded');
}

export function requireUserId(userClaims: { id?: string } | null | undefined): string {
  const id = userClaims?.id;
  if (!id) throw new ApiError('unauthorized');
  return id;
}
