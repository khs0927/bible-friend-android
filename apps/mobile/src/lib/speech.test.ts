/* eslint-disable @typescript-eslint/no-require-imports -- modules are re-required after jest.resetModules() */
// Voice playback: server voice first, sentence by sentence; device voice when
// the server can't render; URLs built from the app's own Supabase origin.
const mockTts = jest.fn();
jest.mock('./api', () => ({ api: { tts: (...args: unknown[]) => mockTts(...args) } }));

type Listener = (status: { didJustFinish?: boolean }) => void;
const mockPlayed: string[] = [];
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => {
    let listener: Listener | null = null;
    return {
      addListener: (_event: string, fn: Listener) => {
        listener = fn;
        return { remove: () => (listener = null) };
      },
      replace: ({ uri }: { uri: string }) => mockPlayed.push(uri),
      play: () => setTimeout(() => listener?.({ didJustFinish: true }), 0),
      pause: jest.fn(),
    };
  }),
}));

const mockSpoken: string[] = [];
jest.mock('expo-speech', () => ({
  speak: (text: string, options: { onDone?: () => void }) => {
    mockSpoken.push(text);
    setTimeout(() => options.onDone?.(), 0);
  },
  stop: jest.fn(() => Promise.resolve()),
}));

describe('speech', () => {
  const ORIGINAL_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    jest.resetModules();
    mockTts.mockReset();
    mockPlayed.length = 0;
    mockSpoken.length = 0;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://10.0.2.2:54321/';
  });
  afterAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
  });

  it('plays server audio per sentence using the app-facing URL', async () => {
    mockTts.mockImplementation(({ text }: { text: string }) =>
      Promise.resolve({ url: 'http://kong:8000/x', path: `/storage/v1/object/sign/tts-cache/${text.length}.wav`, cached: false }),
    );
    const { speak } = require('./speech') as typeof import('./speech');
    await speak('첫 문장이에요. 두 번째 문장이에요! 😊', { id: 'm1' });

    expect(mockTts).toHaveBeenCalledTimes(1); // short text → one chunk
    const spokenText = mockTts.mock.calls[0][0].text as string;
    // Joined with the app's own origin (trailing slash trimmed), not the server's internal http://kong:8000.
    expect(mockPlayed).toEqual([`http://10.0.2.2:54321/storage/v1/object/sign/tts-cache/${spokenText.length}.wav`]);
    expect(mockTts.mock.calls[0][0].text).not.toContain('😊'); // emoji stripped before synthesis
    expect(mockSpoken).toEqual([]);
  });

  it('falls back to the on-device voice when the server voice fails', async () => {
    mockTts.mockRejectedValue(new Error('upstream_error'));
    const { speak } = require('./speech') as typeof import('./speech');
    await speak('하나님은 너를 사랑하셔.', { id: 'm2' });

    expect(mockPlayed).toEqual([]);
    expect(mockSpoken).toEqual(['하나님은 너를 사랑하셔.']);
  });

  it('reports which message is being read and clears it afterwards', async () => {
    mockTts.mockResolvedValue({ url: 'u', path: '/p.wav', cached: true });
    const speech = require('./speech') as typeof import('./speech');
    const pending = speech.speak('안녕!', { id: 'bubble-7' });
    expect(speech.getSpeakingId()).toBe('bubble-7');
    await pending;
    expect(speech.getSpeakingId()).toBeNull();
  });
});
