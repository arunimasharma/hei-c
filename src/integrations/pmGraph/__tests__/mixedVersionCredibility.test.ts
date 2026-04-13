/**
 * mixedVersionCredibility.test.ts
 *
 * Tests that credibility score, expert-tag, and trend (versionMix) logic remain
 * correct and non-deceptive when a user's history contains evaluations produced
 * under different rubric_version or graph_version values.
 *
 * Policy under test (Policy A — aggregate + label):
 *   • All records are included in credibility computation regardless of version.
 *   • Per-record provenance (rubric_version, graph_version) is preserved frozen.
 *   • CredibilityProfile.versionMix reports which scoring regimes are present.
 *   • isMixed === true signals the UI to show a disclosure label.
 *   • Scoring is deterministic — same input always produces the same output.
 *
 * Test matrix (per the task specification):
 *   T1. Two records with different rubric_version values
 *   T2. Two records with different graph_version values
 *   T3. Mixed history still renders a trend (versionMix populated)
 *   T4. Expert-tag computation remains explainable (accuracy + attempts surfaced)
 *   T5. Single-version history produces versionMix.isMixed === false
 *   T6. Legacy records with no versionKey produce versionMix === null
 *   T7. Mixed history score is deterministic (same input → same score)
 *   T8. versionMix.distinctVersions are sorted — stable across insertion order
 *   T9. Expert tag is per-theme and version-agnostic (all versions contribute)
 *  T10. Records from three distinct regimes → isMixed true, three distinct keys
 */

import { describe, it, expect } from 'vitest';
import {
  computeCredibilityProfile,
  collectVersionMix,
  type ExerciseRecord,
} from '../../../lib/credibilityEngine';
import {
  computePMGraphFrictionCredibility,
  pmGraphRecordToExerciseRecord,
} from '../pmGraphCredibility';
import type { PMGraphEvaluationRecord } from '../EvaluationStore';

// ── Fixtures ──────────────────────────────────────────────────────────────────

let _seq = 0;

/**
 * Builds a minimal PMGraphEvaluationRecord for a given rubric + graph version.
 * Sequences created_at 2 minutes apart to stay outside the 60 s dedup window.
 */
function makePMRecord(
  rubricVersion: string,
  graphVersion:  string,
  overrides: Partial<PMGraphEvaluationRecord> = {},
): PMGraphEvaluationRecord {
  _seq++;
  const submissionId = overrides.hello_eq_submission_id ?? `is_mv_${_seq}`;
  return {
    id:                     `eval_sub_${submissionId}`,
    member_id:              null,
    hello_eq_exercise_id:   'fc_001',
    hello_eq_submission_id: submissionId,
    exercise_type:          'friction_case',
    overall_score:          0.75,
    dimension_scores: {
      product_judgment:   0.75,
      specificity:        0.75,
      tradeoff_awareness: 0.75,
      segmentation_logic: 0.75,
      strategic_empathy:  0.75,
      market_inference:   0.75,
    },
    feedback:               null,
    top_missed_insights:    null,
    competing_stances:      null,
    contested:              null,
    benchmark_surface:      'pricing_page',
    graph_case_id:          null,
    cluster_ids_used:       null,
    rubric_version:         rubricVersion,
    graph_version:          graphVersion,
    evaluated_at:           new Date(_seq * 120_000).toISOString(),
    weights_used:           null,
    rubric_profile:         null,
    curation_version:       null,
    scoring_engine_version: null,
    expert_tag_signals:     null,
    credibility_event:      null,
    created_at:             new Date(_seq * 120_000).toISOString(),
    sync_status:            'pending',
    ...overrides,
  };
}

