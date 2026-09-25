import { describe, expect, it } from 'vitest';
import { ageBand, buildSystemPrompt, sanitizeReply, screenChildInput } from './safety.ts';
import { chatRequestSchema, growthRequestSchema, transcribeRequestSchema } from './contracts.ts';
import { recitationMatches, verseOfTheDay } from './content/verses.ts';
import { speakableText, splitForSpeech } from './voices.ts';

describe('input screening', () => {
  it('passes ordinary Bible questions', () => {
    expect(screenChildInput('노아는 왜 방주를 만들었어?').category).toBe('ok');
    expect(screenChildInput('다윗은 골리앗을 어떻게 이겼어?').category).toBe('ok');
  });

  it('routes self-harm statements to a safe reply with a helpline', () => {
    const result = screenChildInput('요즘 너무 힘들어서 죽고 싶어');
    expect(result.category).toBe('self_harm');
    expect(result.cannedReply).toContain('1388');
  });

  it('routes possible abuse disclosures to a safe reply', () => {
    const result = screenChildInput('아빠가 자꾸 때려');
    expect(result.category).toBe('abuse');
    expect(result.cannedReply).toContain('1391');
  });

  it('stops children from sharing personal information', () => {
    expect(screenChildInput('내 번호는 010-1234-5678이야').category).toBe('personal_info');
    expect(screenChildInput('우리집은 101동 1203호야').category).toBe('personal_info');
  });
});

describe('prompts and replies', () => {
  it('adapts the tone to the age band', () => {
    const now = new Date('2026-09-01');
    expect(ageBand(2021, now)).toBe('preschool');
    expect(ageBand(2018, now)).toBe('early');
    expect(ageBand(2014, now)).toBe('upper');
    expect(ageBand(null, now)).toBe('early');
    expect(buildSystemPrompt({ ageBand: 'preschool' })).toContain('5~6살');
  });

  it('strips links and markdown from model replies', () => {
    expect(sanitizeReply('**좋은 질문!** https://example.com 을 봐')).toBe('좋은 질문!  을 봐');
    expect(sanitizeReply('가'.repeat(2000)).length).toBeLessThanOrEqual(700);
  });
});

describe('contracts', () => {
  it('validates chat requests', () => {
    const childId = '8f14e45f-ceea-4e7a-9f3a-6f2b8a1c0d11';
    expect(chatRequestSchema.safeParse({ mode: 'ask', childId, message: '안녕' }).success).toBe(true);
    expect(chatRequestSchema.safeParse({ mode: 'ask', childId, message: '' }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ mode: 'ask', childId: 'nope', message: '안녕' }).success).toBe(false);
  });

  it('validates growth and transcribe requests', () => {
    const childId = '8f14e45f-ceea-4e7a-9f3a-6f2b8a1c0d11';
    expect(growthRequestSchema.safeParse({ action: 'claim', childId, activity: 'prayer', sourceId: 'x' }).success).toBe(true);
    expect(growthRequestSchema.safeParse({ action: 'claim', childId, activity: 'hack', sourceId: 'x' }).success).toBe(false);
    expect(transcribeRequestSchema.safeParse({ audioBase64: 'A'.repeat(32), mimeType: 'audio/mp4' }).success).toBe(true);
    expect(transcribeRequestSchema.safeParse({ audioBase64: 'A'.repeat(32), mimeType: 'video/mp4' }).success).toBe(false);
  });
});

describe('verses and speech helpers', () => {
  it('accepts recitations with small differences', () => {
    const verse = '여호와는 나의 목자시니 내게 부족함이 없으리로다';
    expect(recitationMatches(verse, '여호와는 나의 목자시니, 내게 부족함이 없으리로다!')).toBe(true);
    expect(recitationMatches(verse, '여호와는 나의 목자시니 부족함이 없으리로다')).toBe(true);
    expect(recitationMatches(verse, '하나님은 사랑이시라')).toBe(false);
  });

  it('picks the same verse for the same day', () => {
    expect(verseOfTheDay('2026-09-01')).toEqual(verseOfTheDay('2026-09-01'));
  });

  it('prepares text for speech', () => {
    expect(speakableText('안녕! 😊 반가워 🌈')).toBe('안녕! 반가워');
    const chunks = splitForSpeech('첫 문장이에요. 두 번째 문장이에요! 세 번째예요?', 12);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toBe('첫 문장이에요. 두 번째 문장이에요! 세 번째예요?');
  });
});
