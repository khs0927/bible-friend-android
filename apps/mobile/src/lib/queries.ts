import type { GrowthActivityType, EquipmentId } from '@bible-friend/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './api';
import type { Tables } from './database.types';
import { supabase } from './supabase';

export type ChatMessage = Tables<'chat_messages'>;
export type PrayerNote = Tables<'prayer_notes'>;
export type FavoriteVerse = Tables<'favorite_verses'>;

export const keys = {
  chat: (childId: string) => ['chat', childId] as const,
  growth: (childId: string) => ['growth', childId] as const,
  prayers: (childId: string) => ['prayers', childId] as const,
  favorites: (childId: string) => ['favorites', childId] as const,
  treasures: (childId: string) => ['treasures', childId] as const,
};

// --- chat -----------------------------------------------------------------------

export function useChatMessages(childId: string) {
  return useQuery({
    queryKey: keys.chat(childId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('child_id', childId)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });
}

export function useAsk(childId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ message, storyId }: { message: string; storyId?: string }) => api.ask(childId, message, storyId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: keys.chat(childId) });
      if (result.growth?.claimed) void queryClient.invalidateQueries({ queryKey: keys.growth(childId) });
    },
  });
}

export function useClearChat(childId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('chat_messages').delete().eq('child_id', childId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.chat(childId) }),
  });
}

// --- growth ---------------------------------------------------------------------

export function useGrowth(childId: string) {
  return useQuery({
    queryKey: keys.growth(childId),
    queryFn: async () => (await api.growth({ action: 'get', childId })).profile,
  });
}

export function useClaimGrowth(childId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activity, sourceId }: { activity: GrowthActivityType; sourceId: string }) =>
      api.growth({ action: 'claim', childId, activity, sourceId }),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(keys.growth(childId), result.profile);
      if (variables.activity === 'scripture_read') {
        void queryClient.invalidateQueries({ queryKey: keys.treasures(childId) });
      }
    },
  });
}

export function useUpgradeEquipment(childId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (equipmentId: EquipmentId) => api.growth({ action: 'upgrade', childId, equipmentId }),
    onSuccess: (result) => queryClient.setQueryData(keys.growth(childId), result.profile),
  });
}

// --- prayer notes ---------------------------------------------------------------

export function usePrayerNotes(childId: string) {
  return useQuery({
    queryKey: keys.prayers(childId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prayer_notes')
        .select('*')
        .eq('child_id', childId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAddPrayerNote(childId: string) {
  const queryClient = useQueryClient();
  const claim = useClaimGrowth(childId);
  return useMutation({
    mutationFn: async (note: { body: string; verse_ref?: string | null; verse_text?: string | null }) => {
      const { error } = await supabase.from('prayer_notes').insert({ child_id: childId, ...note });
      if (error) throw error;
      return claim.mutateAsync({ activity: 'prayer', sourceId: 'prayer-note' }).catch(() => null);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.prayers(childId) }),
  });
}

export function useAnswerPrayer(childId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, gratitude }: { id: string; gratitude?: string }) => {
      const { error } = await supabase
        .from('prayer_notes')
        .update({ status: 'answered', gratitude: gratitude || null, answered_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.prayers(childId) }),
  });
}

export function useDeletePrayer(childId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('prayer_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.prayers(childId) }),
  });
}

// --- favorites & treasures ------------------------------------------------------

export function useFavorites(childId: string) {
  return useQuery({
    queryKey: keys.favorites(childId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('favorite_verses')
        .select('*')
        .eq('child_id', childId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useToggleFavorite(childId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ verseRef, verseText, isFavorite }: { verseRef: string; verseText: string; isFavorite: boolean }) => {
      if (isFavorite) {
        const { error } = await supabase
          .from('favorite_verses')
          .delete()
          .eq('child_id', childId)
          .eq('verse_ref', verseRef);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favorite_verses')
          .upsert({ child_id: childId, verse_ref: verseRef, verse_text: verseText }, { onConflict: 'child_id,verse_ref' });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.favorites(childId) }),
  });
}

export function useTreasures(childId: string) {
  return useQuery({
    queryKey: keys.treasures(childId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('treasure_cards')
        .select('card_id, collected_at')
        .eq('child_id', childId);
      if (error) throw error;
      return data;
    },
  });
}
