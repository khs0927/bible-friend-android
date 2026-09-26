// Reads text aloud with the Bible friend's voice.
//
// Server voice (Gemini TTS via the `tts` function, cached in Storage) is used
// first, sentence by sentence, prefetching the next sentence while the current
// one plays. If the server voice is unavailable the on-device voice (expo-speech)
// takes over, so the child always hears an answer.
import { splitForSpeech, speakableText, type Speaker } from '@bible-friend/core';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { api } from './api';

/** Audio URLs are joined with the app's own Supabase URL (see TtsResponse.path). */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');

type Listener = () => void;

let speakingId: string | null = null;
let generation = 0;
let player: AudioPlayer | null = null;
const listeners = new Set<Listener>();
let audioModeReady = false;

function setSpeaking(id: string | null) {
  speakingId = id;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The id passed to `speak` for the utterance currently playing, or null. */
export function getSpeakingId(): string | null {
  return speakingId;
}

export function useSpeakingId(): string | null {
  return useSyncExternalStore(subscribe, getSpeakingId);
}

async function ensureAudioMode() {
  if (audioModeReady) return;
  audioModeReady = true;
  // Play through the speaker even when the phone is on silent (iOS).
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {
    audioModeReady = false;
  });
}

function playUrl(url: string, myGeneration: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!player) player = createAudioPlayer(null);
    const current = player;
    const subscription = current.addListener('playbackStatusUpdate', (status) => {
      if (myGeneration !== generation) {
        subscription.remove();
        resolve();
      } else if (status.didJustFinish) {
        subscription.remove();
        resolve();
      }
    });
    try {
      current.replace({ uri: url });
      current.play();
    } catch (error) {
      subscription.remove();
      reject(error);
    }
  });
}

function speakOnDevice(text: string, myGeneration: number): Promise<void> {
  return new Promise((resolve) => {
    if (myGeneration !== generation) return resolve();
    Speech.speak(text, {
      language: 'ko-KR',
      rate: 0.95,
      pitch: 1.1,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: () => resolve(),
    });
  });
}

export function stopSpeaking() {
  generation += 1;
  player?.pause();
  void Speech.stop();
  setSpeaking(null);
}

/**
 * Speaks `text`. Calling again (or `stopSpeaking`) interrupts the current
 * utterance. `id` lets UI highlight which message is being read.
 */
export async function speak(text: string, options: { id: string; speaker?: Speaker }) {
  stopSpeaking();
  const myGeneration = generation;
  const chunks = splitForSpeech(speakableText(text));
  if (chunks.length === 0) return;
  setSpeaking(options.id);
  await ensureAudioMode();

  const fetchUrl = (chunk: string) =>
    api
      .tts({ text: chunk, speaker: options.speaker ?? 'CHILD_FRIEND' })
      .then((result) => (supabaseUrl ? `${supabaseUrl}${result.path}` : result.url));

  let serverVoice = true;
  let next: Promise<string> | null = fetchUrl(chunks[0]!);
  try {
    for (let i = 0; i < chunks.length; i += 1) {
      if (myGeneration !== generation) return;
      const chunk = chunks[i]!;
      const current = next;
      next = serverVoice && i + 1 < chunks.length ? fetchUrl(chunks[i + 1]!) : null;
      next?.catch(() => undefined); // handled when awaited

      if (serverVoice && current) {
        try {
          await playUrl(await current, myGeneration);
          continue;
        } catch (error) {
          console.warn('[speech] server voice unavailable, using device voice', error);
          serverVoice = false;
        }
      }
      await speakOnDevice(chunk, myGeneration);
    }
  } finally {
    if (myGeneration === generation) setSpeaking(null);
  }
}

/** Reading aloud stops when the app leaves the foreground. */
export function useStopSpeakingInBackground() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stopSpeaking();
    });
    return () => subscription.remove();
  }, []);
}
