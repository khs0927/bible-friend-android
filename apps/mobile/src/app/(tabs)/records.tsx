import { TREASURE_CARDS, type PrayerVerse } from '@bible-friend/core';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View, type ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button, Card, Chip, EmptyState, Loading, Screen, T } from '@/components/ui';
import { api, toFriendlyMessage } from '@/lib/api';
import {
  useAddPrayerNote,
  useAnswerPrayer,
  useDeletePrayer,
  useFavorites,
  usePrayerNotes,
  useToggleFavorite,
  useTreasures,
} from '@/lib/queries';
import { useActiveChild } from '@/lib/session';
import { colors, fonts, radius, space } from '@/theme';

type Section = 'prayer' | 'favorites' | 'treasures';

export default function RecordsScreen() {
  const [section, setSection] = useState<Section>('prayer');
  return (
    <Screen>
      <View style={styles.header}>
        <T variant="title">나의 기록</T>
        <View style={styles.tabs}>
          <Chip label="🙏 기도 노트" selected={section === 'prayer'} onPress={() => setSection('prayer')} />
          <Chip label="⭐ 말씀" selected={section === 'favorites'} onPress={() => setSection('favorites')} />
          <Chip label="🎁 보물 카드" selected={section === 'treasures'} onPress={() => setSection('treasures')} />
        </View>
      </View>
      {section === 'prayer' ? <PrayerSection /> : section === 'favorites' ? <FavoritesSection /> : <TreasureSection />}
    </Screen>
  );
}

function PrayerSection() {
  const child = useActiveChild();
  const notes = usePrayerNotes(child.id);
  const add = useAddPrayerNote(child.id);
  const answer = useAnswerPrayer(child.id);
  const remove = useDeletePrayer(child.id);
  const [draft, setDraft] = useState('');
  const [suggestion, setSuggestion] = useState<PrayerVerse | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const suggest = async () => {
    setSuggesting(true);
    try {
      const result = await api.suggestPrayerVerse(child.id, draft.trim());
      setSuggestion(result.suggestion);
    } catch (error) {
      setNotice(toFriendlyMessage(error));
    } finally {
      setSuggesting(false);
    }
  };

  const save = async () => {
    try {
      const growth = await add.mutateAsync({
        body: draft.trim(),
        verse_ref: suggestion?.verseRef ?? null,
        verse_text: suggestion?.verseText ?? null,
      });
      setDraft('');
      setSuggestion(null);
      setNotice(growth?.claimed && growth.message ? `🕊️ ${growth.message}` : '기도 노트에 담았어요 🙏');
    } catch (error) {
      setNotice(toFriendlyMessage(error));
    }
  };

  return (
    <FlatList
      data={notes.data ?? []}
      keyExtractor={(note) => note.id}
      // The prayer input lives in the list header; keep it above the keyboard.
      renderScrollComponent={(props: ScrollViewProps) => <KeyboardAwareScrollView {...props} bottomOffset={24} />}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <Card style={styles.gap}>
          <T variant="subtitle">오늘의 기도</T>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="하나님께 드리고 싶은 이야기를 적어 봐요"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={300}
            accessibilityLabel="기도 내용"
          />
          {suggestion ? (
            <View style={styles.suggestion}>
              <T variant="subtitle">📜 {suggestion.verseRef}</T>
              <T>{suggestion.verseText}</T>
              <T variant="small">{suggestion.encouragement}</T>
            </View>
          ) : null}
          <View style={styles.row}>
            <Button
              label="말씀 추천"
              variant="secondary"
              onPress={suggest}
              loading={suggesting}
              disabled={!draft.trim()}
              style={styles.flex}
            />
            <Button label="기도 담기" onPress={save} loading={add.isPending} disabled={!draft.trim()} style={styles.flex} />
          </View>
          {notice ? <T style={styles.notice}>{notice}</T> : null}
        </Card>
      }
      ListEmptyComponent={
        notes.isPending ? <Loading /> : <EmptyState title="아직 기도 노트가 없어요" body="첫 기도를 적어 볼까요?" />
      }
      renderItem={({ item }) => (
        <Card style={styles.gap}>
          <View style={styles.row}>
            <Text style={[styles.status, item.status === 'answered' && styles.statusAnswered]}>
              {item.status === 'answered' ? '✅ 응답됨' : '🕯️ 기도 중'}
            </Text>
            <T variant="small" style={styles.date}>
              {new Date(item.created_at).toLocaleDateString('ko-KR')}
            </T>
          </View>
          <T>{item.body}</T>
          {item.verse_ref ? (
            <T variant="small">
              📜 {item.verse_ref} {item.verse_text}
            </T>
          ) : null}
          {item.gratitude ? <T variant="small">💛 {item.gratitude}</T> : null}
          <View style={styles.row}>
            {item.status === 'praying' ? (
              <Button
                label="응답받았어요!"
                variant="secondary"
                style={styles.flex}
                onPress={() => answer.mutate({ id: item.id })}
              />
            ) : null}
            <Button
              label="지우기"
              variant="danger"
              style={styles.flex}
              onPress={() =>
                Alert.alert('기도 노트 지우기', '이 기도 노트를 지울까요?', [
                  { text: '취소', style: 'cancel' },
                  { text: '지우기', style: 'destructive', onPress: () => remove.mutate(item.id) },
                ])
              }
            />
          </View>
        </Card>
      )}
    />
  );
}

