import { BIBLE_STORIES, seoulDateKey, verseOfTheDay } from '@bible-friend/core';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Screen, T } from '@/components/ui';
import { useTreasures } from '@/lib/queries';
import { useActiveChild } from '@/lib/session';
import { accentColors, colors, radius, shadow, space } from '@/theme';

export default function StoriesScreen() {
  const child = useActiveChild();
  const treasures = useTreasures(child.id);
  const verse = verseOfTheDay(seoulDateKey());

  return (
    <Screen>
      <FlatList
        data={BIBLE_STORIES}
        keyExtractor={(story) => story.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <T variant="title">성경 이야기</T>
            <Card style={styles.verseCard}>
              <T variant="small" style={styles.verseLabel}>
                오늘의 말씀 · {verse.theme}
              </T>
              <T variant="subtitle">{verse.text}</T>
              <T variant="small">{verse.ref}</T>
            </Card>
            <T variant="small">이야기를 끝까지 읽으면 보물 카드를 받아요! ({treasures.data?.length ?? 0}장 모음)</T>
          </View>
        }
        renderItem={({ item }) => {
          const accent = accentColors[item.accent];
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${item.subtitle}`}
              onPress={() => router.push({ pathname: '/story/[id]', params: { id: item.id } })}
              style={({ pressed }) => [styles.story, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              <View style={[styles.emoji, { backgroundColor: accent.bg }]}>
                <Text style={styles.emojiText}>{item.emoji}</Text>
              </View>
              <View style={styles.storyText}>
                <T variant="subtitle">{item.title}</T>
                <T variant="small">{item.subtitle}</T>
                {item.pages ? <T style={[styles.badge, { color: accent.fg }]}>📖 그림책 {item.pages.length}쪽</T> : null}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.md },
  header: { gap: space.md, marginBottom: space.sm },
  verseCard: { gap: space.xs, backgroundColor: colors.primarySoft },
  verseLabel: { color: colors.primary },
  story: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadow,
  },
  emoji: { width: 64, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 32 },
  storyText: { flex: 1, gap: 2 },
  badge: { fontSize: 14 },
  chevron: { fontSize: 32, color: colors.textMuted },
});
