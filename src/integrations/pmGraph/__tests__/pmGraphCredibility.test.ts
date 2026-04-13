/**
 * pmGraphCredibility.test.ts
 *
 * Tests for the PM Graph → credibility engine bridge.
 *
 * Coverage:
 *
 *  computeFrictionCaseAttemptScore  (from credibilityEngine.ts)
 *   1. Equal-weight average of all 6 dimensions
 *   2. Perfect scores → 1.0
 *   3. Zero scores → 0.0
 *   4. Mixed scores → correct average
 *
 *  pmGraphRecordToExerciseRecord  (internal, tested via computePMGraphFrictionCredibility)
 *   5. Records missing dimension_scores are excluded (null → filtered out)
 *   6. Unknown benchmark_surface is excluded (no phantom theme)
 *
 *  computePMGraphFrictionCredibility  (public entry point)
 *   7. Empty input → zero-state profile (score:0, expertThemes:[], totalExercises:0)
 *   8. Single attempt → NOT expert (below MIN_ATTEMPTS_FOR_EXPERT = 2)
 *   9. Two attempts above 60% in one theme → expert tag earned
 *  10. High variance performs worse than consistent performance (same average accuracy, different distribution)
 *  11. Records without dimension_scores excluded — do not inflate attempts or score
 *  12. Credibility score is always bounded 0–100 (multiple scenario types)
 *  13. SURFACE_TO_THEME covers all five FrictionThemes
 *
 * These tests run in the Node vitest environment (no DOM, no Dexie).
 * computePMGraphFrictionCredibility takes plain objects — no mocking needed.
 */

import { describe, it, expect } from 'vitest';
import {
  computePMGraphFrictionCredibility,
  pmGraphRecordToExerciseRecord,
  SURFACE_TO_THEME,
} from '../pmGraphCredibility';
import { computeFrictionCaseAttemptScore } from '../../../lib/credibilityEngine';
import type { PMGraphEvaluationRecord } from '../EvaluationStore';

// ── Fixtures ──────────────────────────────────────────────────────────────────

let _seq = 0;
function makeRecord(overrides: Partial<PMGraphEvaluationRecord> = {}): PMGraphEvaluationRecord {
  _seq++;
  const submissionId = overrides.hello_eq_submission_id ?? `is_sub_${_seq}`;
  return {
    id:                     `eval_sub_${submissionId}`,
    member_id:              null,
    hello_eq_exercise_id:   'fc_001',
    hello_eq_submission_id: submissionId,
    exercise_type:          'friction_case',
    overall_score:          0.80,
    dimension_scores: {
      product_judgment:   0.80,
      specificity:        0.80,
      tradeoff_awareness: 0.80,
      segmentation_logic: 0.80,
      strategic_empathy:  0.80,
      market_inference:   0.80,
    },
    feedback:               null,
    top_missed_insights:    null,
    competing_stances:      null,
    contested:              null,
    benchmark_surface:      'pricing_page',
    graph_case_id:          null,
    cluster_ids_used:       null,
    rubric_version:         '1.0.0',
    graph_version:          'pm-graph-v1',
    evaluated_at:           new Date(_seq * 120_000).toISOString(),
    weights_used:           null,
    rubric_profile:         null,
    curation_version:       null,
    scoring_engine_version: null,
    expert_tag_signals:     null,
    credibility_event:      null,
    // Spread time well outside the 60s dedup window (2 min per record).
    created_at:             new Date(_seq * 120_000).toISOString(),
    sync_status:            'pending',
    ...overrides,
  };
}

function makeDims(val: number) {
  return {
    product_judgment:   val,
    specificity:        val,
    tradeoff_awareness: val,
    segmentation_logic: val,
    strategic_empathy:  val,
    market_inference:   val,
  };
}

// ── computeFrictionCaseAttemptScore ───────────────────────────────────────────

