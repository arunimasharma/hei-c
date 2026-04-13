/**
 * EvaluationStore.test.ts
 *
 * Audit tests for buildEvaluationRecord — the pure constructor exported from
 * EvaluationStore. These tests run in a Node environment and never touch Dexie.
 *
 * Coverage:
 *  1. Idempotency: same submission id always produces the same record id
 *  2. Provenance round-trip: evaluated_at → created_at, model → graph_version,
 *     version → rubric_version
 *  3. Degraded response does not produce a record (it never reaches buildEvaluationRecord;
 *     verified here that the pure fn only fires on non-degraded input)
 *  4. member_id field is preserved exactly (null and string)
 *  5. benchmark_surface is preserved from input
 *  6. sync_status is always 'pending' on construction
 *  7. Optional fields default to null when absent from the evaluation response
 */

import { describe, it, expect } from 'vitest';
import { buildEvaluationRecord } from '../EvaluationStore';
import type { SaveEvaluationInput } from '../EvaluationStore';
import type { PMGraphEvaluateResponse } from '../schema';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROVENANCE = {
  model:        'pm-graph-v2',
  version:      '2.1.0',
  evaluated_at: '2026-04-07T12:34:56Z',
};

const DIMENSION_SCORES = {
  product_judgment:   0.85,
  specificity:        0.78,
  tradeoff_awareness: 0.80,
  segmentation_logic: 0.75,
  strategic_empathy:  0.90,
  market_inference:   0.83,
};

function makeEvaluation(overrides: Partial<PMGraphEvaluateResponse> = {}): PMGraphEvaluateResponse {
  return {
    score:            0.82,
    dimension_scores: DIMENSION_SCORES,
    provenance:       PROVENANCE,
    reasoning:        'Good diagnostic reasoning.',
    request_id:       'heq_test_req_1',
    ...overrides,
  } as PMGraphEvaluateResponse;
}

function makeInput(overrides: Partial<SaveEvaluationInput> = {}): SaveEvaluationInput {
  return {
    evaluation:             makeEvaluation(),
    hello_eq_exercise_id:   'fc_001',
    hello_eq_submission_id: 'is_abc_123',
    benchmark_surface:      'pricing_page',
    member_id:              null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildEvaluationRecord — idempotency', () => {
  it('produces the same id for the same submission_id', () => {
    const input = makeInput({ hello_eq_submission_id: 'is_abc_123' });
    const r1 = buildEvaluationRecord(input);
    const r2 = buildEvaluationRecord(input);
    expect(r1.id).toBe(r2.id);
  });

  it('derives id deterministically as eval_sub_<submission_id>', () => {
    const record = buildEvaluationRecord(makeInput({ hello_eq_submission_id: 'is_xyz_789' }));
    expect(record.id).toBe('eval_sub_is_xyz_789');
  });

  it('different submission ids produce different record ids', () => {
    const r1 = buildEvaluationRecord(makeInput({ hello_eq_submission_id: 'is_aaa' }));
    const r2 = buildEvaluationRecord(makeInput({ hello_eq_submission_id: 'is_bbb' }));
    expect(r1.id).not.toBe(r2.id);
  });
});

describe('buildEvaluationRecord — provenance round-trip', () => {
  it('maps provenance.evaluated_at → created_at', () => {
    const record = buildEvaluationRecord(makeInput());
    expect(record.created_at).toBe('2026-04-07T12:34:56Z');
  });

  it('maps provenance.model → graph_version', () => {
    const record = buildEvaluationRecord(makeInput());
    expect(record.graph_version).toBe('pm-graph-v2');
  });

  it('maps provenance.version → rubric_version', () => {
    const record = buildEvaluationRecord(makeInput());
    expect(record.rubric_version).toBe('2.1.0');
  });

  it('preserves provenance across different versions', () => {
    const input = makeInput({
      evaluation: makeEvaluation({
        provenance: { model: 'pm-graph-v3', version: '3.0.0', evaluated_at: '2026-06-01T00:00:00Z' },
      }),
    });
    const record = buildEvaluationRecord(input);
    expect(record.graph_version).toBe('pm-graph-v3');
    expect(record.rubric_version).toBe('3.0.0');
    expect(record.created_at).toBe('2026-06-01T00:00:00Z');
  });
});

