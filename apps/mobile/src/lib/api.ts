import {
  API_ERROR_MESSAGES,
  FUNCTION_NAMES,
  type ApiErrorBody,
  type ApiErrorCode,
  type ChatAskResponse,
  type ChatPrayerVerseResponse,
  type GrowthRequest,
  type GrowthResponse,
  type TranscribeRequest,
  type TranscribeResponse,
  type TtsRequest,
  type TtsResponse,
} from '@bible-friend/core';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from './supabase';

/** An error whose `message` is safe to show to a child. */
export class AppError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (!error) return data as T;
  if (error instanceof FunctionsHttpError) {
    const payload = (await (error.context as Response).json().catch(() => null)) as ApiErrorBody | null;
    const code = payload?.error ?? 'internal';
    throw new AppError(code, payload?.message ?? API_ERROR_MESSAGES[code]);
  }
  throw new AppError('upstream_error', '인터넷 연결을 확인해 줄래요?');
}

export function toFriendlyMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return API_ERROR_MESSAGES.internal;
}

export const api = {
  ask: (childId: string, message: string, storyId?: string) =>
    invoke<ChatAskResponse>(FUNCTION_NAMES.chat, { mode: 'ask', childId, message, storyId }),

  suggestPrayerVerse: (childId: string, message: string) =>
    invoke<ChatPrayerVerseResponse>(FUNCTION_NAMES.chat, { mode: 'prayer_verse', childId, message }),

  tts: (request: TtsRequest) => invoke<TtsResponse>(FUNCTION_NAMES.tts, { ...request }),

  transcribe: (request: TranscribeRequest) => invoke<TranscribeResponse>(FUNCTION_NAMES.transcribe, { ...request }),

  growth: (request: GrowthRequest) => invoke<GrowthResponse>(FUNCTION_NAMES.growth, { ...request }),

  deleteAccount: () => invoke<{ deleted: boolean }>(FUNCTION_NAMES.deleteAccount, {}),
};
