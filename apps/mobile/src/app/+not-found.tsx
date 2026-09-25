import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, EmptyState, Screen } from '@/components/ui';
import { space } from '@/theme';

export default function NotFound() {
  return (
    <Screen>
      <View style={styles.content}>
        <EmptyState title="길을 잃었어요" body="처음 화면으로 돌아갈까요?" />
        <Button label="처음으로" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.lg },
});
