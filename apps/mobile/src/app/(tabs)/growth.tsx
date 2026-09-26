import {
  ARMOR_CATALOG,
  EQUIPMENT_IDS,
  MEMORY_VERSES,
  MOOD_LABELS,
  SERVICE_MISSIONS,
  STAGE_LABELS,
  ZONE_INFO,
  canUpgrade,
  moodForProfile,
  recitationMatches,
  stageProgress,
  type Verse,
} from '@bible-friend/core';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button, Card, Loading, Mascot, ProgressBar, Screen, T } from '@/components/ui';
import { toFriendlyMessage } from '@/lib/api';
import { useClaimGrowth, useGrowth, useUpgradeEquipment } from '@/lib/queries';
import { useActiveChild } from '@/lib/session';
import { useVoiceInput } from '@/lib/voice-input';
import { colors, fonts, radius, space } from '@/theme';

export default function GrowthScreen() {
  const child = useActiveChild();
  const growth = useGrowth(child.id);
  const claim = useClaimGrowth(child.id);
  const upgrade = useUpgradeEquipment(child.id);
  const [message, setMessage] = useState<string | null>(null);

  if (growth.isPending) return <Loading label="성경 친구를 깨우고 있어요…" />;
  if (growth.isError || !growth.data) {
    return (
      <Screen>
        <View style={styles.content}>
          <T>{toFriendlyMessage(growth.error)}</T>
          <Button label="다시 시도" onPress={() => void growth.refetch()} />
        </View>
      </Screen>
    );
  }
  const profile = growth.data;
  const mood = moodForProfile(profile);

  const run = async (activity: Parameters<typeof claim.mutateAsync>[0]) => {
    try {
      const result = await claim.mutateAsync(activity);
      setMessage(result.claimed ? result.message : (result.message ?? '오늘은 이미 했어요!'));
      if (result.stageChanged) setMessage(`🎉 ${STAGE_LABELS[result.profile.stage]}(으)로 자랐어요! ${result.message ?? ''}`);
    } catch (error) {
      setMessage(toFriendlyMessage(error));
    }
  };

  return (
    <Screen>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        <Card style={styles.heroCard}>
          <Mascot pose={mood === 'hungry' || mood === 'resting' ? 'listen' : 'wave'} size={120} />
          <T variant="title">{STAGE_LABELS[profile.stage]}</T>
          <T variant="small">
            기분: {MOOD_LABELS[mood]} · 연속 {profile.streakDays}일 🔥 · 영혼 포인트 {profile.soulPoints}
          </T>
          <View style={styles.fullWidth}>
            <T variant="small">다음 단계까지</T>
            <ProgressBar value={stageProgress(profile)} />
          </View>
        </Card>

        {message ? <T style={styles.message}>{message}</T> : null}

        <Card style={styles.gap}>
          <Stat label="🍞 말씀 양식" value={profile.spiritFood} color={colors.orange} />
          <Stat label="🕊️ 평안" value={profile.peace} color={colors.blue} />
          <View style={styles.xpRow}>
            <Xp label="믿음" value={profile.faithXp} />
            <Xp label="지혜" value={profile.wisdomXp} />
            <Xp label="사랑" value={profile.loveXp} />
          </View>
        </Card>

        <MemoryVerseCard
          onMemorized={(verse) => run({ activity: 'verse_memorized', sourceId: verse.id })}
          busy={claim.isPending}
        />

        <Card style={styles.gap}>
          <T variant="subtitle">🙏 오늘의 기도</T>
          <T variant="small">눈을 감고 하나님께 오늘 하루를 이야기해 봐요.</T>
          <Button label="기도했어요" variant="secondary" onPress={() => run({ activity: 'prayer', sourceId: 'daily' })} />
        </Card>

        <Card style={styles.gap}>
          <T variant="subtitle">💛 사랑 실천 미션</T>
          {SERVICE_MISSIONS.filter((m) => profile.unlockedZones.includes(m.zone)).map((mission) => (
            <Pressable
              key={mission.id}
              accessibilityRole="button"
              onPress={() => run({ activity: 'service_mission', sourceId: mission.id })}
              style={styles.mission}>
              <Text style={styles.missionEmoji}>{mission.emoji}</Text>
              <T style={styles.flex}>{mission.title}</T>
              <T variant="small">{ZONE_INFO[mission.zone].emoji}</T>
            </Pressable>
          ))}
          <T variant="small">더 자라면 새로운 장소와 미션이 열려요!</T>
        </Card>

        <Card style={styles.gap}>
          <T variant="subtitle">🛡️ 하나님의 전신 갑주</T>
          {EQUIPMENT_IDS.map((id) => {
            const item = ARMOR_CATALOG[id];
            const tier = profile.equipmentTiers[id];
            const check = canUpgrade(profile, id);
            return (
              <View key={id} style={styles.armor}>
                <Text style={styles.armorEmoji}>{item.emoji}</Text>
                <View style={styles.flex}>
                  <T variant="subtitle" style={styles.armorName}>
                    {item.name} · {item.tierNames[tier]}
                  </T>
                  <T variant="small">{check.ok ? `${check.cost} 포인트로 강화` : check.reason}</T>
                </View>
                <Button
                  label="강화"
                  variant="secondary"
                  disabled={!check.ok}
                  loading={upgrade.isPending && upgrade.variables === id}
                  onPress={() =>
                    upgrade.mutate(id, {
                      onSuccess: (result) => setMessage(result.message),
                      onError: (error) => setMessage(toFriendlyMessage(error)),
                    })
                  }
                  style={styles.upgrade}
                />
              </View>
            );
          })}
        </Card>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.gapSm}>
      <View style={styles.statRow}>
        <T>{label}</T>
        <T variant="small">{value}/100</T>
      </View>
      <ProgressBar value={value / 100} color={color} />
    </View>
  );
}

