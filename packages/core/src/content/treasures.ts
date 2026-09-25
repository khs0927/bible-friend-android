export interface TreasureCard {
  id: string;
  title: string;
  verseRef: string;
  verseText: string;
  emoji: string;
}

export const TREASURE_CARDS: TreasureCard[] = [
  { id: 'card-love-1', title: '사랑의 선물', verseRef: '요한복음 3:16', verseText: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니', emoji: '💖' },
  { id: 'card-courage-1', title: '두려움 없는 용기', verseRef: '여호수아 1:9', verseText: '강하고 담대하라 두려워하지 말며 놀라지 말라', emoji: '🛡️' },
  { id: 'card-wisdom-1', title: '빛나는 지혜', verseRef: '잠언 3:5', verseText: '너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라', emoji: '🌟' },
  { id: 'card-peace-1', title: '기쁨과 평안', verseRef: '빌립보서 4:4', verseText: '주 안에서 항상 기뻐하라 내가 다시 말하노니 기뻐하라', emoji: '🕊️' },
  { id: 'card-shepherd-1', title: '든든한 목자', verseRef: '시편 23:1', verseText: '여호와는 나의 목자시니 내게 부족함이 없으리로다', emoji: '🌿' },
];

export function getTreasureCard(id: string): TreasureCard | undefined {
  return TREASURE_CARDS.find((card) => card.id === id);
}

/** Completing the n-th story grants the n-th treasure card (wrapping around). */
export function treasureForStoryIndex(index: number): TreasureCard {
  return TREASURE_CARDS[index % TREASURE_CARDS.length] ?? TREASURE_CARDS[0]!;
}
