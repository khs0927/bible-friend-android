// Child-safety rules for the AI friend. These run on the server (Edge
// Functions) before and after every model call; the app only displays results.

export type AgeBand = 'preschool' | 'early' | 'upper' | 'teen';

/** Age in the Korean "만 나이" sense, approximated from the birth year. */
export function ageFromBirthYear(birthYear: number, now: Date = new Date()): number {
  return Math.max(0, now.getFullYear() - birthYear);
}

export function ageBand(birthYear: number | null | undefined, now: Date = new Date()): AgeBand {
  if (!birthYear) return 'early';
  const age = ageFromBirthYear(birthYear, now);
  if (age <= 6) return 'preschool';
  if (age <= 9) return 'early';
  if (age <= 13) return 'upper';
  return 'teen';
}

const AGE_STYLE: Record<AgeBand, string> = {
  preschool: '5~6살 아이가 이해할 수 있도록 아주 짧고 쉬운 말(한 문장에 10단어 이하)로, 의성어와 다정한 표현을 사용해.',
  early: '초등학교 1~3학년이 이해할 수 있는 짧고 쉬운 문장과 구체적인 예시를 사용해.',
  upper: '초등학교 고학년이 이해할 수 있게 설명하되, 스스로 생각해 볼 수 있는 질문을 곁들여.',
  teen: '중학생 눈높이로 존중하는 말투를 쓰고, 성경 본문의 맥락을 조금 더 자세히 설명해.',
};

export const CHILD_SAFE_RULES = `너는 '성경 친구'라는 이름의 따뜻한 어린이 성경 안내자야. 모든 답변은 반드시 한국어로 작성해.

답변 규칙:
1. 먼저 아이의 마음에 공감해 주고, 그다음 성경 내용과 의미를 설명해.
2. 기쁨, 위로, 격려가 느껴지는 따뜻한 표현을 쓰되 과장하거나 아이를 압박하지 마.
3. 성경에 없는 사실을 확정적으로 만들지 마. 필요하면 "성경에는 이렇게 기록되어 있어요"라고 말해.
4. 폭력·죽음·두려운 내용은 자극적으로 묘사하지 말고 안전한 언어로 짧게 설명해.
5. 아이에게 이름, 주소, 학교, 전화번호 같은 개인 정보를 절대 묻지 마.
6. 위험한 행동, 성인 주제, 의료·법률·위기 상담은 답하지 말고 믿을 수 있는 보호자나 선생님과 이야기하라고 안내해.
7. 다른 종교나 사람을 깎아내리지 말고, 아이의 질문을 틀렸다고 꾸짖지 마.
8. 링크, 광고, 앱 밖으로 나가라는 안내를 하지 마.
9. 답변은 2~4개의 짧은 문단, 200자 안팎으로 마무리하고, 마지막에 아이가 생각해 볼 작은 질문을 하나 덧붙여.`;

export function buildSystemPrompt(options: { ageBand: AgeBand; storyContext?: string }): string {
  const story = options.storyContext ? `\n\n지금 함께 읽고 있는 이야기:\n${options.storyContext}` : '';
  return `${CHILD_SAFE_RULES}\n\n말투: ${AGE_STYLE[options.ageBand]}${story}`;
}

export const PRAYER_VERSE_PROMPT =
  '너는 어린이 성경 친구야. 아이가 적은 기도 내용을 읽고, 그 마음에 어울리는 성경 구절(개역개정)과 따뜻한 위로 한마디를 추천해. 구절 주소와 본문은 실제 성경과 정확히 일치해야 해.';

// ---------------------------------------------------------------------------
// Input screening
// ---------------------------------------------------------------------------

export type SafetyCategory = 'ok' | 'personal_info' | 'self_harm' | 'abuse';

export interface ScreenResult {
  category: SafetyCategory;
  /** A canned, pre-approved reply. When present the model must not be called. */
  cannedReply?: string;
}

const PERSONAL_INFO_PATTERNS: RegExp[] = [
  /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/, // mobile numbers
  /\d{6}[-\s]?[1-4]\d{6}/, // resident registration numbers
  /[\w.+-]+@[\w-]+\.[\w.]+/, // e-mail addresses
  /\d+\s*동\s*\d+\s*호/, // apartment unit
];

