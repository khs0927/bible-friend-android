import type { ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors, space } from '@/theme';

import { Button, Mascot, Screen, T } from './ui';

/** Friendly crash screen used as the Expo Router ErrorBoundary. */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  if (__DEV__) console.error('[screen error]', error);
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Mascot pose="listen" size={120} />
        <T variant="title" style={styles.center}>
          앗, 잠깐 넘어졌어요
        </T>
        <T style={styles.center}>성경 친구가 다시 일어날 수 있게 도와줄래요?</T>
        {__DEV__ ? (
          <T variant="small" style={styles.detail} numberOfLines={4}>
            {error.message}
          </T>
        ) : null}
        <Button label="다시 해 보기" onPress={() => void retry()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', alignItems: 'stretch', padding: space.xl, gap: space.lg },
  center: { textAlign: 'center', alignSelf: 'center' },
  detail: { textAlign: 'center', color: colors.danger },
});