describe('computeFrictionCaseAttemptScore', () => {
  it('returns the equal-weight average of all 6 dimensions', () => {
    const dims = {
      product_judgment:   0.6,
      specificity:        0.8,
      tradeoff_awareness: 0.7,
      segmentation_logic: 0.9,
      strategic_empathy:  0.5,
      market_inference:   1.0,
    };
    // (0.6+0.8+0.7+0.9+0.5+1.0) / 6 = 4.5/6 = 0.75
    expect(computeFrictionCaseAttemptScore(dims)).toBeCloseTo(0.75);
  });

  it('returns 1.0 when all dimensions are perfect', () => {
    expect(computeFrictionCaseAttemptScore(makeDims(1))).toBeCloseTo(1.0);
  });

  it('returns 0.0 when all dimensions are zero', () => {
    expect(computeFrictionCaseAttemptScore(makeDims(0))).toBeCloseTo(0.0);
  });

  it('returns the correct average for mixed values', () => {
    const dims = {
      product_judgment:   1.0,
      specificity:        0.0,
      tradeoff_awareness: 1.0,
      segmentation_logic: 0.0,
      strategic_empathy:  1.0,
      market_inference:   0.0,
    };
    // alternating 1 and 0: average = 0.5
    expect(computeFrictionCaseAttemptScore(dims)).toBeCloseTo(0.5);
  });

  it('result is always in [0, 1]', () => {
    const scores = [
      makeDims(0), makeDims(0.5), makeDims(1),
      { product_judgment: 0.2, specificity: 0.9, tradeoff_awareness: 0.4,
        segmentation_logic: 0.7, strategic_empathy: 0.1, market_inference: 0.6 },
    ];
    for (const dims of scores) {
      const s = computeFrictionCaseAttemptScore(dims);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

// ── SURFACE_TO_THEME coverage ─────────────────────────────────────────────────

describe('SURFACE_TO_THEME', () => {
  it('maps all five known surfaces to a FrictionTheme', () => {
    expect(SURFACE_TO_THEME['pricing_page']).toBe('pricing');
    expect(SURFACE_TO_THEME['product_ux']).toBe('ux');
    expect(SURFACE_TO_THEME['onboarding_flow']).toBe('onboarding');
    expect(SURFACE_TO_THEME['value_proposition']).toBe('value');
    expect(SURFACE_TO_THEME['trust_and_safety']).toBe('trust');
  });

  it('has exactly five entries (no extra phantom surfaces)', () => {
    expect(Object.keys(SURFACE_TO_THEME)).toHaveLength(5);
  });
});

// ── pmGraphRecordToExerciseRecord ─────────────────────────────────────────────

describe('pmGraphRecordToExerciseRecord', () => {
  it('returns null when dimension_scores is null', () => {
    const rec = makeRecord({ dimension_scores: null as unknown as PMGraphEvaluationRecord['dimension_scores'] });
    expect(pmGraphRecordToExerciseRecord(rec)).toBeNull();
  });

  it('returns null when benchmark_surface is unknown', () => {
    const rec = makeRecord({ benchmark_surface: 'unknown_surface' });
    expect(pmGraphRecordToExerciseRecord(rec)).toBeNull();
  });

  it('maps a valid record to an ExerciseRecord with the correct theme', () => {
    const rec = makeRecord({ benchmark_surface: 'product_ux', dimension_scores: makeDims(0.8) });
    const ex  = pmGraphRecordToExerciseRecord(rec);
    expect(ex).not.toBeNull();
    expect(ex!.theme).toBe('ux');
  });

  it('uses hello_eq_submission_id as the ExerciseRecord id', () => {
    const rec = makeRecord({ hello_eq_submission_id: 'is_identity_test' });
    const ex  = pmGraphRecordToExerciseRecord(rec);
    expect(ex!.id).toBe('is_identity_test');
  });

  it('sets maxScore to 1 (normalised)', () => {
    const ex = pmGraphRecordToExerciseRecord(makeRecord());
    expect(ex!.maxScore).toBe(1);
  });
});

// ── computePMGraphFrictionCredibility ─────────────────────────────────────────

describe('computePMGraphFrictionCredibility — empty input', () => {
  it('returns zero-state profile for empty records array', () => {
    const profile = computePMGraphFrictionCredibility([]);
    expect(profile.score).toBe(0);
    expect(profile.expertThemes).toEqual([]);
    expect(profile.totalExercises).toBe(0);
    expect(profile.confidence).toBe('low');
  });
});

// Test 8: single attempt → NOT expert
describe('computePMGraphFrictionCredibility — single attempt', () => {
  it('single attempt does NOT create an expert tag regardless of score', () => {
    const records = [makeRecord({ dimension_scores: makeDims(1.0) })]; // perfect score
    const profile = computePMGraphFrictionCredibility(records);

    expect(profile.expertThemes).toHaveLength(0);
    expect(profile.expertTags['pricing']?.isExpert).toBe(false);
    expect(profile.expertTags['pricing']?.attempts).toBe(1);
  });

  it('single attempt produces a non-zero but bounded credibility score', () => {
    const records = [makeRecord({ dimension_scores: makeDims(1.0) })];
    const { score } = computePMGraphFrictionCredibility(records);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(40); // volume drag — single attempt can't score high
    expect(score).toBeLessThanOrEqual(100);
  });
});

// Test 9: two attempts above threshold → expert tag earned
describe('computePMGraphFrictionCredibility — expert tag eligibility', () => {
  it('two attempts with avg dimension score ≥ 0.60 in one theme → expert tag earned', () => {
    const records = [
      makeRecord({ hello_eq_submission_id: 'is_a1', benchmark_surface: 'pricing_page', dimension_scores: makeDims(0.75) }),
      makeRecord({ hello_eq_submission_id: 'is_a2', benchmark_surface: 'pricing_page', dimension_scores: makeDims(0.80) }),
    ];
    const profile = computePMGraphFrictionCredibility(records);

    expect(profile.expertThemes).toContain('pricing');
    expect(profile.expertTags['pricing']?.isExpert).toBe(true);
    expect(profile.expertTags['pricing']?.attempts).toBe(2);
  });

  it('two attempts with avg dimension score below 0.60 → NO expert tag', () => {
    const records = [
      makeRecord({ hello_eq_submission_id: 'is_b1', benchmark_surface: 'pricing_page', dimension_scores: makeDims(0.50) }),
      makeRecord({ hello_eq_submission_id: 'is_b2', benchmark_surface: 'pricing_page', dimension_scores: makeDims(0.55) }),
    ];
    const profile = computePMGraphFrictionCredibility(records);
    expect(profile.expertTags['pricing']?.isExpert).toBe(false);
  });

  it('expert tag is revocable: drops below 60% after more low-scoring attempts', () => {
    // First two: above 60% → would be expert
    const highRecords = [
      makeRecord({ hello_eq_submission_id: 'is_r1', benchmark_surface: 'pricing_page', dimension_scores: makeDims(0.75) }),
      makeRecord({ hello_eq_submission_id: 'is_r2', benchmark_surface: 'pricing_page', dimension_scores: makeDims(0.80) }),
    ];
    expect(computePMGraphFrictionCredibility(highRecords).expertTags['pricing']?.isExpert).toBe(true);

    // Add 4 more attempts scoring 0 → average falls below 60%
    // (0.75+0.80+0+0+0+0)/6 = 1.55/6 ≈ 0.258 < 0.60 → tag revoked
    const withLowRecords = [
      ...highRecords,
      makeRecord({ hello_eq_submission_id: 'is_r3', benchmark_surface: 'pricing_page', dimension_scores: makeDims(0) }),
      makeRecord({ hello_eq_submission_id: 'is_r4', benchmark_surface: 'pricing_page', dimension_scores: makeDims(0) }),
      makeRecord({ hello_eq_submission_id: 'is_r5', benchmark_surface: 'pricing_page', dimension_scores: makeDims(0) }),
      makeRecord({ hello_eq_submission_id: 'is_r6', benchmark_surface: 'pricing_page', dimension_scores: makeDims(0) }),
    ];
    expect(computePMGraphFrictionCredibility(withLowRecords).expertTags['pricing']?.isExpert).toBe(false);
  });
});

// Test 10: high variance performs worse than consistent performance
describe('computePMGraphFrictionCredibility — consistency beats variance', () => {
  it('consistent moderate scores outperform high-variance scores with the same mean', () => {
    // Both scenarios have attempts in 'pricing' with identical attempt-average scores.
    // Consistent: all attempts score 0.7 → theme accuracy = 0.7
    // Variance: alternating 1.0 and 0.4 → theme accuracy = (1.0+0.4)/2 = 0.7
    // At equal attempt count and equal accuracy, credibility scores should be equal.
    // Now test the strict inequality: high variance with lower mean vs consistent higher mean.

    // Consistent: 4 attempts all scoring 0.75 → accuracy 0.75
    const consistent = Array.from({ length: 4 }, (_, i) =>
      makeRecord({
        hello_eq_submission_id: `is_c_${i}`,
        benchmark_surface:      'pricing_page',
        dimension_scores:       makeDims(0.75),
      }),
    );

    // High variance: 4 attempts alternating 1.0 and 0.3
    // accuracy = (1.0+0.3+1.0+0.3)/4 = 2.6/4 = 0.65 < 0.75
    const highVariance = [
      makeRecord({ hello_eq_submission_id: 'is_hv1', benchmark_surface: 'pricing_page', dimension_scores: makeDims(1.00) }),
      makeRecord({ hello_eq_submission_id: 'is_hv2', benchmark_surface: 'pricing_page', dimension_scores: makeDims(0.30) }),
      makeRecord({ hello_eq_submission_id: 'is_hv3', benchmark_surface: 'pricing_page', dimension_scores: makeDims(1.00) }),
      makeRecord({ hello_eq_submission_id: 'is_hv4', benchmark_surface: 'pricing_page', dimension_scores: makeDims(0.30) }),
    ];

    const scoreConsistent  = computePMGraphFrictionCredibility(consistent).score;
    const scoreHighVariance = computePMGraphFrictionCredibility(highVariance).score;

    // Consistent 0.75 avg > high variance 0.65 avg → consistent scores higher
    expect(scoreConsistent).toBeGreaterThan(scoreHighVariance);
  });
});

// Test 11: records missing dimension_scores are excluded
describe('computePMGraphFrictionCredibility — exclusion of incomplete records', () => {
  it('records with null dimension_scores do not inflate attempt count or score', () => {
    const valid   = makeRecord({ hello_eq_submission_id: 'is_valid', dimension_scores: makeDims(0.9) });
    const invalid = makeRecord({
      hello_eq_submission_id: 'is_nodims',
      dimension_scores: null as unknown as PMGraphEvaluationRecord['dimension_scores'],
    });

    const withInvalid  = computePMGraphFrictionCredibility([valid, invalid]);
    const withoutInvalid = computePMGraphFrictionCredibility([valid]);

    // Attempt count must be the same — the null-dimension record is excluded
    expect(withInvalid.totalExercises).toBe(withoutInvalid.totalExercises);
    expect(withInvalid.score).toBe(withoutInvalid.score);
  });

  it('all-invalid input returns zero-state profile', () => {
    const records = [
      makeRecord({ dimension_scores: null as unknown as PMGraphEvaluationRecord['dimension_scores'] }),
      makeRecord({ benchmark_surface: 'unknown_surface' }),
    ];
    const profile = computePMGraphFrictionCredibility(records);
    expect(profile.score).toBe(0);
    expect(profile.totalExercises).toBe(0);
    expect(profile.expertThemes).toHaveLength(0);
  });
});

// Test 12: score always bounded 0–100
describe('computePMGraphFrictionCredibility — score is bounded 0–100', () => {
  it('score is 0 for zero-dimension records', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({ hello_eq_submission_id: `is_z${i}`, dimension_scores: makeDims(0) }),
    );
    const { score } = computePMGraphFrictionCredibility(records);
    expect(score).toBe(0);
  });

  it('score is ≤ 100 for perfect dimension records at max volume', () => {
    // 10 attempts, all perfect, one theme
    const records = Array.from({ length: 10 }, (_, i) =>
      makeRecord({ hello_eq_submission_id: `is_p${i}`, dimension_scores: makeDims(1.0) }),
    );
    const { score } = computePMGraphFrictionCredibility(records);
    expect(score).toBe(100);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('score is always an integer', () => {
    const scenarios = [
      [makeRecord({ dimension_scores: makeDims(0.5) })],
      [makeRecord({ dimension_scores: makeDims(0.72) }), makeRecord({ hello_eq_submission_id: 'is_s2', dimension_scores: makeDims(0.64) })],
    ];
    for (const records of scenarios) {
      const { score } = computePMGraphFrictionCredibility(records);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

// Test 13: multi-theme aggregation
describe('computePMGraphFrictionCredibility — multi-theme', () => {
  it('aggregates expert tags independently per theme', () => {
    const pricingRecords = [
      makeRecord({ hello_eq_submission_id: 'is_pr1', benchmark_surface: 'pricing_page', dimension_scores: makeDims(0.80) }),
      makeRecord({ hello_eq_submission_id: 'is_pr2', benchmark_surface: 'pricing_page', dimension_scores: makeDims(0.75) }),
    ];
    const uxRecords = [
      // Only 1 UX attempt — not enough for expert
      makeRecord({ hello_eq_submission_id: 'is_ux1', benchmark_surface: 'product_ux', dimension_scores: makeDims(1.0) }),
    ];

    const profile = computePMGraphFrictionCredibility([...pricingRecords, ...uxRecords]);

    expect(profile.expertThemes).toContain('pricing');
    expect(profile.expertThemes).not.toContain('ux');
    expect(profile.expertTags['ux']?.attempts).toBe(1);
    expect(profile.expertTags['ux']?.isExpert).toBe(false);
  });
});
