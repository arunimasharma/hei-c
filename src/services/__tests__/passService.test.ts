import { describe, it, expect } from 'vitest';
import { hasActivePass, isFeatureLocked, FREE_LIMITS } from '../passService';
import type { UserPass } from '../passService';

describe('passService', () => {
  const now = new Date();
  const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  describe('hasActivePass', () => {
    it('returns true when pass is active and within dates', () => {
      const passes: UserPass[] = [{
        id: '1', user_id: 'u1', cohort_id: 'c1',
        status: 'active',
        access_starts_at: pastDate.toISOString(),
        access_ends_at: futureDate.toISOString(),
        purchased_at: pastDate.toISOString(),
      }];
      expect(hasActivePass(passes)).toBe(true);
    });

    it('returns false when pass is expired', () => {
      const farPast = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const passes: UserPass[] = [{
        id: '1', user_id: 'u1', cohort_id: 'c1',
        status: 'active',
        access_starts_at: farPast.toISOString(),
        access_ends_at: pastDate.toISOString(),
        purchased_at: farPast.toISOString(),
      }];
      expect(hasActivePass(passes)).toBe(false);
    });

    it('returns false when no passes', () => {
      expect(hasActivePass([])).toBe(false);
    });
  });

  describe('isFeatureLocked', () => {
    it('returns false when user has active pass', () => {
      expect(isFeatureLocked('coach', 10, true)).toBe(false);
    });

    it('returns false when under free limit', () => {
      expect(isFeatureLocked('coach', 2, false)).toBe(false);
    });

    it('returns true when at free limit without pass', () => {
      expect(isFeatureLocked('coach', FREE_LIMITS.coach, false)).toBe(true);
    });
  });
});
