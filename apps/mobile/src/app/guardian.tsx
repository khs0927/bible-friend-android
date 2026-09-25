// Grown-ups only (behind the parental gate): switch child, reminders, usage,
// clearing history, sign out, and permanent account deletion.
import { DAILY_LIMITS, seoulDateKey } from '@bible-friend/core';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ParentGate } from '@/components/parent-gate';
import { Button, Card, Screen, T } from '@/components/ui';
import { api, toFriendlyMessage } from '@/lib/api';
import { signOut } from '@/lib/auth';
import { disableDailyReminder, enableDailyReminder, isDailyReminderOn } from '@/lib/notifications';
import { useClearChat } from '@/lib/queries';
import { useActiveChild, useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme';

export default function GuardianScreen() {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return (
      <Screen>
        <ParentGate visible onPass={() => setUnlocked(true)} onCancel={() => router.back()} />
      </Screen>
    );
  }
  return <GuardianSettings />;
}

function GuardianSettings() {
  const { activeChild } = useSession();
  // The screen is route-guarded on an active child; this covers the frame
  // between "switch profile" and the guard redirecting away.
  return activeChild ? <GuardianSettingsFor /> : null;
}

function GuardianSettingsFor() {
  const { session, selectChild } = useSession();
  const child = useActiveChild();
  const clearChat = useClearChat(child.id);
  const [reminder, setReminder] = useState(isDailyReminderOn);
  const [deleting, setDeleting] = useState(false);

  const usage = useQuery({
    queryKey: ['usage', session?.user.id, seoulDateKey()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_usage')
        .select('kind, units')
        .eq('usage_date', seoulDateKey());
      if (error) throw error;
      return Object.fromEntries(data.map((row) => [row.kind, row.units])) as Record<string, number>;
    },
  });

  const toggleReminder = async (on: boolean) => {
    if (on) {
      const granted = await enableDailyReminder();
      if (!granted) Alert.alert('알림 권한이 필요해요', '설정에서 알림을 허용해 주세요.');
      setReminder(granted);
    } else {
      await disableDailyReminder();
      setReminder(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      '계정을 삭제할까요?',
      '보호자 계정과 모든 아이 프로필, 대화·기도·성장 기록이 즉시 영구 삭제돼요. 되돌릴 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '영구 삭제',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.deleteAccount();
              await signOut();
            } catch (error) {
              Alert.alert('삭제하지 못했어요', toFriendlyMessage(error));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <T variant="title" style={styles.flex}>
            보호자 설정
          </T>
          <Button label="닫기" variant="ghost" onPress={() => router.back()} />
        </View>

        <Card style={styles.gap}>
          <T variant="subtitle">지금 사용 중: {child.nickname}</T>
          <Button
            label="프로필 바꾸기 / 추가하기"
            variant="secondary"
            onPress={() => selectChild(null)}
          />
        </Card>

        <Card style={styles.gap}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <T variant="subtitle">매일 말씀 알림</T>
              <T variant="small">매일 저녁 7시에 성경 친구가 인사해요.</T>
            </View>
            <Switch
              value={reminder}
              onValueChange={(on) => void toggleReminder(on)}
              trackColor={{ true: colors.primary }}
              accessibilityLabel="매일 말씀 알림"
            />
          </View>
        </Card>

        <Card style={styles.gap}>
          <T variant="subtitle">오늘 AI 사용량</T>
          <T variant="small">
            대화 {usage.data?.chat ?? 0}/{DAILY_LIMITS.chat}회 · 음성 인식 {usage.data?.transcribe ?? 0}/
            {DAILY_LIMITS.transcribe}회 · 읽어주기 {usage.data?.tts_chars ?? 0}/{DAILY_LIMITS.ttsChars}자
          </T>
          <T variant="small">한도는 아이들의 과사용과 비용을 막기 위해 보호자 계정 단위로 적용돼요.</T>
        </Card>

        <Card style={styles.gap}>
          <T variant="subtitle">개인정보</T>
          <T variant="small">
            대화·기도 기록은 보호자 계정에만 저장되고, 음성 녹음은 받아쓰기 후 즉시 버려져요.
          </T>
          <Button
            label={`${child.nickname}의 대화 기록 지우기`}
            variant="secondary"
            loading={clearChat.isPending}
            onPress={() =>
              Alert.alert('대화 기록 지우기', '이 아이의 대화 기록을 모두 지울까요?', [
                { text: '취소', style: 'cancel' },
                { text: '지우기', style: 'destructive', onPress: () => clearChat.mutate() },
              ])
            }
          />
        </Card>

        <View style={styles.gap}>
          <Button label="로그아웃" variant="secondary" onPress={() => void signOut()} />
          <Button label="계정 영구 삭제" variant="danger" loading={deleting} onPress={confirmDelete} />
          <T variant="small" style={styles.center}>
            {session?.user.email ?? '소셜 계정'}으로 로그인됨
          </T>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  gap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  center: { textAlign: 'center' },
});