function FavoritesSection() {
  const child = useActiveChild();
  const favorites = useFavorites(child.id);
  const toggle = useToggleFavorite(child.id);
  return (
    <FlatList
      data={favorites.data ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        favorites.isPending ? (
          <Loading />
        ) : (
          <EmptyState title="즐겨찾는 말씀이 없어요" body="이야기에서 ☆를 눌러 말씀을 모아 봐요." pose="teach" />
        )
      }
      renderItem={({ item }) => (
        <Card style={styles.gap}>
          <View style={styles.row}>
            <T variant="subtitle" style={styles.flex}>
              📜 {item.verse_ref}
            </T>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="즐겨찾기 해제"
              onPress={() => toggle.mutate({ verseRef: item.verse_ref, verseText: item.verse_text, isFavorite: true })}>
              <Text style={styles.star}>⭐</Text>
            </Pressable>
          </View>
          <T>{item.verse_text}</T>
        </Card>
      )}
    />
  );
}

function TreasureSection() {
  const child = useActiveChild();
  const treasures = useTreasures(child.id);
  const owned = new Set((treasures.data ?? []).map((t) => t.card_id));
  return (
    <FlatList
      data={TREASURE_CARDS}
      keyExtractor={(card) => card.id}
      numColumns={2}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <T variant="small" style={styles.gridHint}>
          {owned.size} / {TREASURE_CARDS.length}장을 모았어요. 이야기를 끝까지 읽으면 카드를 받아요!
        </T>
      }
      renderItem={({ item }) => {
        const has = owned.has(item.id);
        return (
          <Card style={[styles.treasure, !has && styles.locked]}>
            <Text style={styles.treasureEmoji}>{has ? item.emoji : '❔'}</Text>
            <T variant="subtitle" style={styles.centerText}>
              {has ? item.title : '아직 비밀'}
            </T>
            {has ? (
              <>
                <T variant="small" style={styles.centerText}>
                  {item.verseText}
                </T>
                <T variant="small">{item.verseRef}</T>
              </>
            ) : null}
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.md },
  tabs: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  list: { padding: space.lg, gap: space.md, paddingBottom: space.xxl * 2 },
  gap: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  flex: { flex: 1 },
  input: {
    minHeight: 96,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    padding: space.md,
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.text,
    textAlignVertical: 'top',
  },
  suggestion: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md, gap: space.xs },
  notice: { color: colors.mint, textAlign: 'center' },
  status: { fontFamily: fonts.display, fontSize: 15, color: colors.orange },
  statusAnswered: { color: colors.mint },
  date: { marginLeft: 'auto' },
  star: { fontSize: 26 },
  gridRow: { gap: space.md },
  gridHint: { marginBottom: space.sm },
  treasure: { flex: 1, alignItems: 'center', gap: space.xs, minHeight: 180 },
  locked: { backgroundColor: colors.surfaceMuted },
  treasureEmoji: { fontSize: 44 },
  centerText: { textAlign: 'center' },
});
