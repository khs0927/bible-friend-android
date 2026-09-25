// A "parental gate": grown-up-only areas (settings, sign-out, account deletion)
// ask a question young children can't easily answer. Required for apps in the
// App Store Kids category and recommended by Google Play's Families policy.
import { useMemo, useState } from 'react';
import { Modal, StyleSheet, TextInput, View } from 'react-native';

import { colors, radius, space, type } from '@/theme';

import { Button, Card, T } from './ui';

function makeQuestion() {
  const a = 6 + Math.floor(Math.random() * 4);
  const b = 6 + Math.floor(Math.random() * 4);
  return { text: `${a} × ${b} = ?`, answer: String(a * b) };
}

export function ParentGate({
  visible,
  onPass,
  onCancel,
}: {
  visible: boolean;
  onPass: () => void;
  onCancel: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const question = useMemo(() => makeQuestion(), [attempt, visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  const submit = () => {
    if (value.trim() === question.answer) {
      setValue('');
      setWrong(false);
      onPass();
    } else {
      setValue('');
      setWrong(true);
      setAttempt((n) => n + 1);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Card style={styles.card}>
          <T variant="title">보호자 확인</T>
          <T variant="small">이 공간은 보호자만 들어갈 수 있어요. 아래 문제의 답을 입력해 주세요.</T>
          <T variant="hero" style={styles.question} accessibilityLabel={question.text.replace('×', '곱하기')}>
            {question.text}
          </T>
          <TextInput
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            maxLength={3}
            autoFocus
            style={styles.input}
            onSubmitEditing={submit}
            accessibilityLabel="답 입력"
          />
          {wrong ? <T style={styles.wrong}>답이 달라요. 새 문제로 다시 해 주세요.</T> : null}
          <View style={styles.row}>
            <Button label="취소" variant="secondary" onPress={onCancel} style={styles.flex} />
            <Button label="확인" onPress={submit} style={styles.flex} disabled={!value} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 20, 60, 0.45)',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: { gap: space.md },
  question: { textAlign: 'center', marginVertical: space.sm },
  input: {
    ...type.title,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    backgroundColor: colors.background,
  },
  wrong: { color: colors.danger, textAlign: 'center' },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
