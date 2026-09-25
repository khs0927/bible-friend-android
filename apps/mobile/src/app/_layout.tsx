import { GowunDodum_400Regular } from '@expo-google-fonts/gowun-dodum';
import { Jua_400Regular } from '@expo-google-fonts/jua';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { SessionProvider, useSession } from '@/lib/session';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Jua_400Regular, GowunDodum_400Regular });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootNavigator fontsLoaded={fontsLoaded} />
      </SessionProvider>
    </QueryClientProvider>
  );
}

/**
 * Route access follows the onboarding funnel:
 *   signed out → sign-in
 *   signed in, no consent → consent (법정대리인 동의)
 *   consented, no active child → children (pick or create a profile)
 *   child selected → tabs
 * Screens are listed in priority order: when a guard flips, Expo Router falls
 * back to the first screen that is still available.
 */
function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { isLoading, session, guardian, activeChild } = useSession();
  const ready = !isLoading && fontsLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  const signedIn = Boolean(session);
  const consented = Boolean(guardian?.consented_at);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !consented}>
        <Stack.Screen name="consent" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && consented}>
        <Stack.Protected guard={Boolean(activeChild)}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="story/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="guardian" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Screen name="children" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
    </Stack>
  );
}