/** Builds an ExerciseRecord with an explicit versionKey for engine-level tests. */
function makeExercise(
  versionKey: string | undefined,
  theme: ExerciseRecord['theme'] = 'pricing',
  score = 0.75,
): ExerciseRecord {
  _seq++;
  return {
    id:        `ex_mv_${_seq}`,
    theme,
    score,
    maxScore:  1,
    createdAt: _seq * 120_000,
    versionKey,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// T1 — Two records with different rubric_version values
// ─────────────────────────────────────────────────────────────────────────────

describe('T1 — two records, different rubric_version', () => {
  const r1 = makePMRecord('1.0.0', 'pm-graph-v1');
  const r2 = makePMRecord('2.1.0', 'pm-graph-v1'); // same graph model, new rubric

  it('both records are projected to ExerciseRecords (neither excluded)', () => {
    const e1 = pmGraphRecordToExerciseRecord(r1);
    const e2 = pmGraphRecordToExerciseRecord(r2);
    expect(e1).not.toBeNull();
    expect(e2).not.toBeNull();
  });

  it('each projected record carries the correct versionKey', () => {
    const e1 = pmGraphRecordToExerciseRecord(r1)!;
    const e2 = pmGraphRecordToExerciseRecord(r2)!;
    expect(e1.versionKey).toBe('1.0.0::pm-graph-v1');
    expect(e2.versionKey).toBe('2.1.0::pm-graph-v1');
  });

  it('versionMix.isMixed === true in the resulting CredibilityProfile', () => {
    const profile = computePMGraphFrictionCredibility([r1, r2]);
    expect(profile.versionMix).not.toBeNull();
    expect(profile.versionMix!.isMixed).toBe(true);
  });

  it('versionMix.distinctVersions contains both rubric version keys', () => {
    const profile = computePMGraphFrictionCredibility([r1, r2]);
    expect(profile.versionMix!.distinctVersions).toContain('1.0.0::pm-graph-v1');
    expect(profile.versionMix!.distinctVersions).toContain('2.1.0::pm-graph-v1');
    expect(profile.versionMix!.distinctVersions).toHaveLength(2);
  });

  it('both attempts are counted (totalExercises reflects both records)', () => {
    const profile = computePMGraphFrictionCredibility([r1, r2]);
    expect(profile.totalExercises).toBe(2);
  });

  it('credibility score is non-zero (aggregates across versions)', () => {
    const profile = computePMGraphFrictionCredibility([r1, r2]);
    expect(profile.score).toBeGreaterThan(0);
    expect(profile.score).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T2 — Two records with different graph_version values
// ─────────────────────────────────────────────────────────────────────────────

describe('T2 — two records, different graph_version', () => {
  const r1 = makePMRecord('1.0.0', 'pm-graph-v1');
  const r2 = makePMRecord('1.0.0', 'pm-graph-v2'); // same rubric, upgraded model

  it('each projected record carries the correct versionKey', () => {
    const e1 = pmGraphRecordToExerciseRecord(r1)!;
    const e2 = pmGraphRecordToExerciseRecord(r2)!;
    expect(e1.versionKey).toBe('1.0.0::pm-graph-v1');
    expect(e2.versionKey).toBe('1.0.0::pm-graph-v2');
  });

  it('versionMix.isMixed === true when graph_versions differ', () => {
    const profile = computePMGraphFrictionCredibility([r1, r2]);
    expect(profile.versionMix!.isMixed).toBe(true);
  });

  it('versionMix.distinctVersions has exactly two entries', () => {
    const profile = computePMGraphFrictionCredibility([r1, r2]);
    expect(profile.versionMix!.distinctVersions).toHaveLength(2);
  });

  it('score remains bounded 0–100', () => {
    const { score } = computePMGraphFrictionCredibility([r1, r2]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T3 — Mixed history renders trends (versionMix is populated and useful)
// ─────────────────────────────────────────────────────────────────────────────

describe('T3 — mixed history still renders trends', () => {
  it('versionMix is non-null so the UI can render a version disclosure label', () => {
    const records = [
      makePMRecord('1.0.0', 'pm-graph-v1', { benchmark_surface: 'pricing_page' }),
      makePMRecord('2.1.0', 'pm-graph-v2', { benchmark_surface: 'product_ux' }),
    ];
    const profile = computePMGraphFrictionCredibility(records);
    // Both records land in different themes — multi-theme credibility still works.
    expect(profile.themes.pricing).toBeDefined();
    expect(profile.themes.ux).toBeDefined();
    // versionMix is populated so the UI can surface a trend disclaimer.
    expect(profile.versionMix).not.toBeNull();
    expect(profile.versionMix!.isMixed).toBe(true);
    // The profile has a score and confidence — trend computation proceeds.
    expect(typeof profile.score).toBe('number');
    expect(profile.confidence).toBeDefined();
  });

  it('adding more records of a third version extends distinctVersions', () => {
    const records = [
      makePMRecord('1.0.0', 'pm-graph-v1'),
      makePMRecord('2.0.0', 'pm-graph-v1'),
      makePMRecord('2.0.0', 'pm-graph-v2'),
    ];
    const profile = computePMGraphFrictionCredibility(records);
    expect(profile.versionMix!.distinctVersions).toHaveLength(3);
  });

  it('trend stays deterministic across repeated calls with same input', () => {
    const records = [
      makePMRecord('1.0.0', 'pm-graph-v1'),
      makePMRecord('2.1.0', 'pm-graph-v2'),
    ];
    const p1 = computePMGraphFrictionCredibility(records);
    const p2 = computePMGraphFrictionCredibility(records);
    expect(p1.score).toBe(p2.score);
    expect(p1.versionMix).toStrictEqual(p2.versionMix);
    expect(p1.expertThemes).toStrictEqual(p2.expertThemes);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T4 — Expert-tag computation remains explainable
// ─────────────────────────────────────────────────────────────────────────────

describe('T4 — expert-tag computation is explainable under mixed versions', () => {
  it('expertTags carry accuracy and attempts regardless of version mix', () => {
    const records = [
      makePMRecord('1.0.0', 'pm-graph-v1', {
        hello_eq_submission_id: 'is_exp_a',
        benchmark_surface:      'pricing_page',
        dimension_scores:       { product_judgment: 0.8, specificity: 0.8, tradeoff_awareness: 0.8, segmentation_logic: 0.8, strategic_empathy: 0.8, market_inference: 0.8 },
      }),
      makePMRecord('2.1.0', 'pm-graph-v2', {
        hello_eq_submission_id: 'is_exp_b',
        benchmark_surface:      'pricing_page',
        dimension_scores:       { product_judgment: 0.7, specificity: 0.7, tradeoff_awareness: 0.7, segmentation_logic: 0.7, strategic_empathy: 0.7, market_inference: 0.7 },
      }),
    ];
    const profile = computePMGraphFrictionCredibility(records);
    const tag = profile.expertTags['pricing'];

    // Tag is present with full details — UI can explain the decision.
    expect(tag).toBeDefined();
    expect(typeof tag!.accuracy).toBe('number');
    expect(typeof tag!.attempts).toBe('number');
    expect(tag!.attempts).toBe(2);
    // accuracy ≥ 0.60 and attempts ≥ 2 → tag is earned
    expect(tag!.accuracy).toBeGreaterThanOrEqual(0.6);
    expect(tag!.isExpert).toBe(true);
  });

  it('expert tag is revocable in mixed-version history when accuracy drops below threshold', () => {
    // Two high-scoring records from v1 → would earn expert tag
    const highV1 = [
      makePMRecord('1.0.0', 'pm-graph-v1', {
        hello_eq_submission_id: 'is_rev_a',
        dimension_scores:       { product_judgment: 0.8, specificity: 0.8, tradeoff_awareness: 0.8, segmentation_logic: 0.8, strategic_empathy: 0.8, market_inference: 0.8 },
      }),
      makePMRecord('1.0.0', 'pm-graph-v1', {
        hello_eq_submission_id: 'is_rev_b',
        dimension_scores:       { product_judgment: 0.8, specificity: 0.8, tradeoff_awareness: 0.8, segmentation_logic: 0.8, strategic_empathy: 0.8, market_inference: 0.8 },
      }),
    ];
    expect(computePMGraphFrictionCredibility(highV1).expertTags['pricing']?.isExpert).toBe(true);

    // Add four low-scoring records from v2 → overall accuracy falls below 60%
    const lowV2 = Array.from({ length: 4 }, (_, i) =>
      makePMRecord('2.1.0', 'pm-graph-v2', {
        hello_eq_submission_id: `is_rev_c${i}`,
        dimension_scores:       { product_judgment: 0, specificity: 0, tradeoff_awareness: 0, segmentation_logic: 0, strategic_empathy: 0, market_inference: 0 },
      }),
    );
    const combined = computePMGraphFrictionCredibility([...highV1, ...lowV2]);
    expect(combined.expertTags['pricing']?.isExpert).toBe(false);
    // Accuracy and attempts are still surfaced for explainability.
    expect(combined.expertTags['pricing']?.attempts).toBe(6);
    expect(combined.expertTags['pricing']?.accuracy).toBeLessThan(0.6);
  });

  it('expert tag result is identical regardless of version insertion order', () => {
    const v1Record = makePMRecord('1.0.0', 'pm-graph-v1', { hello_eq_submission_id: 'is_ord_a', dimension_scores: { product_judgment: 0.8, specificity: 0.8, tradeoff_awareness: 0.8, segmentation_logic: 0.8, strategic_empathy: 0.8, market_inference: 0.8 } });
    const v2Record = makePMRecord('2.1.0', 'pm-graph-v2', { hello_eq_submission_id: 'is_ord_b', dimension_scores: { product_judgment: 0.7, specificity: 0.7, tradeoff_awareness: 0.7, segmentation_logic: 0.7, strategic_empathy: 0.7, market_inference: 0.7 } });

    const profileAB = computePMGraphFrictionCredibility([v1Record, v2Record]);
    const profileBA = computePMGraphFrictionCredibility([v2Record, v1Record]);

    expect(profileAB.expertTags['pricing']?.isExpert).toBe(profileBA.expertTags['pricing']?.isExpert);
    expect(profileAB.expertTags['pricing']?.accuracy).toBeCloseTo(profileBA.expertTags['pricing']!.accuracy);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T5 — Single-version history: isMixed === false
// ─────────────────────────────────────────────────────────────────────────────

describe('T5 — single-version history is NOT flagged as mixed', () => {
  it('three records from the same version produce isMixed === false', () => {
    const records = Array.from({ length: 3 }, (_, i) =>
      makePMRecord('1.0.0', 'pm-graph-v1', { hello_eq_submission_id: `is_sv_${i}` }),
    );
    const profile = computePMGraphFrictionCredibility(records);
    expect(profile.versionMix).not.toBeNull();
    expect(profile.versionMix!.isMixed).toBe(false);
    expect(profile.versionMix!.distinctVersions).toHaveLength(1);
    expect(profile.versionMix!.distinctVersions[0]).toBe('1.0.0::pm-graph-v1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T6 — Legacy records without versionKey: versionMix === null
// ─────────────────────────────────────────────────────────────────────────────

describe('T6 — legacy ExerciseRecords (no versionKey) produce versionMix === null', () => {
  it('engine returns versionMix null when no record carries a versionKey', () => {
    const exercises: ExerciseRecord[] = [
      { id: 'leg_1', theme: 'pricing', score: 1,   maxScore: 1, createdAt: 120_000 },
      { id: 'leg_2', theme: 'pricing', score: 0.5, maxScore: 1, createdAt: 240_000 },
    ];
    const profile = computeCredibilityProfile(exercises);
    expect(profile.versionMix).toBeNull();
  });

  it('engine returns versionMix null for empty exercises', () => {
    const profile = computeCredibilityProfile([]);
    expect(profile.versionMix).toBeNull();
  });

  it('InsightStore path (no versionKey) still computes correct credibility', () => {
    const exercises: ExerciseRecord[] = [
      { id: 'ins_1', theme: 'ux', score: 1, maxScore: 1, createdAt: 120_000 },
      { id: 'ins_2', theme: 'ux', score: 1, maxScore: 1, createdAt: 240_000 },
    ];
    const profile = computeCredibilityProfile(exercises);
    expect(profile.expertTags['ux']?.isExpert).toBe(true);
    expect(profile.versionMix).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T7 — Determinism: same input always produces same score
// ─────────────────────────────────────────────────────────────────────────────

describe('T7 — mixed-version scoring is deterministic', () => {
  it('score does not change across repeated calls with identical mixed input', () => {
    const exercises = [
      makeExercise('1.0.0::pm-graph-v1', 'pricing', 0.8),
      makeExercise('2.1.0::pm-graph-v2', 'pricing', 0.7),
      makeExercise('1.0.0::pm-graph-v1', 'ux',      0.6),
    ];
    const scores = Array.from({ length: 5 }, () => computeCredibilityProfile(exercises).score);
    expect(new Set(scores).size).toBe(1); // all identical
  });

  it('versionMix object is value-identical across repeated calls', () => {
    const exercises = [
      makeExercise('1.0.0::pm-graph-v1', 'pricing', 0.8),
      makeExercise('2.1.0::pm-graph-v2', 'pricing', 0.7),
    ];
    const mixes = Array.from({ length: 3 }, () => computeCredibilityProfile(exercises).versionMix);
    for (const m of mixes) {
      expect(m).toStrictEqual(mixes[0]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T8 — distinctVersions are sorted (stable regardless of insertion order)
// ─────────────────────────────────────────────────────────────────────────────

describe('T8 — versionMix.distinctVersions are always sorted', () => {
  it('versions are returned in lexicographic ascending order', () => {
    // Insert in reverse order to verify sorting
    const exercises = [
      makeExercise('2.1.0::pm-graph-v2', 'pricing', 0.7),
      makeExercise('1.0.0::pm-graph-v1', 'pricing', 0.8),
    ];
    const { distinctVersions } = computeCredibilityProfile(exercises).versionMix!;
    expect(distinctVersions[0]).toBe('1.0.0::pm-graph-v1');
    expect(distinctVersions[1]).toBe('2.1.0::pm-graph-v2');
  });

  it('PM Graph bridge produces sorted versions regardless of record order', () => {
    const records = [
      makePMRecord('2.1.0', 'pm-graph-v2', { hello_eq_submission_id: 'is_sort_a' }),
      makePMRecord('1.0.0', 'pm-graph-v1', { hello_eq_submission_id: 'is_sort_b' }),
    ];
    const { distinctVersions } = computePMGraphFrictionCredibility(records).versionMix!;
    expect(distinctVersions).toEqual([...distinctVersions].sort());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T9 — Expert tags are per-theme; all versions contribute
// ─────────────────────────────────────────────────────────────────────────────

describe('T9 — expert tags are per-theme and include attempts from all versions', () => {
  it('one v1 attempt + one v2 attempt in same theme satisfies the 2-attempt minimum', () => {
    const records = [
      makePMRecord('1.0.0', 'pm-graph-v1', {
        hello_eq_submission_id: 'is_t9_a',
        benchmark_surface:      'onboarding_flow',
        dimension_scores:       { product_judgment: 0.75, specificity: 0.75, tradeoff_awareness: 0.75, segmentation_logic: 0.75, strategic_empathy: 0.75, market_inference: 0.75 },
      }),
      makePMRecord('2.1.0', 'pm-graph-v2', {
        hello_eq_submission_id: 'is_t9_b',
        benchmark_surface:      'onboarding_flow',
        dimension_scores:       { product_judgment: 0.75, specificity: 0.75, tradeoff_awareness: 0.75, segmentation_logic: 0.75, strategic_empathy: 0.75, market_inference: 0.75 },
      }),
    ];
    const profile = computePMGraphFrictionCredibility(records);
    expect(profile.expertTags['onboarding']?.attempts).toBe(2);
    expect(profile.expertTags['onboarding']?.isExpert).toBe(true);
    expect(profile.versionMix!.isMixed).toBe(true);
  });

  it('expert tags in different themes are computed independently under mixed versions', () => {
    const records = [
      // pricing: 2 attempts from v1 → expert
      makePMRecord('1.0.0', 'pm-graph-v1', { hello_eq_submission_id: 'is_t9_p1', benchmark_surface: 'pricing_page', dimension_scores: { product_judgment: 0.8, specificity: 0.8, tradeoff_awareness: 0.8, segmentation_logic: 0.8, strategic_empathy: 0.8, market_inference: 0.8 } }),
      makePMRecord('1.0.0', 'pm-graph-v1', { hello_eq_submission_id: 'is_t9_p2', benchmark_surface: 'pricing_page', dimension_scores: { product_judgment: 0.8, specificity: 0.8, tradeoff_awareness: 0.8, segmentation_logic: 0.8, strategic_empathy: 0.8, market_inference: 0.8 } }),
      // ux: 1 attempt from v2 → NOT expert
      makePMRecord('2.1.0', 'pm-graph-v2', { hello_eq_submission_id: 'is_t9_u1', benchmark_surface: 'product_ux',  dimension_scores: { product_judgment: 0.9, specificity: 0.9, tradeoff_awareness: 0.9, segmentation_logic: 0.9, strategic_empathy: 0.9, market_inference: 0.9 } }),
    ];
    const profile = computePMGraphFrictionCredibility(records);
    expect(profile.expertThemes).toContain('pricing');
    expect(profile.expertThemes).not.toContain('ux');
    expect(profile.expertTags['ux']?.isExpert).toBe(false);
    expect(profile.expertTags['ux']?.attempts).toBe(1);
    expect(profile.versionMix!.isMixed).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T10 — Three distinct regimes
// ─────────────────────────────────────────────────────────────────────────────

describe('T10 — three distinct scoring regimes in one profile', () => {
  it('produces three entries in distinctVersions and isMixed === true', () => {
    const records = [
      makePMRecord('1.0.0', 'pm-graph-v1', { hello_eq_submission_id: 'is_3r_a' }),
      makePMRecord('1.0.0', 'pm-graph-v2', { hello_eq_submission_id: 'is_3r_b' }),
      makePMRecord('2.0.0', 'pm-graph-v2', { hello_eq_submission_id: 'is_3r_c' }),
    ];
    const { versionMix } = computePMGraphFrictionCredibility(records);
    expect(versionMix!.isMixed).toBe(true);
    expect(versionMix!.distinctVersions).toHaveLength(3);
    expect(versionMix!.distinctVersions).toContain('1.0.0::pm-graph-v1');
    expect(versionMix!.distinctVersions).toContain('1.0.0::pm-graph-v2');
    expect(versionMix!.distinctVersions).toContain('2.0.0::pm-graph-v2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// collectVersionMix — unit tests for the helper directly
// ─────────────────────────────────────────────────────────────────────────────

describe('collectVersionMix — engine helper', () => {
  it('returns null when no exercise has a versionKey', () => {
    const exs: ExerciseRecord[] = [
      { id: 'x1', theme: 'pricing', score: 1, maxScore: 1, createdAt: 1 },
      { id: 'x2', theme: 'ux',      score: 1, maxScore: 1, createdAt: 2 },
    ];
    expect(collectVersionMix(exs)).toBeNull();
  });

  it('returns a single-entry VersionMixInfo when all records share a key', () => {
    const exs = [
      makeExercise('1.0.0::pm-graph-v1', 'pricing'),
      makeExercise('1.0.0::pm-graph-v1', 'ux'),
    ];
    const mix = collectVersionMix(exs)!;
    expect(mix.isMixed).toBe(false);
    expect(mix.distinctVersions).toEqual(['1.0.0::pm-graph-v1']);
  });

  it('returns isMixed true and two entries when records differ by rubric version', () => {
    const exs = [
      makeExercise('1.0.0::pm-graph-v1', 'pricing'),
      makeExercise('2.1.0::pm-graph-v1', 'pricing'),
    ];
    const mix = collectVersionMix(exs)!;
    expect(mix.isMixed).toBe(true);
    expect(mix.distinctVersions).toHaveLength(2);
  });

  it('handles a mix of keyed and unkeyed records (null treated as absent)', () => {
    // One keyed, one unkeyed — still produces a VersionMixInfo because at least
    // one record has a key; the unkeyed record is excluded from the key set.
    const exs: ExerciseRecord[] = [
      { id: 'k1', theme: 'pricing', score: 1, maxScore: 1, createdAt: 120_000, versionKey: '1.0.0::pm-graph-v1' },
      { id: 'k2', theme: 'ux',      score: 1, maxScore: 1, createdAt: 240_000 }, // no versionKey
    ];
    const mix = collectVersionMix(exs)!;
    expect(mix).not.toBeNull();
    expect(mix.isMixed).toBe(false);    // only ONE distinct version key present
    expect(mix.distinctVersions).toEqual(['1.0.0::pm-graph-v1']);
  });

  it('returns null for an empty array', () => {
    expect(collectVersionMix([])).toBeNull();
  });
});
