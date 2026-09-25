import * as Haptics from 'expo-haptics';
import { Image, type ImageSource } from 'expo-image';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, radius, shadow, space, type } from '@/theme';

export const mascots = {
  wave: require('@/assets/images/friend/mascot-wave.png'),
  listen: require('@/assets/images/friend/mascot-listen.png'),
  teach: require('@/assets/images/friend/mascot-teach.png'),
  full: require('@/assets/images/friend/mascot.png'),
} satisfies Record<string, ImageSource>;

export type MascotPose = keyof typeof mascots;

export function Screen({
  children,
  edges = ['top'],
  style,
}: PropsWithChildren<{ edges?: Edge[]; style?: StyleProp<ViewStyle> }>) {
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

type TextVariant = keyof typeof type;

export function T({ variant = 'body', style, ...rest }: TextProps & { variant?: TextVariant }) {
  return <Text {...rest} style={[type[variant], style]} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'kakao' | 'dark' | 'danger';

const buttonColors: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.white },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.primarySoft },
  ghost: { bg: 'transparent', fg: colors.primary },
  kakao: { bg: colors.kakao, fg: colors.kakaoText },
  dark: { bg: colors.black, fg: colors.white },
  danger: { bg: colors.surface, fg: colors.danger, border: '#F5C8C4' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress?: PressableProps['onPress'];
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const palette = buttonColors[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={(event) => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border ?? palette.bg,
          opacity: inactive ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={palette.fg} /> : icon}
      <Text style={[styles.buttonLabel, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        { transform: [{ scale: pressed ? 0.96 : 1 }] },
      ]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value, color = colors.primary }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      style={styles.progressTrack}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Mascot({ pose = 'wave', size = 96 }: { pose?: MascotPose; size?: number }) {
  return (
    <Image
      source={mascots[pose]}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityIgnoresInvertColors
      accessible={false}
    />
  );
}

export function EmptyState({ title, body, pose = 'listen' }: { title: string; body?: string; pose?: MascotPose }) {
  return (
    <View style={styles.empty}>
      <Mascot pose={pose} size={88} />
      <T variant="subtitle" style={styles.center}>
        {title}
      </T>
      {body ? (
        <T variant="small" style={styles.center}>
          {body}
        </T>
      ) : null}
    </View>
  );
}

export function Loading({ label = '준비하고 있어요…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
      <T variant="small">{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  button: {
    minHeight: 54,
    borderRadius: radius.pill,
    borderWidth: 2,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonLabel: { fontFamily: type.subtitle.fontFamily, fontSize: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    ...shadow,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primarySoft,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { fontFamily: type.subtitle.fontFamily, fontSize: 15, color: colors.primary },
  chipLabelSelected: { color: colors.white },
  progressTrack: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill },
  empty: { alignItems: 'center', gap: space.sm, padding: space.xl },
  center: { textAlign: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
});
