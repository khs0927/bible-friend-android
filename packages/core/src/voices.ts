export const SPEAKERS = ['CHILD_FRIEND', 'NARRATOR', 'JESUS', 'DAVID', 'PETER', 'MARY'] as const;
export type Speaker = (typeof SPEAKERS)[number];

export interface VoiceProfile {
  /** Gemini prebuilt voice name. */
  voice: string;
  /** Natural-language delivery direction prepended to the text. */
  direction: string;
}

// Character moods are described in words only; no real person's voice is cloned.
export const VOICE_PROFILES: Record<Speaker, VoiceProfile> = {
  CHILD_FRIEND: { voice: 'Leda', direction: '어린이에게 말하듯 밝고 다정하게, 또렷하고 천천히 읽어 줘' },
  NARRATOR: { voice: 'Sulafat', direction: '따뜻한 동화 구연가처럼 차분하고 포근하게 읽어 줘' },
  JESUS: { voice: 'Vindemiatrix', direction: '온화하고 사랑이 가득한 목소리로 부드럽게 읽어 줘' },
  DAVID: { voice: 'Puck', direction: '용기 있고 씩씩한 소년처럼 힘차게 읽어 줘' },
  PETER: { voice: 'Fenrir', direction: '열정적이고 솔직한 어부처럼 생동감 있게 읽어 줘' },
  MARY: { voice: 'Achernar', direction: '부드럽고 다정한 목소리로 읽어 줘' },
};

/** Splits long text at Korean sentence boundaries so playback can start early. */
export function splitForSpeech(text: string, maxChars = 220): string[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。…])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
    } else if ((current + ' ' + sentence).length <= maxChars) {
      current = `${current} ${sentence}`;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks.flatMap((chunk) =>
    chunk.length <= maxChars ? [chunk] : chunk.match(new RegExp(`.{1,${maxChars}}`, 'gsu')) ?? [],
  );
}

/** Removes emoji and symbols the TTS engine would read aloud awkwardly. */
export function speakableText(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[~*_#>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
