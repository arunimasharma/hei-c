/**
 * useFrictionCredibility
 *
 * React hook that loads all stored PM Graph evaluation records from
 * EvaluationStore and computes a dimension-score-backed CredibilityProfile.
 *
 * Usage (InfluencePanel):
 *
 *   const { pmProfile, pmEvalCount, loading } = useFrictionCredibility();
 *
 *   const credScore = pmProfile ? pmProfile.score : insight.credibilityScore;
 *   const expertTags = pmProfile ? pmProfile.expertThemes : insight.expertTags;
 *
 * Guarantees:
 *  - pmProfile is null until the IndexedDB read resolves (typically < 50 ms).
 *  - If EvaluationStore throws, pmProfile remains null — UI degrades to
 *    InsightStore-backed values without any error surfaced to the user.
 *  - The effect is cancelled on unmount (no setState after unmount).
 *  - The hook does not poll — it loads once on mount.  Callers that need to
 *    reflect a newly-completed evaluation should force a re-render (e.g. by
 *    passing a key derived from evalStatus).
 */

import { useState, useEffect } from 'react';
import { EvaluationStore } from './EvaluationStore';
import { computePMGraphFrictionCredibility } from './pmGraphCredibility';
import type { CredibilityProfile } from '../../lib/credibilityEngine';

export interface UseFrictionCredibilityResult {
  /**
   * PM Graph-backed CredibilityProfile.
   * Null while loading or if EvaluationStore is unavailable.
   * Zero-state (score:0, totalExercises:0) when no evaluated records exist.
   */
  pmProfile: CredibilityProfile | null;
  /** Number of PM Graph-evaluated records that contributed to the profile. */
  pmEvalCount: number;
  /** True while the async IndexedDB read is in flight. */
  loading: boolean;
}

export function useFrictionCredibility(): UseFrictionCredibilityResult {
  const [pmProfile,    setPmProfile]    = useState<CredibilityProfile | null>(null);
  const [pmEvalCount,  setPmEvalCount]  = useState(0);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    EvaluationStore.getAll()
      .then(records => {
        if (cancelled) return;
        const profile = computePMGraphFrictionCredibility(records);
        setPmProfile(profile);
        // totalExercises reflects deduplicated records with valid dimension_scores.
        setPmEvalCount(profile.totalExercises);
      })
      .catch(() => {
        if (cancelled) return;
        // Silently degrade — InfluencePanel falls back to InsightStore.
        setPmProfile(null);
        setPmEvalCount(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { pmProfile, pmEvalCount, loading };
}
