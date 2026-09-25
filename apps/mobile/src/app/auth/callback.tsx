// Deep-link target for OAuth redirects (biblefriend://auth/callback?code=…).
// Usually the in-app browser hands the URL back directly; this route covers
// platforms that re-open the app through the deep link instead.
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { Loading, Screen } from '@/components/ui';
import { completeOAuthRedirect } from '@/lib/auth';

export default function AuthCallback() {
  const url = Linking.useLinkingURL();

  useEffect(() => {
    if (!url) return;
    completeOAuthRedirect(url)
      .catch((error) => console.warn('[auth] callback failed', error))
      .finally(() => router.replace('/'));
  }, [url]);

  return (
    <Screen>
      <Loading label="로그인하고 있어요…" />
    </Screen>
  );
}
