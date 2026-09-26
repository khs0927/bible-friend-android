import type { Speaker, VoiceProfile } from '../core/index.ts';

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface LlmProvider {
  id: string;
  chat(input: { system: string; turns: ChatTurn[]; maxOutputTokens?: number }): Promise<{ text: string; blocked: boolean }>;
  json(input: { system: string; prompt: string; schema: Record<string, unknown> }): Promise<unknown | null>;
}

export interface TtsProvider {
  id: string;
  /** Identifies the voice/model in the audio cache path. */
  cacheTag: string;
  synthesize(input: { text: string; speaker: Speaker; profile: VoiceProfile }): Promise<Uint8Array>;
}

export interface SttProvider {
  id: string;
  transcribe(input: { audio: Uint8Array; mimeType: string }): Promise<string>;
}