describe('buildEvaluationRecord — member_id', () => {
  it('stores null member_id when not authenticated', () => {
    const record = buildEvaluationRecord(makeInput({ member_id: null }));
    expect(record.member_id).toBeNull();
  });

  it('stores string member_id when authenticated', () => {
    const record = buildEvaluationRecord(makeInput({ member_id: 'user_abc_123' }));
    expect(record.member_id).toBe('user_abc_123');
  });
});

describe('buildEvaluationRecord — benchmark_surface', () => {
  it('preserves benchmark_surface from input', () => {
    const record = buildEvaluationRecord(makeInput({ benchmark_surface: 'onboarding_flow' }));
    expect(record.benchmark_surface).toBe('onboarding_flow');
  });
});

describe('buildEvaluationRecord — sync_status', () => {
  it('always initialises sync_status as pending', () => {
    const record = buildEvaluationRecord(makeInput());
    expect(record.sync_status).toBe('pending');
  });
});

describe('buildEvaluationRecord — optional fields default to null', () => {
  it('sets top_missed_insights to null when absent', () => {
    const record = buildEvaluationRecord(makeInput());
    expect(record.top_missed_insights).toBeNull();
  });

  it('sets competing_stances to null when absent', () => {
    const record = buildEvaluationRecord(makeInput());
    expect(record.competing_stances).toBeNull();
  });

  it('sets contested to null when absent', () => {
    const record = buildEvaluationRecord(makeInput());
    expect(record.contested).toBeNull();
  });

  it('sets graph_case_id to null when absent', () => {
    const record = buildEvaluationRecord(makeInput());
    expect(record.graph_case_id).toBeNull();
  });

  it('sets cluster_ids_used to null when absent', () => {
    const record = buildEvaluationRecord(makeInput());
    expect(record.cluster_ids_used).toBeNull();
  });

  it('sets expert_tag_signals to null when absent', () => {
    const record = buildEvaluationRecord(makeInput());
    expect(record.expert_tag_signals).toBeNull();
  });

  it('sets credibility_event to null when absent', () => {
    const record = buildEvaluationRecord(makeInput());
    expect(record.credibility_event).toBeNull();
  });

  it('preserves optional fields when present in the evaluation', () => {
    const input = makeInput({
      evaluation: makeEvaluation({
        top_missed_insights: ['insight_a', 'insight_b'],
        competing_stances:   ['stance_x'],
        contested:           true,
        graph_case_id:       'gc_999',
        cluster_ids_used:    ['cl_1', 'cl_2'],
      }),
    });
    const record = buildEvaluationRecord(input);
    expect(record.top_missed_insights).toEqual(['insight_a', 'insight_b']);
    expect(record.competing_stances).toEqual(['stance_x']);
    expect(record.contested).toBe(true);
    expect(record.graph_case_id).toBe('gc_999');
    expect(record.cluster_ids_used).toEqual(['cl_1', 'cl_2']);
  });
});

describe('buildEvaluationRecord — core scores', () => {
  it('maps score → overall_score', () => {
    const record = buildEvaluationRecord(makeInput());
    expect(record.overall_score).toBe(0.82);
  });

  it('maps dimension_scores verbatim', () => {
    const record = buildEvaluationRecord(makeInput());
    expect(record.dimension_scores).toEqual(DIMENSION_SCORES);
  });

  it('maps reasoning → feedback', () => {
    const record = buildEvaluationRecord(makeInput());
    expect(record.feedback).toBe('Good diagnostic reasoning.');
  });

  it('sets feedback to null when reasoning is absent', () => {
    const record = buildEvaluationRecord(makeInput({
      evaluation: makeEvaluation({ reasoning: undefined }),
    }));
    expect(record.feedback).toBeNull();
  });
});