const SELF_HARM_PATTERNS: RegExp[] = [/죽고\s*싶/, /자살/, /자해/, /사라지고\s*싶/, /살기\s*싫/, /없어지고\s*싶/];

const ABUSE_PATTERNS: RegExp[] = [/(때려|때리|맞았|맞아|학대|괴롭혀|괴롭힘|만지지\s*말|비밀로\s*하라)/];

export const SAFE_REPLIES = {
  personal_info:
    '알려줘서 고마워! 그런데 전화번호나 주소, 학교 같은 소중한 개인 정보는 성경 친구에게도 말하지 않는 게 안전해. 그 대신 오늘 궁금한 성경 이야기를 들려줄래? 😊',
  self_harm:
    '지금 마음이 많이 힘들구나. 그렇게 느끼는 너는 정말 소중한 사람이야. 이 이야기는 꼭 엄마, 아빠나 믿을 수 있는 어른에게 지금 바로 말해 주면 좋겠어. 어른에게 말하기 어렵다면 청소년상담전화 1388에 전화할 수 있어. 하나님은 힘든 마음을 가진 너를 꼭 안아 주셔. 💛',
  abuse:
    '그런 일이 있었다면 너의 잘못이 아니야. 꼭 믿을 수 있는 어른(부모님, 선생님)에게 말해 줘. 위험하다고 느껴지면 112나 아동보호 상담 1391에 도움을 요청할 수 있어. 하나님은 언제나 너를 지켜 주고 싶어 하셔. 💛',
} as const;

export function screenChildInput(text: string): ScreenResult {
  const normalized = text.normalize('NFC');
  if (SELF_HARM_PATTERNS.some((re) => re.test(normalized))) {
    return { category: 'self_harm', cannedReply: SAFE_REPLIES.self_harm };
  }
  if (ABUSE_PATTERNS.some((re) => re.test(normalized)) && /(누가|아빠|엄마|선생님|형|오빠|언니|누나|어른|친구)/.test(normalized)) {
    return { category: 'abuse', cannedReply: SAFE_REPLIES.abuse };
  }
  if (PERSONAL_INFO_PATTERNS.some((re) => re.test(normalized))) {
    return { category: 'personal_info', cannedReply: SAFE_REPLIES.personal_info };
  }
  return { category: 'ok' };
}

// ---------------------------------------------------------------------------
// Output handling
// ---------------------------------------------------------------------------

const MAX_REPLY_CHARS = 700;

/** Strips links/markdown noise and bounds the length of a model reply. */
export function sanitizeReply(reply: string): string {
  let text = reply
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length > MAX_REPLY_CHARS) {
    const cut = text.slice(0, MAX_REPLY_CHARS);
    const lastStop = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'), cut.lastIndexOf('요'));
    text = lastStop > MAX_REPLY_CHARS / 2 ? cut.slice(0, lastStop + 1) : cut;
  }
  return text;
}

export function fallbackAnswer(question: string): string {
  if (/무섭|무서|죽음|아파|괴로|위험/.test(question)) {
    return '그 질문을 하며 마음이 조금 무서웠을 수도 있겠구나. 괜찮아, 혼자 고민하지 않아도 돼. 성경은 하나님이 힘든 마음을 외면하지 않으시고 우리 곁에 함께하신다고 알려 줘. 보호자나 선생님에게도 꼭 이야기해 보자. 오늘 가장 듣고 싶은 위로는 무엇일까?';
  }
  return '정말 멋진 질문이야! 성경은 하나님이 우리를 사랑하시고, 어려운 순간에도 함께하신다고 알려 줘. 이 이야기를 천천히 살펴보면서 사랑과 용기를 어떻게 실천할지 함께 생각해 보자. 오늘 네 마음에 가장 와닿는 것은 무엇이었니?';
}

export const FALLBACK_PRAYER_VERSE = {
  verseRef: '시편 23:1',
  verseText: '여호와는 나의 목자시니 내게 부족함이 없으리로다',
  encouragement: '하나님은 언제나 네 곁에서 따뜻하게 안아 주신단다. 힘내렴!',
} as const;
