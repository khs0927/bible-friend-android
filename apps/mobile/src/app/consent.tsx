// 법정대리인 동의: Korean PIPA requires a legal guardian's consent before
// collecting personal information from children under 14. The guardian's
// consent is recorded server-side and gates every child feature (RLS + functions).
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, T } from '@/components/ui';
import { signOut } from '@/lib/auth';
import { CONSENT_VERSION, useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/theme';

const ITEMS = [
  {
    key: 'guardian',
    required: true,
    label: '[필수] 저는 아이의 부모님 또는 법정대리인(만 19세 이상)입니다.',
  },
  {
    key: 'terms',
    required: true,
    label: '[필수] 서비스 이용약관에 동의합니다.',
  },
  {
    key: 'privacy',
    required: true,
    label:
      '[필수] 아동 개인정보 수집·이용에 동의합니다.\n수집 항목: 아이 별명, 출생 연도, 대화·기도 기록\n목적: 성경 친구 대화와 성장 기록 제공 · 보유 기간: 회원 탈퇴 시까지',
  },
  {
    key: 'ai',
    required: true,
    label:
      '[필수] 아이의 질문과 음성이 답변 생성을 위해 AI 서비스(Google Gemini)로 전송되는 것에 동의합니다. 음성 파일은 저장하지 않아요.',
  },
  {
    key: 'marketing',
    required: false,
    label: '[선택] 새 이야기와 기능 소식을 받아볼게요.',
  },
] as const;

type ItemKey = (typeof ITEMS)[number]['key'];

export default function Consent() {
  const { session, refresh } = useSession();
  const [checked, setChecked] = useState<Record<ItemKey, boolean>>({
    guardian: false,
    terms: false,
    privacy: false,
    ai: false,
    marketing: false,
  });
  const [saving, setSaving] = useState(false);
  const allRequired = ITEMS.every((item) => !item.required || checked[item.key]);
  const everything = ITEMS.every((item) => checked[item.key]);

  const toggleAll = () => {
    const next = !everything;
    setChecked({ guardian: next, terms: next, privacy: next, ai: next, marketing: next });
  };

  const submit = async () => {
    if (!session) return;
    setSaving(true);
    const { error } = await supabase
      .from('guardians')
      .update({
        consented_at: new Date().toISOString(),
        consent_version: CONSENT_VERSION,
        marketing_opt_in: checked.marketing,
      })
      .eq('id', session.user.id);
    setSaving(false);
    if (error) {
      Alert.alert('저장하지 못했어요', '잠시 뒤에 다시 시도해 주세요.');
      return;
    }
    await refresh();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <T variant="title">보호자 동의</T>
        <T>
          성경 친구는 만 14세 미만 어린이도 사용하는 앱이에요. 아이의 정보를 안전하게 다루기 위해 보호자님의
          동의가 필요해요.
        </T>

        <Card style={styles.card}>
          <CheckRow label="전체 동의" checked={everything} onPress={toggleAll} bold />
          <View style={styles.divider} />
          {ITEMS.map((item) => (
            <CheckRow
              key={item.key}
              label={item.label}
              checked={checked[item.key]}
              onPress={() => setChecked((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
            />
          ))}
        </Card>

        <T variant="small">
          동의는 설정에서 언제든 철회할 수 있으며, 회원 탈퇴 시 아이의 모든 기록이 즉시 삭제돼요.
        </T>
      </ScrollView>
      <View style={styles.footer}>
        <Button label="동의하고 시작하기" onPress={submit} disabled={!allRequired} loading={saving} />
        <Button label="다른 계정으로 로그인" variant="ghost" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

function CheckRow({
  label,
  checked,
  onPress,
  bold,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  bold?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.row}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <T style={styles.tick}>✓</T> : null}
      </View>
      <T variant={bold ? 'subtitle' : 'body'} style={styles.rowLabel}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg },
  card: { gap: space.md },
  divider: { height: 1, backgroundColor: colors.border },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  box: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxChecked: { backgroundColor: colors.primary },
  tick: { color: colors.white, fontSize: 18, lineHeight: 22 },
  rowLabel: { flex: 1, fontSize: 15, lineHeight: 22 },
  footer: { padding: space.xl, gap: space.sm },
});