function Xp({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.xp}>
      <Text style={styles.xpValue}>{value}</Text>
      <T variant="small">{label}</T>
    </View>
  );
}

/** Memorize a verse by saying it (voice) or typing it. */
function MemoryVerseCard({ onMemorized, busy }: { onMemorized: (verse: Verse) => void; busy: boolean }) {
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const verse = MEMORY_VERSES[index % MEMORY_VERSES.length]!;

  const check = (text: string) => {
    setAttempt(text);
    if (recitationMatches(verse.text, text)) {
      setFeedback('완벽해요! 말씀을 마음에 담았어요 ✨');
      onMemorized(verse);
    } else {
      setFeedback('거의 다 왔어요! 한 번 더 해 볼까요?');
    }
  };
  const voice = useVoiceInput(check);

  return (
    <Card style={styles.gap}>
      <T variant="subtitle">📖 말씀 암송 · {verse.theme}</T>
      <T style={styles.verseText}>{verse.text}</T>
      <T variant="small">{verse.ref}</T>
      <TextInput
        value={attempt}
        onChangeText={setAttempt}
        placeholder="외운 말씀을 말하거나 적어 봐요"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        multiline
        accessibilityLabel="암송 입력"
      />
      {feedback ? <T style={styles.message}>{feedback}</T> : null}
      {voice.error ? <T style={styles.error}>{voice.error}</T> : null}
      <View style={styles.row}>
        <Button
          label={voice.state === 'recording' ? '■ 끝' : voice.state === 'transcribing' ? '듣는 중' : '🎤 말하기'}
          variant="secondary"
          onPress={() => void voice.toggle()}
          disabled={voice.state === 'transcribing'}
          style={styles.flex}
        />
        <Button label="확인" onPress={() => check(attempt)} disabled={!attempt.trim()} loading={busy} style={styles.flex} />
      </View>
      <Button
        label="다른 말씀"
        variant="ghost"
        onPress={() => {
          setIndex((i) => i + 1);
          setAttempt('');
          setFeedback(null);
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  heroCard: { alignItems: 'center', gap: space.sm },
  fullWidth: { alignSelf: 'stretch', gap: space.xs },
  message: { textAlign: 'center', color: colors.mint },
  error: { textAlign: 'center', color: colors.danger },
  gap: { gap: space.md },
  gapSm: { gap: space.xs },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  xpRow: { flexDirection: 'row', justifyContent: 'space-around' },
  xp: { alignItems: 'center' },
  xpValue: { fontFamily: fonts.display, fontSize: 26, color: colors.primary },
  verseText: { fontSize: 20, lineHeight: 30 },
  input: {
    minHeight: 72,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    padding: space.md,
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.text,
    textAlignVertical: 'top',
  },
  mission: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  missionEmoji: { fontSize: 26 },
  armor: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  armorEmoji: { fontSize: 30 },
  armorName: { fontSize: 16 },
  upgrade: { minHeight: 44, paddingHorizontal: space.lg },
});
