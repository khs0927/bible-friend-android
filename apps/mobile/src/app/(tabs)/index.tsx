import { BIBLE_STORIES } from '@bible-friend/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
// Android is edge-to-edge (SDK 57), where RN's KeyboardAvoidingView does not
// resize the window; keyboard-controller behaves the same on Android and iOS.
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { ChatBubble, TypingBubble } from '@/components/chat-bubble';
import { Chip, EmptyState, Mascot, Screen, T } from '@/components/ui';
import { toFriendlyMessage } from '@/lib/api';
import { useAsk, useChatMessages } from '@/lib/queries';
import { useActiveChild } from '@/lib/session';
import { speak } from '@/lib/speech';
import { useVoiceInput } from '@/lib/voice-input';
import { colors, fonts, radius, space } from '@/theme';

const QUICK_QUESTIONS = ['하나님은 어디에 계셔?', '기도는 어떻게 해?', '노아 이야기 들려줘', '예수님은 왜 오셨어?'];
const AUTO_SPEAK_KEY = 'bible-friend.auto-speak';

function readAutoSpeak() {
  try {
    return localStorage.getItem(AUTO_SPEAK_KEY) !== 'off';
  } catch {
    return true;
  }
}

export default function ChatScreen() {
  const child = useActiveChild();
  const params = useLocalSearchParams<{ storyId?: string }>();
  // The story being discussed comes from the route (story screen → "물어보기").
  const storyId = params.storyId;
  const story = BIBLE_STORIES.find((s) => s.id === storyId);
  const messages = useChatMessages(child.id);
  const ask = useAsk(child.id);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(readAutoSpeak);
  const inputRef = useRef<TextInput>(null);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || ask.isPending) return;
      setDraft('');
      setNotice(null);
      setPending(message);
      try {
        const result = await ask.mutateAsync({ message, storyId });
        if (result.growth?.message) setNotice(`🌱 ${result.growth.message}`);
        if (autoSpeak) void speak(result.reply, { id: `latest-${Date.now()}` });
      } catch (error) {
        setDraft(message);
        setNotice(toFriendlyMessage(error));
      } finally {
        setPending(null);
      }
    },
    [ask, autoSpeak, storyId],
  );

  const voice = useVoiceInput(useCallback((text: string) => void send(text), [send]));

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_SPEAK_KEY, autoSpeak ? 'on' : 'off');
    } catch {
      // storage unavailable
    }
  }, [autoSpeak]);

  const data = messages.data ?? [];

  return (
    <Screen>
      <View style={styles.header}>
        <Mascot pose="wave" size={52} />
        <View style={styles.headerText}>
          <T variant="subtitle">{child.nickname}의 성경 친구</T>
          <T variant="small">궁금한 건 무엇이든 물어봐요!</T>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: autoSpeak }}
          accessibilityLabel="답변 자동으로 읽어주기"
          onPress={() => setAutoSpeak((v) => !v)}
          style={[styles.iconButton, autoSpeak && styles.iconButtonOn]}>
          <Text style={styles.iconText}>{autoSpeak ? '🔊' : '🔇'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="보호자 설정"
          onPress={() => router.push('/guardian')}
          style={styles.iconButton}>
          <Text style={styles.iconText}>⚙️</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {messages.isPending ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            inverted
            data={data}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <ChatBubble id={String(item.id)} role={item.role as 'child' | 'friend'} content={item.content} />
            )}
            ListHeaderComponent={
              pending ? (
                <View>
                  <TypingBubble />
                  <ChatBubble id="pending" role="child" content={pending} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              pending ? null : (
                <View style={styles.emptyWrap}>
                  <EmptyState
                    pose="wave"
                    title={`안녕, ${child.nickname}! 😊`}
                    body="무엇이 궁금한지 말해 줄래? 아래 질문을 눌러도 좋아."
                  />
                </View>
              )
            }
          />
        )}

        {story ? (
          <View style={styles.storyBanner}>
            <T variant="small" style={styles.flex}>
              {story.emoji} 「{story.title}」 이야기에 대해 이야기하고 있어요
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel="이야기 주제 끝내기" onPress={() => router.setParams({ storyId: undefined })}>
              <Text style={styles.bannerClose}>✕</Text>
            </Pressable>
          </View>
        ) : null}
        {notice ? <T style={styles.notice}>{notice}</T> : null}
        {voice.error ? <T style={[styles.notice, styles.noticeError]}>{voice.error}</T> : null}

        {data.length === 0 && !pending ? (
          <View style={styles.chips}>
            {QUICK_QUESTIONS.map((q) => (
              <Chip key={q} label={q} onPress={() => void send(q)} />
            ))}
          </View>
        ) : null}

        <View style={styles.composer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={voice.state === 'recording' ? '녹음 끝내기' : '목소리로 질문하기'}
            onPress={() => void voice.toggle()}
            disabled={voice.state === 'transcribing' || ask.isPending}
            style={[styles.mic, voice.state === 'recording' && styles.micRecording]}>
            {voice.state === 'transcribing' ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.micText}>{voice.state === 'recording' ? `■ ${voice.durationSeconds}` : '🎤'}</Text>
            )}
          </Pressable>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            placeholder={voice.state === 'recording' ? '듣고 있어요…' : '성경 친구에게 물어보기'}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={600}
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={() => void send(draft)}
            accessibilityLabel="질문 입력"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="보내기"
            disabled={!draft.trim() || ask.isPending}
            onPress={() => void send(draft)}
            style={[styles.send, (!draft.trim() || ask.isPending) && styles.sendDisabled]}>
            <Text style={styles.sendText}>보내기</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  headerText: { flex: 1 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  iconButtonOn: { backgroundColor: colors.primarySoft },
  iconText: { fontSize: 20 },
  list: { paddingHorizontal: space.lg, paddingVertical: space.md, flexGrow: 1 },
  emptyWrap: { flex: 1, justifyContent: 'center', transform: [{ scaleY: -1 }] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  storyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  bannerClose: { fontSize: 18, color: colors.primary, paddingHorizontal: space.xs },
  notice: { textAlign: 'center', paddingHorizontal: space.lg, paddingBottom: space.sm, color: colors.mint },
  noticeError: { color: colors.danger },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mic: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRecording: { backgroundColor: colors.coral },
  micText: { fontSize: 20, color: colors.white, fontFamily: fonts.display },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    paddingHorizontal: space.lg,
    paddingTop: 14,
    paddingBottom: 12,
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.text,
  },
  send: {
    height: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
  sendText: { color: colors.white, fontFamily: fonts.display, fontSize: 16 },
});
