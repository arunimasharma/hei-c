/**
 * pmGraphAggregates.test.ts
 *
 * Unit tests for the pure aggregation functions in pmGraphAggregates.ts.
 *
 * All functions are side-effect free and run in the Node vitest environment
 * without any browser APIs, Dexie, or React.
 *
 * Coverage:
 *
 *  computeDimensionAverages
 *   1. Returns null on empty input (safe empty-state sentinel)
 *   2. Excludes records with null dimension_scores — they do not contribute
 *   3. Correct arithmetic mean across multiple records
 *   4. Returns null when all records have null dimension_scores
 *   5. Single record with all-zero scores → averages all 0.0
 *   6. Result is always in [0, 1] per dimension
 *
 *  rankDimensions
 *   7. Returns empty array for null averages input
 *   8. Sorted highest → lowest average
 *   9. All 6 dimensions are present in output
 *
 *  aggregateMissedInsights
 *  10. Returns empty array when no records have top_missed_insights
 *  11. Deduplicates case-insensitively, most frequent first
 *  12. Respects limit parameter (default 5)
 *  13. Records with null top_missed_insights are skipped safely
 *
 *  computeContestedRatio
 *  14. Returns null when no records have a boolean contested value
 *  15. Correct ratio when all contested=true
 *  16. Correct ratio when all contested=false
 *  17. Excludes null contested values from denominator
 *
 *  computeSurfaceStats
 *  18. Returns empty array for empty input
 *  19. Groups by surface correctly, sorted by avgScore desc
 *  20. Excludes records with unknown surfaces
 *  21. Records with null dimension_scores do not contribute to avgScore
 *
 *  Combined: optional fields absent → no crash
 *  22. Record with all optional fields null → handled safely by all functions
 */

import { describe, it, expect } from 'vitest';
import {
  computeDimensionAverages,
  rankDimensions,
  aggregateMissedInsights,
  computeContestedRatio,
  computeSurfaceStats,
  DIMENSION_ORDER,
} from '../pmGraphAggregates';
import type { PMGraphEvaluationRecord } from '../EvaluationStore';

// ── Fixtures ──────────────────────────────────────────────────────────────────

let _seq = 0;

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

function makeRecord(overrides: Partial<PMGraphEvaluationRecord> = {}): PMGraphEvaluationRecord {
  _seq++;
  return {
    id:                     `eval_sub_is_${_seq}`,
    member_id:              null,
    hello_eq_exercise_id:   'fc_001',
    hello_eq_submission_id: `is_${_seq}`,
    exercise_type:          'friction_case',
    overall_score:          0.80,
    dimension_scores:       makeDims(0.80),
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
    created_at:             new Date(_seq * 120_000).toISOString(),
    sync_status:            'pending',
    ...overrides,
  };
}

// ── computeDimensionAverages ──────────────────────────────────────────────────

describe('computeDimensionAverages', () => {
  it('1. returns null on empty input', () => {
    expect(computeDimensionAverages([])).toBeNull();
  });

  it('2. excludes records with null dimension_scores — they do not contribute', () => {
    const valid   = makeRecord({ dimension_scores: makeDims(0.9) });
    const invalid = makeRecord({ dimension_scores: null as unknown as PMGraphEvaluationRecord['dimension_scores'] });
    const avgs    = computeDimensionAverages([valid, invalid]);
    // Should be 0.9 — invalid record doesn't drag it down toward 0
    expect(avgs).not.toBeNull();
    expect(avgs!.product_judgment).toBeCloseTo(0.9);
  });

  it('3. returns correct arithmetic mean across multiple records', () => {
    const r1 = makeRecord({ dimension_scores: makeDims(0.6) });
    const r2 = makeRecord({ dimension_scores: makeDims(1.0) });
    // avg = (0.6 + 1.0) / 2 = 0.8
    const avgs = computeDimensionAverages([r1, r2]);
    expect(avgs!.product_judgment).toBeCloseTo(0.8);
    expect(avgs!.market_inference).toBeCloseTo(0.8);
  });

  it('4. returns null when all records have null dimension_scores', () => {
    const r1 = makeRecord({ dimension_scores: null as unknown as PMGraphEvaluationRecord['dimension_scores'] });
    const r2 = makeRecord({ dimension_scores: null as unknown as PMGraphEvaluationRecord['dimension_scores'] });
    expect(computeDimensionAverages([r1, r2])).toBeNull();
  });

  it('5. single record with all-zero scores → all averages 0.0', () => {
    const avgs = computeDimensionAverages([makeRecord({ dimension_scores: makeDims(0) })]);
    expect(avgs!.product_judgment).toBe(0);
    expect(avgs!.strategic_empathy).toBe(0);
  });

  it('6. result is in [0,1] for all dimensions', () => {
    const records = [
      makeRecord({ dimension_scores: { product_judgment: 0.2, specificity: 0.9, tradeoff_awareness: 0.4, segmentation_logic: 0.7, strategic_empathy: 0.1, market_inference: 0.6 } }),
      makeRecord({ dimension_scores: makeDims(0.5) }),
    ];
    const avgs = computeDimensionAverages(records)!;
    for (const key of DIMENSION_ORDER) {
      expect(avgs[key]).toBeGreaterThanOrEqual(0);
      expect(avgs[key]).toBeLessThanOrEqual(1);
    }
  });
});

