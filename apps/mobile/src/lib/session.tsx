import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import type { Tables } from './database.types';
import { supabase } from './supabase';

export type Guardian = Tables<'guardians'>;
export type Child = Tables<'children'>;

const ACTIVE_CHILD_KEY = 'bible-friend.active-child';
export const CONSENT_VERSION = '2026-09-26';

interface SessionState {
  isLoading: boolean;
  session: Session | null;
  guardian: Guardian | null;
  children: Child[];
  activeChild: Child | null;
  selectChild: (childId: string | null) => void;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

/** The active child. Only call from screens behind the "has child" route guard. */
export function useActiveChild(): Child {
  const { activeChild } = useSession();
  if (!activeChild) throw new Error('No active child selected');
  return activeChild;
}

function readActiveChildId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CHILD_KEY);
  } catch {
    return null;
  }
}

export function SessionProvider({ children: content }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeChildId, setActiveChildId] = useState<string | null>(readActiveChildId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        queryClient.clear();
        setActiveChildId(null);
        try {
          localStorage.removeItem(ACTIVE_CHILD_KEY);
        } catch {
          // storage unavailable
        }
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id;

  const guardianQuery = useQuery({
    queryKey: ['guardian', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('guardians').select('*').eq('id', userId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const childrenQuery = useQuery({
    queryKey: ['children', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('children').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const selectChild = useCallback((childId: string | null) => {
    setActiveChildId(childId);
    try {
      if (childId) localStorage.setItem(ACTIVE_CHILD_KEY, childId);
      else localStorage.removeItem(ACTIVE_CHILD_KEY);
    } catch {
      // storage unavailable
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([guardianQuery.refetch(), childrenQuery.refetch()]);
  }, [guardianQuery, childrenQuery]);

  const childList = useMemo(() => childrenQuery.data ?? [], [childrenQuery.data]);
  const activeChild = childList.find((child) => child.id === activeChildId) ?? null;
  const isLoading =
    !authReady || (Boolean(userId) && (guardianQuery.isPending || childrenQuery.isPending));

  const value = useMemo<SessionState>(
    () => ({
      isLoading,
      session,
      guardian: guardianQuery.data ?? null,
      children: childList,
      activeChild,
      selectChild,
      refresh,
    }),
    [isLoading, session, guardianQuery.data, childList, activeChild, selectChild, refresh],
  );

  return <SessionContext value={value}>{content}</SessionContext>;
}
