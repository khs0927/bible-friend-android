import { describe, expect, it } from 'vitest';
import {
  INITIAL_GROWTH_PROFILE,
  activityEventKey,
  applyReward,
  calculateStage,
  canUpgrade,
  claimActivity,
  normalizeProfile,
  seoulDateKey,
  settleProfile,
  upgradeEquipment,
} from './growth.ts';

const at = (iso: string) => new Date(iso);

describe('growth domain', () => {
  it('uses the Korean calendar day', () => {
    // 15:30 UTC is already the next day in Seoul (UTC+9).
    expect(seoulDateKey(at('2026-09-25T15:30:00Z'))).toBe('2026-09-26');
    expect(seoulDateKey(at('2026-09-25T14:59:00Z'))).toBe('2026-09-25');
  });

  it('advances stages as XP grows', () => {
    expect(calculateStage({ faithXp: 0, wisdomXp: 0, loveXp: 0 })).toBe('seedling');
    expect(calculateStage({ faithXp: 80, wisdomXp: 40, loveXp: 0 })).toBe('disciple');
    expect(calculateStage({ faithXp: 240, wisdomXp: 120, loveXp: 50 })).toBe('warrior');
    const grown = applyReward(INITIAL_GROWTH_PROFILE, { faithXp: 80, wisdomXp: 40 });
    expect(grown.stage).toBe('disciple');
    expect(grown.unlockedZones).toEqual(['home', 'road']);
  });

  it('starts and continues a streak on consecutive days', () => {
    const day1 = claimActivity(INITIAL_GROWTH_PROFILE, 'prayer', at('2026-09-01T01:00:00Z'));
    expect(day1.profile.streakDays).toBe(1);
    const sameDay = claimActivity(day1.profile, 'scripture_read', at('2026-09-01T05:00:00Z'));
    expect(sameDay.profile.streakDays).toBe(1);
    const day2 = claimActivity(sameDay.profile, 'prayer', at('2026-09-02T01:00:00Z'));
    expect(day2.profile.streakDays).toBe(2);
  });

  it('decays hunger and resets the streak after skipped days', () => {
    const fed = { ...INITIAL_GROWTH_PROFILE, spiritFood: 90, streakDays: 4, lastNourishedAt: '2026-09-01T01:00:00Z' };
    expect(settleProfile(fed, at('2026-09-02T01:00:00Z'))).toBe(fed);
    const later = settleProfile(fed, at('2026-09-04T01:00:00Z'));
    expect(later.spiritFood).toBe(50);
    expect(later.streakDays).toBe(0);
  });

  it('builds idempotency keys per activity kind', () => {
    const now = at('2026-09-01T01:00:00Z');
    expect(activityEventKey('scripture_read', 'noah', now)).toBe('scripture_read:noah');
    expect(activityEventKey('prayer', 'anything', now)).toBe('prayer:2026-09-01');
    expect(activityEventKey('verse_memorized', 'john-3-16', now)).toBe('verse_memorized:2026-09-01:john-3-16');
  });

  it('upgrades equipment only when affordable', () => {
    const poor = { ...INITIAL_GROWTH_PROFILE, soulPoints: 5 };
    expect(canUpgrade(poor, 'shield_faith').ok).toBe(false);
    expect(upgradeEquipment(poor, 'shield_faith')).toBe(poor);
    const rich = { ...INITIAL_GROWTH_PROFILE, soulPoints: 50 };
    const upgraded = upgradeEquipment(rich, 'shield_faith');
    expect(upgraded.equipmentTiers.shield_faith).toBe(1);
    expect(upgraded.soulPoints).toBe(30);
    expect(upgraded.equipped).toContain('shield_faith');
    expect(canUpgrade(rich, 'crown').ok).toBe(false);
  });

  it('normalizes partial or corrupt stored profiles', () => {
    const profile = normalizeProfile({ faithXp: 100, wisdomXp: 50, spiritFood: 400, equipped: ['bogus', 'crown'] });
    expect(profile.stage).toBe('disciple');
    expect(profile.spiritFood).toBe(100);
    expect(profile.equipped).toEqual(['crown']);
    expect(normalizeProfile(null)).toEqual(INITIAL_GROWTH_PROFILE);
  });
});
