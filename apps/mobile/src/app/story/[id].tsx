import { getStory, quizForStory, treasureForStoryIndex, BIBLE_STORIES } from '@bible-friend/core';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Button, Card, Screen, T } from '@/components/ui';
import { toFriendlyMessage } from '@/lib/api';
import { useClaimGrowth, useFavorites, useToggleFavorite } from '@/lib/queries';
import { useActiveChild } from '@/lib/session';
import { speak, stopSpeaking, useSpeakingId } from '@/lib/speech';
import { accentColors, colors, radius, space } from '@/theme';

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const story = getStory(id);
  const child = useActiveChild();
  const claim = useClaimGrowth(child.id);
  const favorites = useFavorites(child.id);
  const toggleFavorite = useToggleFavorite(child.id);
  const speakingId = useSpeakingId();
  const { width } = useWindowDimensions();
  const [answer, setAnswer] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => stopSpeaking, []);

  if (!story) {
    return (
      <Screen>
        <T>이야기를 찾을 수 없어요.</T>
      </Screen>
    );
  }

  const accent = accentColors[story.accent];
  const quiz = quizForStory(story.id);
  const speakId = `story-${story.id}`;
  const reading = speakingId === speakId;
  const isFavorite = favorites.data?.some((f) => f.verse_ref === story.verseRef) ?? false;
  const card = treasureForStoryIndex(BIBLE_STORIES.findIndex((s) => s.id === story.id));

  const finish = async () => {
    try {
      const result = await claim.mutateAsync({ activity: 'scripture_read', sourceId: story.id });
      setMessage(
        result.claimed
          ? `${result.message} 보물 카드 「${card.emoji} ${card.title}」를 받았어요!`
          : '이미 읽은 이야기예요. 또 읽어 줘서 고마워요! 💛',
      );
    } catch (error) {
      setMessage(toFriendlyMessage(error));
    }
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <T variant="subtitle" numberOfLines={1} style={styles.flex}>
          {story.title}
        </T>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: accent.bg }]}>
          <Text style={styles.heroEmoji}>{story.emoji}</Text>
          <T variant="title" style={{ color: accent.fg }}>
            {story.title}
          </T>
          <T style={{ color: accent.fg }}>{story.subtitle}</T>
        </View>

        {story.pages ? (
          <View style={styles.bookWrap}>
            <T variant="small">📖 옆으로 넘겨 그림책을 봐요</T>
            <FlatList
              horizontal
              pagingEnabled
              data={story.pages}
              keyExtractor={(page) => String(page.page)}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const pageWidth = width - space.lg * 2;
                return (
                  <View style={{ width: pageWidth }}>
                    <Image
                      source={{ uri: item.uri }}
                      style={{ width: pageWidth, height: (pageWidth * item.height) / item.width, borderRadius: radius.md }}
                      contentFit="cover"
                      transition={200}
                      accessibilityLabel={`${item.page}쪽, ${item.title}`}
                    />
                    <T variant="small" style={styles.pageCaption}>
                      {item.page}. {item.title}
                    </T>
                  </View>
                );
              }}
            />
          </View>
        ) : null}

        <Card style={styles.gap}>
          <T style={styles.storyBody}>{story.body}</T>
          <Button
            label={reading ? '■ 그만 읽기' : '🔊 성경 친구가 읽어 줘요'}
            variant="secondary"
            onPress={() =>
              reading
                ? stopSpeaking()
                : void speak(`${story.title}. ${story.body} ${story.lesson}`, { id: speakId, speaker: 'NARRATOR' })
            }
          />
        </Card>

        <Card style={[styles.gap, { backgroundColor: colors.primarySoft }]}>
          <T variant="small" style={{ color: colors.primary }}>
            오늘의 교훈
          </T>
          <T variant="subtitle">{story.lesson}</T>
          <View style={styles.verseRow}>
            <T variant="small" style={styles.flex}>
              📜 {story.verseRef}
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? '말씀 즐겨찾기 해제' : '말씀 즐겨찾기'}
              onPress={() =>
                toggleFavorite.mutate({ verseRef: story.verseRef, verseText: story.lesson, isFavorite })
              }>
              <Text style={styles.star}>{isFavorite ? '⭐' : '☆'}</Text>
            </Pressable>
          </View>
        </Card>

        {quiz ? (
          <Card style={styles.gap}>
            <T variant="subtitle">🧩 퀴즈: {quiz.question}</T>
            {quiz.options.map((option, index) => {
              const chosen = answer === index;
              const correct = index === quiz.answer;
              const reveal = answer !== null;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  disabled={reveal}
                  onPress={() => setAnswer(index)}
                  style={[
                    styles.option,
                    reveal && correct && styles.optionCorrect,
                    reveal && chosen && !correct && styles.optionWrong,
                  ]}>
                  <T>{option}</T>
                </Pressable>
              );
            })}
            {answer !== null ? (
              <T style={{ color: answer === quiz.answer ? colors.mint : colors.coral }}>
                {answer === quiz.answer ? '정답이에요! 🎉 ' : '아쉬워요! 다시 생각해 볼까요? '}
                {quiz.explanation}
              </T>
            ) : null}
          </Card>
        ) : null}

        {message ? <T style={styles.message}>{message}</T> : null}
        <Button label="✅ 다 읽었어요!" onPress={finish} loading={claim.isPending} />
        <Button
          label="💬 이 이야기에 대해 물어보기"
          variant="ghost"
          onPress={() => router.navigate({ pathname: '/', params: { storyId: story.id } })}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 36, color: colors.primary, lineHeight: 40 },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  hero: { borderRadius: radius.lg, padding: space.xl, alignItems: 'center', gap: space.xs },
  heroEmoji: { fontSize: 64 },
  bookWrap: { gap: space.sm },
  pageCaption: { textAlign: 'center', marginTop: space.xs },
  gap: { gap: space.md },
  storyBody: { fontSize: 19, lineHeight: 32 },
  verseRow: { flexDirection: 'row', alignItems: 'center' },
  star: { fontSize: 28 },
  option: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  optionCorrect: { borderColor: colors.mint, backgroundColor: colors.mintSoft },
  optionWrong: { borderColor: colors.coral, backgroundColor: '#FFE1D9' },
  message: { textAlign: 'center', color: colors.mint },
});
