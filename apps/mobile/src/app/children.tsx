// Child profile picker. Guardians create up to 6 profiles; the selected child
// is remembered on the device.
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Mascot, Screen, T, type MascotPose } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts, radius, space } from '@/theme';

const AVATARS: MascotPose[] = ['wave', 'listen', 'teach'];
const AVATAR_LABELS: Partial<Record<MascotPose, string>> = {
  wave: '손 흔드는 친구',
  listen: '귀 기울이는 친구',
  teach: '이야기하는 친구',
};
const THIS_YEAR = new Date().getFullYear();

export default function ChildrenScreen() {
  const { session, children, selectChild, refresh, activeChild } = useSession();
  const [adding, setAdding] = useState(children.length === 0);
  const [nickname, setNickname] = useState('');
  const [birthYear, setBirthYear] = useState(THIS_YEAR - 7);
  const [avatar, setAvatar] = useState<MascotPose>('wave');
  const [saving, setSaving] = useState(false);

  const pick = (id: string) => {
    selectChild(id);
    router.replace('/');
  };

  const create = async () => {
    if (!session) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('children')
      .insert({ guardian_id: session.user.id, nickname: nickname.trim(), birth_year: birthYear, avatar })
      .select('id')
      .single();
    setSaving(false);
    if (error) {
      Alert.alert('만들지 못했어요', error.message.includes('too many') ? '프로필은 6개까지 만들 수 있어요.' : '잠시 뒤에 다시 시도해 주세요.');
      return;
    }
    await refresh();
    setNickname('');
    setAdding(false);
    pick(data.id);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <T variant="title">누가 성경 친구를 만날까요?</T>

        {children.map((child) => (
          <Pressable
            key={child.id}
            accessibilityRole="button"
            accessibilityLabel={`${child.nickname} 선택`}
            onPress={() => pick(child.id)}
            style={({ pressed }) => [
              styles.child,
              activeChild?.id === child.id && styles.childActive,
              { transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}>
            <Mascot pose={child.avatar as MascotPose} size={64} />
            <View style={styles.flex}>
              <T variant="subtitle">{child.nickname}</T>
              {child.birth_year ? <T variant="small">{THIS_YEAR - child.birth_year}살</T> : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}

        {adding ? (
          <Card style={styles.form}>
            <T variant="subtitle">새 친구 프로필</T>
            <T variant="small">실명 대신 별명을 써 주세요. 별명과 출생 연도만 저장해요.</T>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="별명 (예: 하늘이)"
              placeholderTextColor={colors.textMuted}
              maxLength={20}
              style={styles.input}
              accessibilityLabel="별명"
            />
            <View style={styles.yearRow}>
              <Button label="−" variant="secondary" onPress={() => setBirthYear((y) => Math.min(THIS_YEAR, y + 1))} style={styles.stepper} />
              <View style={styles.flexCenter}>
                <T variant="subtitle">{birthYear}년생</T>
                <T variant="small">{THIS_YEAR - birthYear}살</T>
              </View>
              <Button label="+" variant="secondary" onPress={() => setBirthYear((y) => Math.max(2005, y - 1))} style={styles.stepper} />
            </View>
            <View style={styles.avatarRow}>
              {AVATARS.map((pose) => (
                <Pressable
                  key={pose}
                  accessibilityRole="radio"
                  accessibilityLabel={AVATAR_LABELS[pose]}
                  accessibilityState={{ selected: avatar === pose }}
                  onPress={() => setAvatar(pose)}
                  style={[styles.avatar, avatar === pose && styles.avatarSelected]}>
                  <Mascot pose={pose} size={64} />
                </Pressable>
              ))}
            </View>
            <Button label="만들기" onPress={create} loading={saving} disabled={!nickname.trim()} />
            {children.length > 0 ? <Button label="취소" variant="ghost" onPress={() => setAdding(false)} /> : null}
          </Card>
        ) : children.length < 6 ? (
          <Button label="+ 새 프로필 만들기" variant="secondary" onPress={() => setAdding(true)} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, gap: space.lg },
  flex: { flex: 1 },
  flexCenter: { flex: 1, alignItems: 'center' },
  child: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  childActive: { borderColor: colors.primary },
  chevron: { fontSize: 32, color: colors.textMuted },
  form: { gap: space.md },
  input: {
    borderRadius: radius.md,
    backgroundColor: colors.background,
    padding: space.md,
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.text,
  },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepper: { width: 56, paddingHorizontal: 0 },
  avatarRow: { flexDirection: 'row', justifyContent: 'space-around' },
  avatar: { padding: space.sm, borderRadius: radius.lg, borderWidth: 3, borderColor: 'transparent' },
  avatarSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
