import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Button, Mascot, Screen, T } from '@/components/ui';
import { devSignIn, isNativeAppleSignInAvailable, signInWithApple, signInWithOAuth, type OAuthProvider } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, radius, space } from '@/theme';

export default function SignIn() {
  const [busy, setBusy] = useState<OAuthProvider | 'dev' | null>(null);
  const [nativeApple, setNativeApple] = useState(false);

  useEffect(() => {
    void isNativeAppleSignInAvailable().then(setNativeApple);
  }, []);

  const run = async (provider: OAuthProvider | 'dev', action: () => Promise<unknown>) => {
    setBusy(provider);
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/canceled|cancelled|ERR_REQUEST_CANCELED/i.test(message)) {
        Alert.alert('로그인하지 못했어요', message);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <Mascot pose="full" size={180} />
        <T variant="hero" style={styles.center}>
          성경 친구
        </T>
        <T style={styles.center}>말씀을 함께 읽고, 궁금한 것을 묻고,{'\n'}기도하며 쑥쑥 자라요.</T>
      </View>

      <View style={styles.actions}>
        <T variant="small" style={styles.center}>
          보호자(부모님) 계정으로 로그인해 주세요.
        </T>
        <Button
          label="카카오로 시작하기"
          variant="kakao"
          loading={busy === 'kakao'}
          disabled={Boolean(busy)}
          onPress={() => run('kakao', () => signInWithOAuth('kakao'))}
        />
        <Button
          label="Google로 시작하기"
          variant="secondary"
          loading={busy === 'google'}
          disabled={Boolean(busy)}
          onPress={() => run('google', () => signInWithOAuth('google'))}
        />
        {nativeApple ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={radius.pill}
            style={styles.appleButton}
            onPress={() => run('apple', signInWithApple)}
          />
        ) : (
          <Button
            label="Apple로 시작하기"
            variant="dark"
            loading={busy === 'apple'}
            disabled={Boolean(busy)}
            onPress={() => run('apple', signInWithApple)}
          />
        )}
        {__DEV__ ? (
          <Button
            label="개발용 로그인 (로컬 Supabase)"
            variant="ghost"
            loading={busy === 'dev'}
            disabled={Boolean(busy) || !isSupabaseConfigured}
            onPress={() => run('dev', devSignIn)}
          />
        ) : null}
        <T variant="small" style={[styles.center, styles.legal]}>
          {Platform.OS === 'ios' ? '계속하면' : '로그인하면'} 이용약관과 개인정보 처리방침에 동의하는 것으로 봐요.
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  actions: { gap: space.md, padding: space.xl },
  appleButton: { height: 54, width: '100%' },
  center: { textAlign: 'center' },
  legal: { color: colors.textMuted, marginTop: space.sm },
});
