import { Pressable, StyleSheet, Text, View } from 'react-native';

import { speak, stopSpeaking, useSpeakingId } from '@/lib/speech';
import { colors, fonts, radius, space } from '@/theme';

import { Mascot } from './ui';

export function ChatBubble({
  id,
  role,
  content,
}: {
  id: string;
  role: 'child' | 'friend';
  content: string;
}) {
  const speakingId = useSpeakingId();
  const speaking = speakingId === id;
  const isFriend = role === 'friend';

  return (
    <View style={[styles.row, isFriend ? styles.rowFriend : styles.rowChild]}>
      {isFriend ? <Mascot pose={speaking ? 'teach' : 'wave'} size={44} /> : null}
      <View style={[styles.bubble, isFriend ? styles.friend : styles.child]}>
        <Text style={[styles.text, !isFriend && styles.childText]} selectable>
          {content}
        </Text>
        {isFriend ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={speaking ? '읽기 멈추기' : '소리로 듣기'}
            hitSlop={8}
            onPress={() => (speaking ? stopSpeaking() : void speak(content, { id }))}
            style={[styles.listen, speaking && styles.listenActive]}>
            <Text style={[styles.listenLabel, speaking && styles.listenLabelActive]}>
              {speaking ? '■ 멈추기' : '🔊 듣기'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function TypingBubble() {
  return (
    <View style={[styles.row, styles.rowFriend]}>
      <Mascot pose="listen" size={44} />
      <View style={[styles.bubble, styles.friend]}>
        <Text style={styles.text}>성경 친구가 생각하고 있어요… 💭</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginVertical: space.xs },
  rowFriend: { justifyContent: 'flex-start', paddingRight: space.xxl },
  rowChild: { justifyContent: 'flex-end', paddingLeft: space.xxl * 1.5 },
  bubble: { borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md, maxWidth: '100%', flexShrink: 1 },
  friend: { backgroundColor: colors.surface, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.border },
  child: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  text: { fontFamily: fonts.body, fontSize: 18, lineHeight: 28, color: colors.text },
  childText: { color: colors.white },
  listen: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  listenActive: { backgroundColor: colors.primary },
  listenLabel: { fontFamily: fonts.display, fontSize: 14, color: colors.primary },
  listenLabelActive: { color: colors.white },
});
