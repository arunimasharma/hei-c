/**
 * pmGraphAggregates.ts
 *
 * Pure, deterministic aggregation functions over PMGraphEvaluationRecord arrays.
 *
 * All functions are:
 *  - Side-effect free — no I/O, no state
 *  - Safe on empty input — always return a typed null or empty structure
 *  - Testable in Node without a browser environment
 *
 * These functions feed the usePMGraphEvaluations hook and the three UI pages
 * that consume PM Graph-backed Friction Case data (Insights, Signals, Influence).
 */

import type { PMGraphEvaluationRecord } from './EvaluationStore';
import { SURFACE_TO_THEME } from './pmGraphCredibility';
import type { FrictionTheme } from '../../data/frictionCases';

// ── Dimension labels ──────────────────────────────────────────────────────────

/**
 * Display labels for the six PM Graph rubric dimensions.
 * Ordered from most general to most specialised for consistent display.
 */
export const DIMENSION_LABELS: Record<string, string> = {
  product_judgment:   'Product Judgment',
  specificity:        'Specificity',
  tradeoff_awareness: 'Tradeoff Awareness',
  segmentation_logic: 'Segmentation Logic',
  strategic_empathy:  'Strategic Empathy',
  market_inference:   'Market Inference',
};

/** Canonical dimension key order for display. */
export const DIMENSION_ORDER = [
  'product_judgment',
  'specificity',
  'tradeoff_awareness',
  'segmentation_logic',
  'strategic_empathy',
  'market_inference',
] as const;

export type DimensionKey = (typeof DIMENSION_ORDER)[number];

// ── Output types ──────────────────────────────────────────────────────────────

/** Average score [0,1] per dimension across all eligible records. */
export type DimensionAverages = Record<DimensionKey, number>;

/** A dimension key sorted by average score, highest first. */
export interface RankedDimension {
  key:   DimensionKey;
  label: string;
  avg:   number;
}

/** Per-surface aggregated stats from PM Graph records. */
export interface SurfaceStat {
  theme:     FrictionTheme;
  surface:   string;
  count:     number;
  avgScore:  number;
}

// ── computeDimensionAverages ──────────────────────────────────────────────────

/**
 * Computes the mean score for each of the six rubric dimensions across all
 * records that have valid `dimension_scores`.
 *
 * Records with null dimension_scores are silently excluded — they represent
 * degraded or partial evaluations and must not contribute misleading zeros.
 *
 * Returns null when no eligible records exist (safe empty-state sentinel).
 */
export function computeDimensionAverages(
  records: PMGraphEvaluationRecord[],
): DimensionAverages | null {
  const eligible = records.filter(r => r.dimension_scores != null);
  if (eligible.length === 0) return null;

  const sums: Record<DimensionKey, number> = {
    product_judgment:   0,
    specificity:        0,
    tradeoff_awareness: 0,
    segmentation_logic: 0,
    strategic_empathy:  0,
    market_inference:   0,
  };

  for (const r of eligible) {
    const d = r.dimension_scores;
    sums.product_judgment   += d.product_judgment;
    sums.specificity        += d.specificity;
    sums.tradeoff_awareness += d.tradeoff_awareness;
    sums.segmentation_logic += d.segmentation_logic;
    sums.strategic_empathy  += d.strategic_empathy;
    sums.market_inference   += d.market_inference;
  }

  const n = eligible.length;
  return {
    product_judgment:   sums.product_judgment   / n,
    specificity:        sums.specificity        / n,
    tradeoff_awareness: sums.tradeoff_awareness / n,
    segmentation_logic: sums.segmentation_logic / n,
    strategic_empathy:  sums.strategic_empathy  / n,
    market_inference:   sums.market_inference   / n,
  };
}

/**
 * Ranks dimensions by average score, highest first.
 * Returns an empty array when averages is null.
 */
export function rankDimensions(averages: DimensionAverages | null): RankedDimension[] {
  if (!averages) return [];
  return DIMENSION_ORDER
    .map(key => ({ key, label: DIMENSION_LABELS[key], avg: averages[key] }))
    .sort((a, b) => b.avg - a.avg);
}

// ── aggregateMissedInsights ───────────────────────────────────────────────────

/**
 * Collects all strings from `top_missed_insights` across all records, dedupes
 * them (case-insensitive), and returns them sorted by frequency (most common
 * first), limited to `limit` entries.
 *
 * Records with null `top_missed_insights` are silently skipped.
 * Returns an empty array when no insights exist.
 */
export function aggregateMissedInsights(
  records: PMGraphEvaluationRecord[],
  limit = 5,
): string[] {
  const freq = new Map<string, { display: string; count: number }>();

  for (const r of records) {
    if (!r.top_missed_insights) continue;
    for (const raw of r.top_missed_insights) {
      const key = raw.trim().toLowerCase();
      if (!key) continue;
      const existing = freq.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        freq.set(key, { display: raw.trim(), count: 1 });
      }
    }
  }

  return [...freq.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(e => e.display);
}

// ── computeContestedRatio ─────────────────────────────────────────────────────

/**
 * Computes the fraction of records where `contested === true`.
 *
 * Only records where `contested` is a boolean (not null/undefined) are counted
 * in the denominator.  This ensures sparse data from early PM Graph versions
 * doesn't skew the ratio.
 *
 * Returns null when no records have a boolean `contested` value.
 */
export function computeContestedRatio(records: PMGraphEvaluationRecord[]): number | null {
  const eligible = records.filter(r => typeof r.contested === 'boolean');
  if (eligible.length === 0) return null;

  const contestedCount = eligible.filter(r => r.contested === true).length;
  return contestedCount / eligible.length;
}

// ── computeSurfaceStats ───────────────────────────────────────────────────────

/**
 * Aggregates records by benchmark_surface — returns one SurfaceStat per surface
 * encountered, sorted by avgScore descending.
 *
 * Records with null dimension_scores are excluded from avgScore computation.
 * Records with an unknown surface are excluded entirely.
 */
export function computeSurfaceStats(records: PMGraphEvaluationRecord[]): SurfaceStat[] {
  const map = new Map<string, { theme: FrictionTheme; total: number; count: number; evalTotal: number; evalCount: number }>();

  for (const r of records) {
    const theme = SURFACE_TO_THEME[r.benchmark_surface];
    if (!theme) continue;

    let entry = map.get(r.benchmark_surface);
    if (!entry) {
      entry = { theme, total: 0, count: 0, evalTotal: 0, evalCount: 0 };
      map.set(r.benchmark_surface, entry);
    }
    entry.count += 1;

    if (r.dimension_scores) {
      const avg = (
        r.dimension_scores.product_judgment +
        r.dimension_scores.specificity +
        r.dimension_scores.tradeoff_awareness +
        r.dimension_scores.segmentation_logic +
        r.dimension_scores.strategic_empathy +
        r.dimension_scores.market_inference
      ) / 6;
      entry.evalTotal += avg;
      entry.evalCount += 1;
    }
  }

  return [...map.entries()]
    .map(([surface, { theme, count, evalTotal, evalCount }]) => ({
      theme,
      surface,
      count,
      avgScore: evalCount > 0 ? evalTotal / evalCount : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}
