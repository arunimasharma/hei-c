/**
 * pmGraphCredibility.ts
 *
 * Bridge between PM Graph evaluation records (EvaluationStore) and the
 * credibility engine (credibilityEngine.ts).
 *
 * Responsibilities:
 *  1. Map `benchmark_surface` back to a `FrictionTheme` (reverse of the mapper).
 *  2. Derive a single [0,1] attempt score from PM Graph dimension_scores.
 *  3. Project PMGraphEvaluationRecords into ExerciseRecords that the existing
 *     engine pipeline can process without modification.
 *  4. Propagate `versionKey` (`<rubric_version>::<graph_version>`) so the engine
 *     can detect mixed-version histories and set `CredibilityProfile.versionMix`.
 *  5. Expose `computePMGraphFrictionCredibility` as the single public entry point.
 *
 * What this module does NOT do:
 *  - Touch InsightStore or localStorage (that path remains unchanged).
 *  - Handle UI state (see useFrictionCredibility.ts for the React hook).
 *  - Modify the credibility engine (all engine functions remain pure).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Formula summary
 *
 *   per-attempt score = avg(all 6 dimension scores)
 *   per-theme accuracy = avg(attempt scores in that theme)  [point-based]
 *   credibility score  = Σ(accuracy_i × log(1+min(n_i,10))) / Σ log(11) × 100
 *   expert tag         = attempts≥2 AND accuracy≥0.60
 *
 * Mixed-version policy: scores are aggregated across rubric/graph versions.
 * Version provenance is preserved per-record (frozen in EvaluationStore) and
 * surfaced via CredibilityProfile.versionMix.  When isMixed=true the UI shows
 * a disclosure label.  See docs/integrations/pm-graph/mixed-version-handling.md.
 *
 * Full formula derivation in docs/integrations/pm-graph/credibility-formula.md
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { FrictionTheme } from '../../data/frictionCases';
import {
  computeFrictionCaseAttemptScore,
  computeCredibilityProfile,
  type ExerciseRecord,
  type CredibilityProfile,
  type FrictionCaseDimensionScores,
} from '../../lib/credibilityEngine';
import type { PMGraphEvaluationRecord } from './EvaluationStore';

// ── Surface → theme mapping ───────────────────────────────────────────────────

/**
 * Reverse of THEME_TO_SURFACE in usePMGraphEvaluation.ts.
 *
 * `benchmark_surface` is stored on PMGraphEvaluationRecord so we can recover
 * the FrictionTheme without re-reading the static frictionCases data file.
 * Add new entries here if new themes are introduced — the engine handles them
 * automatically through its existing FrictionTheme union.
 */
export const SURFACE_TO_THEME: Record<string, FrictionTheme> = {
  pricing_page:      'pricing',
  product_ux:        'ux',
  onboarding_flow:   'onboarding',
  value_proposition: 'value',
  trust_and_safety:  'trust',
};

// ── Record projection ─────────────────────────────────────────────────────────

/**
 * Projects a PMGraphEvaluationRecord into an ExerciseRecord for the engine.
 *
 * Returns null when:
 *  - `dimension_scores` is null or undefined (evaluation was degraded or partial)
 *  - `benchmark_surface` maps to an unknown theme (future-proofing)
 *
 * Null records are silently excluded from the credibility calculation.  This
 * ensures degraded evaluations never contribute misleading scores — a record
 * that has no dimension data is simply absent from the credibility signal.
 *
 * Identity key: `hello_eq_submission_id` is used as the ExerciseRecord `id` so
 * that the engine's deduplication window operates on the same stable submission
 * identity that EvaluationStore uses.
 */
export function pmGraphRecordToExerciseRecord(
  record: PMGraphEvaluationRecord,
): ExerciseRecord | null {
  if (!record.dimension_scores) return null;

  const theme = SURFACE_TO_THEME[record.benchmark_surface];
  if (!theme) return null;

  return {
    id:         record.hello_eq_submission_id,
    theme,
    score:      computeFrictionCaseAttemptScore(
                  record.dimension_scores as FrictionCaseDimensionScores,
                ),
    maxScore:   1,
    createdAt:  new Date(record.created_at).getTime(),
    // Preserve scoring-regime identity so the engine can detect mixed histories.
    // Format mirrors groupByVersion() in EvaluationStore: 'rubric::graph'.
    versionKey: `${record.rubric_version}::${record.graph_version}`,
  };
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * computePMGraphFrictionCredibility
 *
 * Computes a CredibilityProfile from stored PM Graph evaluation records.
 *
 * Typical call site (via useFrictionCredibility hook):
 *
 *   const records = await EvaluationStore.getAll();
 *   const profile = computePMGraphFrictionCredibility(records);
 *
 * Records without dimension_scores (degraded evaluations) are silently dropped.
 * If no eligible records remain, the function returns the zero-state profile
 * that computeCredibilityProfile returns for an empty input.
 *
 * The returned CredibilityProfile is identical in shape to what
 * InsightStore.getProfile() produces — both are derived from
 * computeCredibilityProfile() with a different ExerciseRecord source.
 *
 * Non-Friction Case types (Taste Exercises, PM Interview) are not touched —
 * they use separate stores and are not passed to this function.
 */
export function computePMGraphFrictionCredibility(
  records: PMGraphEvaluationRecord[],
): CredibilityProfile {
  const exerciseRecords = records
    .map(pmGraphRecordToExerciseRecord)
    .filter((r): r is ExerciseRecord => r !== null);

  return computeCredibilityProfile(exerciseRecords);
}
