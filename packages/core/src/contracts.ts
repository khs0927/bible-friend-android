// Request/response contracts shared by the mobile app and the Supabase Edge
// Functions. Both sides validate with these schemas.
import { z } from 'zod';
import { EQUIPMENT_IDS, GROWTH_ACTIVITY_TYPES } from './growth.ts';
import type { GrowthProfile, GrowthReward } from './growth.ts';
import { SPEAKERS } from './voices.ts';

export const FUNCTION_NAMES = {
  chat: 'chat',
  tts: 'tts',
  transcribe: 'transcribe',
  growth: 'growth',
  deleteAccount: 'delete-account',
} as const;

/** Per-guardian daily limits (all children of a guardian share them). */
export const DAILY_LIMITS = {
  chat: 150,
  ttsChars: 40_000,
  transcribe: 120,
} as const;

export const MAX_MESSAGE_CHARS = 600;
export const MAX_TTS_CHARS = 600;
/** ~1 minute of AAC audio. */
export const MAX_AUDIO_BYTES = 1_500_000;

const childId = z.uuid();

// --- chat -------------------------------------------------------------------

export const chatRequestSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('ask'),
    childId,
    message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
    storyId: z.string().max(40).optional(),
  }),
  z.object({
    mode: z.literal('prayer_verse'),
    childId,
    message: z.string().trim().min(1).max(300),
  }),
]);
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const prayerVerseSchema = z.object({
  verseRef: z.string().min(1).max(60),
  verseText: z.string().min(1).max(300),
  encouragement: z.string().min(1).max(300),
});
export type PrayerVerse = z.infer<typeof prayerVerseSchema>;

export interface GrowthUpdate {
  claimed: boolean;
  message: string;
  stageChanged: boolean;
}

export interface ChatAskResponse {
  mode: 'ask';
  reply: string;
  flagged: boolean;
  growth: GrowthUpdate | null;
}

export interface ChatPrayerVerseResponse {
  mode: 'prayer_verse';
  suggestion: PrayerVerse;
}

export type ChatResponse = ChatAskResponse | ChatPrayerVerseResponse;

// --- tts --------------------------------------------------------------------

export const ttsRequestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TTS_CHARS),
  speaker: z.enum(SPEAKERS).default('CHILD_FRIEND'),
});
export type TtsRequest = z.input<typeof ttsRequestSchema>;

export interface TtsResponse {
  /** Short-lived signed URL of a cached WAV file. */
  url: string;
  cached: boolean;
}

// --- transcribe -------------------------------------------------------------

export const AUDIO_MIME_TYPES = ['audio/mp4', 'audio/m4a', 'audio/aac', 'audio/webm', 'audio/wav'] as const;

export const transcribeRequestSchema = z.object({
  audioBase64: z
    .string()
    .min(16)
    .max(Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 4),
  mimeType: z.enum(AUDIO_MIME_TYPES),
});
export type TranscribeRequest = z.infer<typeof transcribeRequestSchema>;

export interface TranscribeResponse {
  text: string;
}

// --- growth -----------------------------------------------------------------

export const growthRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('get'), childId }),
  z.object({
    action: z.literal('claim'),
    childId,
    activity: z.enum(GROWTH_ACTIVITY_TYPES),
    sourceId: z.string().trim().min(1).max(80),
  }),
  z.object({
    action: z.literal('upgrade'),
    childId,
    equipmentId: z.enum(EQUIPMENT_IDS),
  }),
]);
export type GrowthRequest = z.input<typeof growthRequestSchema>;

export interface GrowthResponse {
  profile: GrowthProfile;
  claimed: boolean;
  message: string | null;
  reward: GrowthReward | null;
  stageChanged: boolean;
}

// --- errors -----------------------------------------------------------------

export const API_ERROR_CODES = [
  'unauthorized',
  'forbidden',
  'bad_request',
  'quota_exceeded',
  'upstream_error',
  'not_found',
  'internal',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  error: ApiErrorCode;
  message: string;
}

/** Child-facing wording for each error code. */
export const API_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  unauthorized: '다시 로그인해 주세요.',
  forbidden: '이 기능은 사용할 수 없어요.',
  bad_request: '조금 다르게 다시 말해 줄래?',
  quota_exceeded: '오늘은 성경 친구와 이야기를 많이 나눴어요. 내일 또 만나요! 🌙',
  upstream_error: '성경 친구가 잠깐 생각에 잠겼어요. 조금 뒤에 다시 해 볼까?',
  not_found: '찾을 수 없어요.',
  internal: '앗, 문제가 생겼어요. 잠시 뒤에 다시 해 볼까?',
};
