// Records the child's voice and turns it into text with the `transcribe` function.
import { MAX_AUDIO_BYTES } from '@bible-friend/core';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useCallback, useState } from 'react';

import { AppError, api } from './api';
import { stopSpeaking } from './speech';

/** Mono, 16 kHz AAC — small uploads, plenty for speech recognition. */
const SPEECH_PRESET = {
  ...RecordingPresets.LOW_QUALITY,
  sampleRate: 16_000,
  numberOfChannels: 1,
  bitRate: 32_000,
};

const MAX_SECONDS = 45;

export type VoiceInputState = 'idle' | 'recording' | 'transcribing';

export function useVoiceInput(onText: (text: string) => void) {
  const recorder = useAudioRecorder(SPEECH_PRESET);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    stopSpeaking();
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('마이크를 쓸 수 있게 보호자에게 허락을 받아 주세요.');
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record({ forDuration: MAX_SECONDS });
  }, [recorder]);

  const stop = useCallback(async () => {
    await recorder.stop();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    const uri = recorder.uri;
    if (!uri) return;
    setTranscribing(true);
    try {
      const file = new File(uri);
      if (file.size > MAX_AUDIO_BYTES) throw new AppError('bad_request', '조금 더 짧게 말해 줄래요?');
      const audioBase64 = await file.base64();
      const { text } = await api.transcribe({ audioBase64, mimeType: 'audio/mp4' });
      file.delete();
      if (text.trim()) onText(text.trim());
      else setError('잘 들리지 않았어요. 한 번 더 말해 줄래요?');
    } catch (cause) {
      setError(cause instanceof AppError ? cause.message : '잘 들리지 않았어요. 한 번 더 말해 줄래요?');
    } finally {
      setTranscribing(false);
    }
  }, [recorder, onText]);

  const state: VoiceInputState = recorderState.isRecording ? 'recording' : transcribing ? 'transcribing' : 'idle';
  return {
    state,
    error,
    durationSeconds: Math.floor((recorderState.durationMillis ?? 0) / 1000),
    toggle: state === 'recording' ? stop : start,
  };
}
