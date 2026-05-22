import {
  createContext, useContext, useEffect, useState, useCallback, type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  fetchUserPasses, fetchUsageCounts, fetchOpenCohort,
  hasActivePass, isFeatureLocked, daysRemaining,
  type UserPass, type Cohort, type FeatureKey, FREE_LIMITS,
} from '../services/passService';

interface PassContextType {
  passes: UserPass[];
  usageCounts: Record<FeatureKey, number>;
  openCohort: Cohort | null;
  hasPaidPass: boolean;
  daysLeft: number | null;
  isLocked: (feature: FeatureKey) => boolean;
  getUsage: (feature: FeatureKey) => { used: number; limit: number };
  refresh: () => Promise<void>;
  loading: boolean;
}

const PassContext = createContext<PassContextType | undefined>(undefined);

export function PassProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [passes, setPasses] = useState<UserPass[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<FeatureKey, number>>({ coach: 0, validator: 0, taste: 0 });
  const [openCohort, setOpenCohort] = useState<Cohort | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setPasses([]);
      setUsageCounts({ coach: 0, validator: 0, taste: 0 });
      setOpenCohort(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [passData, usageData, cohort] = await Promise.all([
      fetchUserPasses(),
      fetchUsageCounts(),
      fetchOpenCohort(),
    ]);
    setPasses(passData);
    const counts: Record<FeatureKey, number> = { coach: 0, validator: 0, taste: 0 };
    usageData.forEach(u => {
      if (u.feature in counts) counts[u.feature as FeatureKey] = u.count;
    });
    setUsageCounts(counts);
    setOpenCohort(cohort);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const hasPaidPass = hasActivePass(passes);
  const daysLeft = daysRemaining(passes);

  const isLocked = useCallback(
    (feature: FeatureKey) => isFeatureLocked(feature, usageCounts[feature], hasPaidPass),
    [usageCounts, hasPaidPass],
  );

  const getUsage = useCallback(
    (feature: FeatureKey) => ({ used: usageCounts[feature], limit: FREE_LIMITS[feature] }),
    [usageCounts],
  );

  return (
    <PassContext.Provider value={{
      passes, usageCounts, openCohort,
      hasPaidPass, daysLeft,
      isLocked, getUsage, refresh, loading,
    }}>
      {children}
    </PassContext.Provider>
  );
}

export function usePass(): PassContextType {
  const ctx = useContext(PassContext);
  if (!ctx) throw new Error('usePass must be used within PassProvider');
  return ctx;
}
