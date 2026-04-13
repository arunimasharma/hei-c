/**
 * usePMGraphEvaluations
 *
 * Single async hook that loads all PM Graph evaluation records from
 * EvaluationStore and pre-computes aggregates needed by the three display pages
 * (Insights, Signals, Influence).
 *
 * This is the single source-of-truth for raw PM Graph data in the UI.
 * `useFrictionCredibility` is a lighter companion hook used by InfluencePanel
 * for the credibility score alone — it remains unchanged.
 *
 * Usage:
 *
 *   const { records, loading, dimensionAverages, rankedDimensions,
 *           topMissedInsights, contestedRatio, surfaceStats } = usePMGraphEvaluations();
 *
 * Guarantees:
 *  - All fields are null / empty-array while loading.
 *  - If EvaluationStore throws, all fields stay null/empty — no UI crash.
 *  - Records with null dimension_scores are included in `records` but excluded
 *    from all computed aggregates.
 *  - The effect is cancelled on unmount — no setState after unmount.
 */

import { useState, useEffect } from 'react';
import { EvaluationStore } from './EvaluationStore';
import type { PMGraphEvaluationRecord } from './EvaluationStore';
import {
  computeDimensionAverages,
  rankDimensions,
  aggregateMissedInsights,
  computeContestedRatio,
  computeSurfaceStats,
  type DimensionAverages,
  type RankedDimension,
  type SurfaceStat,
} from './pmGraphAggregates';

export interface UsePMGraphEvaluationsResult {
  /** All stored PM Graph evaluation records, newest first. */
  records:           PMGraphEvaluationRecord[];
  /** True while the IndexedDB read is in flight. */
  loading:           boolean;
  /** Per-dimension mean score [0,1] across all records with dimension_scores. Null when none. */
  dimensionAverages: DimensionAverages | null;
  /** Dimensions sorted highest → lowest average score. Empty when no data. */
  rankedDimensions:  RankedDimension[];
  /** Most frequently missed insights across all records, capped at 5. */
  topMissedInsights: string[];
  /** Fraction of records with contested=true among those with a boolean value. Null when none. */
  contestedRatio:    number | null;
  /** Per-surface aggregate stats sorted by avgScore desc. */
  surfaceStats:      SurfaceStat[];
}

const EMPTY: UsePMGraphEvaluationsResult = {
  records:           [],
  loading:           true,
  dimensionAverages: null,
  rankedDimensions:  [],
  topMissedInsights: [],
  contestedRatio:    null,
  surfaceStats:      [],
};

export function usePMGraphEvaluations(): UsePMGraphEvaluationsResult {
  const [result, setResult] = useState<UsePMGraphEvaluationsResult>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    EvaluationStore.getAll()
      .then(records => {
        if (cancelled) return;
        const dimensionAverages = computeDimensionAverages(records);
        setResult({
          records,
          loading:           false,
          dimensionAverages,
          rankedDimensions:  rankDimensions(dimensionAverages),
          topMissedInsights: aggregateMissedInsights(records),
          contestedRatio:    computeContestedRatio(records),
          surfaceStats:      computeSurfaceStats(records),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setResult({ ...EMPTY, loading: false });
      });

    return () => { cancelled = true; };
  }, []);

  return result;
}
