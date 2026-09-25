import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export type OAuthProvider = 'kakao' | 'google' | 'apple';

WebBrowser.maybeCompleteAuthSession();

/** biblefriend://auth/callback in builds, exp://…/--/auth/callback in Expo Go. */
export const authRedirectUrl = Linking.createURL('auth/callback');

/** Exchanges the PKCE `code` from an OAuth redirect URL for a session. */
export async function completeOAuthRedirect(url: string): Promise<boolean> {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search || parsed.hash.replace(/^#/, ''));
  const errorDescription = params.get('error_description');
  if (errorDescription) throw new Error(errorDescription);
  const code = params.get('code');
  if (!code) return false;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return true;
}

/** Browser-based OAuth (Kakao, Google, and Apple on Android). */
export async function signInWithOAuth(provider: OAuthProvider): Promise<boolean> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: authRedirectUrl,
      skipBrowserRedirect: true,
      // Kakao: request only the profile nickname; e-mail is optional consent.
      scopes: provider === 'kakao' ? 'profile_nickname account_email' : undefined,
    },
  });
  if (error) throw error;
  if (!data.url) return false;
  const result = await WebBrowser.openAuthSessionAsync(data.url, authRedirectUrl);
  if (result.type !== 'success') return false;
  return completeOAuthRedirect(result.url);
}

/** Native Sign in with Apple on iOS; falls back to the web flow elsewhere. */
export async function signInWithApple(): Promise<boolean> {
  if (Platform.OS !== 'ios') return signInWithOAuth('apple');
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
  });
  if (!credential.identityToken) throw new Error('Apple 로그인 정보를 받지 못했어요.');
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;
  return true;
}

export async function isNativeAppleSignInAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
}

/**
 * Development-only e-mail sign in against the local Supabase stack, so the app
 * can be exercised on an emulator without real Kakao/Google/Apple credentials.
 */
export async function devSignIn(): Promise<void> {
  if (!__DEV__) throw new Error('dev sign-in is disabled in production builds');
  const email = 'guardian@dev.local';
  const password = 'bible-friend-dev';
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (!signIn.error) return;
  const signUp = await supabase.auth.signUp({ email, password, options: { data: { name: '개발용 보호자' } } });
  if (signUp.error) throw signUp.error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