// ── rankDimensions ────────────────────────────────────────────────────────────

describe('rankDimensions', () => {
  it('7. returns empty array for null averages', () => {
    expect(rankDimensions(null)).toEqual([]);
  });

  it('8. sorted highest → lowest average', () => {
    const avgs = {
      product_judgment:   0.5,
      specificity:        0.9,
      tradeoff_awareness: 0.3,
      segmentation_logic: 0.7,
      strategic_empathy:  0.8,
      market_inference:   0.6,
    };
    const ranked = rankDimensions(avgs);
    for (let i = 0; i < ranked.length - 1; i++) {
      expect(ranked[i].avg).toBeGreaterThanOrEqual(ranked[i + 1].avg);
    }
  });

  it('9. all 6 dimensions are present in output', () => {
    const avgs = computeDimensionAverages([makeRecord({ dimension_scores: makeDims(0.5) })])!;
    const ranked = rankDimensions(avgs);
    expect(ranked).toHaveLength(6);
    const keys = ranked.map(r => r.key);
    for (const dim of DIMENSION_ORDER) {
      expect(keys).toContain(dim);
    }
  });
});

// ── aggregateMissedInsights ───────────────────────────────────────────────────

describe('aggregateMissedInsights', () => {
  it('10. returns empty array when no records have top_missed_insights', () => {
    expect(aggregateMissedInsights([makeRecord()])).toEqual([]);
  });

  it('11. deduplicates case-insensitively, most frequent first', () => {
    const r1 = makeRecord({ top_missed_insights: ['User trust signals', 'Pricing anchoring'] });
    const r2 = makeRecord({ top_missed_insights: ['user trust signals', 'Onboarding flow'] }); // duplicate (different case)
    const r3 = makeRecord({ top_missed_insights: ['Pricing anchoring'] }); // duplicate

    const result = aggregateMissedInsights([r1, r2, r3]);
    // 'user trust signals' appears 2x, 'pricing anchoring' appears 2x, 'onboarding flow' 1x
    expect(result.length).toBeGreaterThanOrEqual(1);
    // The first two should be the most frequent (both at 2)
    const lowers = result.map(s => s.toLowerCase());
    expect(lowers.slice(0, 2)).toEqual(expect.arrayContaining(['user trust signals', 'pricing anchoring']));
    // 'onboarding flow' (1x) should be last
    expect(lowers).toContain('onboarding flow');
    expect(lowers.indexOf('onboarding flow')).toBeGreaterThan(lowers.indexOf('user trust signals'));
  });

  it('12. respects limit parameter', () => {
    const r = makeRecord({ top_missed_insights: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] });
    const result = aggregateMissedInsights([r], 3);
    expect(result).toHaveLength(3);
  });

  it('13. records with null top_missed_insights are skipped safely', () => {
    const r1 = makeRecord({ top_missed_insights: null });
    const r2 = makeRecord({ top_missed_insights: ['Real insight'] });
    const result = aggregateMissedInsights([r1, r2]);
    expect(result).toEqual(['Real insight']);
  });
});

// ── computeContestedRatio ─────────────────────────────────────────────────────

