import type { StoryAccent } from '@bible-friend/core';

export const colors = {
  background: '#FFF6E5',
  surface: '#FFFFFF',
  surfaceMuted: '#FFF0D6',
  primary: '#6B4FD8',
  primaryDark: '#4A31A8',
  primarySoft: '#ECE6FF',
  orange: '#FF8C24',
  orangeSoft: '#FFE7CC',
  coral: '#F36A50',
  mint: '#2FB88A',
  mintSoft: '#DDF6EC',
  blue: '#3C8CF0',
  gold: '#F2B233',
  text: '#33235E',
  textMuted: '#7A6E96',
  border: '#EADFC8',
  danger: '#D6453D',
  kakao: '#FEE500',
  kakaoText: '#191600',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const accentColors: Record<StoryAccent, { bg: string; fg: string }> = {
  coral: { bg: '#FFE1D9', fg: '#C2462F' },
  mint: { bg: '#DDF6EC', fg: '#1E8A66' },
  blue: { bg: '#DCEBFF', fg: '#2B6CC4' },
  violet: { bg: '#ECE6FF', fg: '#5B3FC4' },
  gold: { bg: '#FFF1CC', fg: '#A87A0F' },
};

export const fonts = {
  /** Rounded display face for titles and buttons. */
  display: 'Jua_400Regular',
  /** Friendly body face with good Hangul legibility. */
  body: 'GowunDodum_400Regular',
} as const;

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Children's text is intentionally large. */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38, color: colors.text },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.text },
  subtitle: { fontFamily: fonts.display, fontSize: 19, lineHeight: 25, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textMuted },
} as const;

export const shadow = {
  shadowColor: '#6B4FD8',
  shadowOpacity: 0.12,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
} as const;