describe('computeContestedRatio', () => {
  it('14. returns null when no records have a boolean contested value', () => {
    expect(computeContestedRatio([makeRecord({ contested: null })])).toBeNull();
    expect(computeContestedRatio([])).toBeNull();
  });

  it('15. returns 1.0 when all contested=true', () => {
    const records = [
      makeRecord({ contested: true }),
      makeRecord({ contested: true }),
    ];
    expect(computeContestedRatio(records)).toBeCloseTo(1.0);
  });

  it('16. returns 0.0 when all contested=false', () => {
    const records = [
      makeRecord({ contested: false }),
      makeRecord({ contested: false }),
    ];
    expect(computeContestedRatio(records)).toBeCloseTo(0.0);
  });

  it('17. excludes null contested values from denominator', () => {
    // 2 true + 2 false + 2 null → eligible = 4, contested = 2 → ratio = 0.5
    const records = [
      makeRecord({ contested: true  }),
      makeRecord({ contested: true  }),
      makeRecord({ contested: false }),
      makeRecord({ contested: false }),
      makeRecord({ contested: null  }),
      makeRecord({ contested: null  }),
    ];
    expect(computeContestedRatio(records)).toBeCloseTo(0.5);
  });
});

// ── computeSurfaceStats ───────────────────────────────────────────────────────

describe('computeSurfaceStats', () => {
  it('18. returns empty array for empty input', () => {
    expect(computeSurfaceStats([])).toEqual([]);
  });

  it('19. groups by surface, sorted by avgScore desc', () => {
    const records = [
      makeRecord({ benchmark_surface: 'pricing_page',   dimension_scores: makeDims(0.9) }),
      makeRecord({ benchmark_surface: 'product_ux',     dimension_scores: makeDims(0.4) }),
      makeRecord({ benchmark_surface: 'pricing_page',   dimension_scores: makeDims(0.7) }),
    ];
    const stats = computeSurfaceStats(records);
    expect(stats).toHaveLength(2);
    expect(stats[0].surface).toBe('pricing_page'); // avg = (0.9+0.7)/2 = 0.8 > 0.4
    expect(stats[0].avgScore).toBeCloseTo(0.8);
    expect(stats[0].count).toBe(2);
    expect(stats[1].surface).toBe('product_ux');
    expect(stats[1].avgScore).toBeCloseTo(0.4);
  });

  it('20. excludes records with unknown benchmark_surface', () => {
    const records = [
      makeRecord({ benchmark_surface: 'pricing_page', dimension_scores: makeDims(0.8) }),
      makeRecord({ benchmark_surface: 'future_surface_unknown', dimension_scores: makeDims(0.9) }),
    ];
    const stats = computeSurfaceStats(records);
    expect(stats).toHaveLength(1);
    expect(stats[0].surface).toBe('pricing_page');
  });

  it('21. records with null dimension_scores do not contribute to avgScore but are counted', () => {
    const records = [
      makeRecord({ benchmark_surface: 'pricing_page', dimension_scores: makeDims(0.8) }),
      makeRecord({ benchmark_surface: 'pricing_page', dimension_scores: null as unknown as PMGraphEvaluationRecord['dimension_scores'] }),
    ];
    const stats = computeSurfaceStats(records);
    expect(stats[0].count).toBe(2);       // both records counted for the surface
    expect(stats[0].avgScore).toBeCloseTo(0.8); // only the scored record contributes
  });
});

// ── Combined: all optional fields absent → no crash ──────────────────────────

describe('optional fields absent — no crash', () => {
  it('22. record with all optional fields null is handled safely by all aggregate functions', () => {
    const bare = makeRecord({
      dimension_scores:    null as unknown as PMGraphEvaluationRecord['dimension_scores'],
      top_missed_insights: null,
      competing_stances:   null,
      contested:           null,
      expert_tag_signals:  null,
      credibility_event:   null,
    });

    expect(() => computeDimensionAverages([bare])).not.toThrow();
    expect(() => rankDimensions(null)).not.toThrow();
    expect(() => aggregateMissedInsights([bare])).not.toThrow();
    expect(() => computeContestedRatio([bare])).not.toThrow();
    expect(() => computeSurfaceStats([bare])).not.toThrow();

    expect(computeDimensionAverages([bare])).toBeNull();
    expect(aggregateMissedInsights([bare])).toEqual([]);
    expect(computeContestedRatio([bare])).toBeNull();
  });
});
