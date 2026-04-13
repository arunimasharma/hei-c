/**
 * evaluationProvenance.test.ts
 *
 * Tests for evaluation provenance stability, immutability guarantees, and
 * the read helpers that expose version context to exercise history, credibility
 * computation, and UI pages.
 *
 * Four suites:
 *
 *   1. Version fields are stored — all provenance fields (including the four
 *      new optional ones) are captured verbatim in the persisted record.
 *
 *   2. Immutability guard — save() must NOT overwrite a record that already
 *      carries a valid overall_score.  A retry for the same submission must
 *      return the original frozen record and must not call dbPutEvaluation.
 *
 *   3. Historical stability — records written under an old rubric/graph version
 *      remain readable alongside records written under a newer version.  The
 *      provenance fields distinguish them without ambiguity.
 *
 *   4. UI selectors — selectProvenance() and groupByVersion() correctly expose
 *      version context so callers can distinguish evaluations scored under
 *      different rubric/graph versions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PMGraphEvaluateResponse } from '../schema';
import type { SaveEvaluationInput, PMGraphEvaluationRecord } from '../EvaluationStore';

// ── Mock db module ────────────────────────────────────────────────────────────

vi.mock('../../../services/db', () => ({
  db: { exercise_evaluations: {} },
  dbPutEvaluation:              vi.fn().mockResolvedValue(undefined),
  dbGet:                        vi.fn(),
  dbGetAll:                     vi.fn(),
  dbGetEvaluationsByExercise:   vi.fn(),
}));

import {
  EvaluationStore,
  buildEvaluationRecord,
  selectProvenance,
  isSuccessfulEvaluation,
  groupByVersion,
} from '../EvaluationStore';
import * as dbModule from '../../../services/db';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const DIMENSION_SCORES = {
  product_judgment:   0.85,
  specificity:        0.78,
  tradeoff_awareness: 0.80,
  segmentation_logic: 0.75,
  strategic_empathy:  0.90,
  market_inference:   0.83,
};

const PROVENANCE_V1 = {
  model:        'pm-graph-v1',
  version:      '1.0.0',
  evaluated_at: '2025-11-01T08:00:00Z',
};

const PROVENANCE_V2 = {
  model:        'pm-graph-v2',
  version:      '2.1.0',
  evaluated_at: '2026-04-07T12:34:56Z',
};

function makeEvaluation(
  overrides: Partial<PMGraphEvaluateResponse> = {},
): PMGraphEvaluateResponse {
  return {
    score:            0.82,
    dimension_scores: DIMENSION_SCORES,
    provenance:       PROVENANCE_V2,
    ...overrides,
  } as PMGraphEvaluateResponse;
}

function makeInput(overrides: Partial<SaveEvaluationInput> = {}): SaveEvaluationInput {
  return {
    evaluation:             makeEvaluation(),
    hello_eq_exercise_id:   'fc_001',
    hello_eq_submission_id: 'is_prov_001',
    benchmark_surface:      'pricing_page',
    member_id:              null,
    ...overrides,
  };
}

/** Builds a fully-populated record fixture (for immutability guard tests). */
function makeStoredRecord(
  overrides: Partial<PMGraphEvaluationRecord> = {},
): PMGraphEvaluationRecord {
  return {
    id:                     'eval_sub_is_prov_001',
    member_id:              null,
    hello_eq_exercise_id:   'fc_001',
    hello_eq_submission_id: 'is_prov_001',
    exercise_type:          'friction_case',
    overall_score:          0.82,
    dimension_scores:       DIMENSION_SCORES,
    feedback:               null,
    top_missed_insights:    null,
    competing_stances:      null,
    contested:              null,
    benchmark_surface:      'pricing_page',
    graph_case_id:          null,
    cluster_ids_used:       ['cluster_a', 'cluster_b'],
    rubric_version:         '2.1.0',
    graph_version:          'pm-graph-v2',
    evaluated_at:           '2026-04-07T12:34:56Z',
    weights_used:           { product_judgment: 0.2, specificity: 0.15, tradeoff_awareness: 0.2, segmentation_logic: 0.15, strategic_empathy: 0.15, market_inference: 0.15 },
    rubric_profile:         { rubric_id: 'rp_friction_v2', thresholds: { expert: 0.75 } },
    curation_version:       'curate-2026-q1',
    scoring_engine_version: 'se-4.2.1',
    expert_tag_signals:     null,
    credibility_event:      null,
    created_at:             '2026-04-07T12:34:56Z',
    sync_status:            'pending',
    ...overrides,
  };
}

const mockDbPutEvaluation = vi.mocked(dbModule.dbPutEvaluation);
const mockDbGet            = vi.mocked(dbModule.dbGet);

beforeEach(() => {
  vi.clearAllMocks();
  mockDbPutEvaluation.mockResolvedValue(undefined);
  // Default: no pre-existing record (immutability guard finds nothing).
  mockDbGet.mockResolvedValue(null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1 — version fields are stored
// ─────────────────────────────────────────────────────────────────────────────

describe('provenance — version fields are stored in the persisted record', () => {
  it('evaluated_at is populated from provenance.evaluated_at', async () => {
    const ts = '2026-03-15T10:30:00Z';
    const record = await EvaluationStore.save(
      makeInput({ evaluation: makeEvaluation({ provenance: { model: 'pm-v1', version: '1.0.0', evaluated_at: ts } }) }),
    );
    expect(record.evaluated_at).toBe(ts);
  });

  it('evaluated_at matches created_at for new records (canonical timestamp)', async () => {
    const record = await EvaluationStore.save(makeInput());
    expect(record.evaluated_at).toBe(record.created_at);
  });

  it('rubric_version is populated from provenance.version', async () => {
    const record = await EvaluationStore.save(
      makeInput({ evaluation: makeEvaluation({ provenance: PROVENANCE_V2 }) }),
    );
    expect(record.rubric_version).toBe('2.1.0');
  });

  it('graph_version is populated from provenance.model', async () => {
    const record = await EvaluationStore.save(
      makeInput({ evaluation: makeEvaluation({ provenance: PROVENANCE_V2 }) }),
    );
    expect(record.graph_version).toBe('pm-graph-v2');
  });

  it('cluster_ids_used is persisted when PM Graph returns it', async () => {
    const record = await EvaluationStore.save(
      makeInput({ evaluation: makeEvaluation({ cluster_ids_used: ['c1', 'c2', 'c3'] }) }),
    );
    expect(record.cluster_ids_used).toEqual(['c1', 'c2', 'c3']);
  });

  it('cluster_ids_used is null when PM Graph omits it', async () => {
    const record = await EvaluationStore.save(makeInput());
    expect(record.cluster_ids_used).toBeNull();
  });

  it('graph_case_id is persisted when PM Graph returns it', async () => {
    const record = await EvaluationStore.save(
      makeInput({ evaluation: makeEvaluation({ graph_case_id: 'gc_friction_099' }) }),
    );
    expect(record.graph_case_id).toBe('gc_friction_099');
  });

  it('weights_used is persisted when PM Graph returns it', async () => {
    const weights = { product_judgment: 0.20, specificity: 0.15, tradeoff_awareness: 0.20, segmentation_logic: 0.15, strategic_empathy: 0.15, market_inference: 0.15 };
    const record = await EvaluationStore.save(
      makeInput({ evaluation: makeEvaluation({ weights_used: weights }) }),
    );
    expect(record.weights_used).toEqual(weights);
  });

  it('weights_used is null when PM Graph omits it', async () => {
    const record = await EvaluationStore.save(makeInput());
    expect(record.weights_used).toBeNull();
  });

  it('rubric_profile is persisted when PM Graph returns it', async () => {
    const profile = { rubric_id: 'rp_friction_v2', thresholds: { expert: 0.75 } };
    const record = await EvaluationStore.save(
      makeInput({ evaluation: makeEvaluation({ rubric_profile: profile }) }),
    );
    expect(record.rubric_profile).toEqual(profile);
  });

  it('rubric_profile is null when PM Graph omits it', async () => {
    const record = await EvaluationStore.save(makeInput());
    expect(record.rubric_profile).toBeNull();
  });

  it('curation_version is persisted when PM Graph returns it', async () => {
    const record = await EvaluationStore.save(
      makeInput({ evaluation: makeEvaluation({ curation_version: 'curate-2026-q1' }) }),
    );
    expect(record.curation_version).toBe('curate-2026-q1');
  });

  it('curation_version is null when PM Graph omits it', async () => {
    const record = await EvaluationStore.save(makeInput());
    expect(record.curation_version).toBeNull();
  });

  it('scoring_engine_version is persisted when PM Graph returns it', async () => {
    const record = await EvaluationStore.save(
      makeInput({ evaluation: makeEvaluation({ scoring_engine_version: 'se-4.2.1' }) }),
    );
    expect(record.scoring_engine_version).toBe('se-4.2.1');
  });

  it('scoring_engine_version is null when PM Graph omits it', async () => {
    const record = await EvaluationStore.save(makeInput());
    expect(record.scoring_engine_version).toBeNull();
  });

  it('all provenance fields survive in the record passed to dbPutEvaluation', async () => {
    const input = makeInput({
      evaluation: makeEvaluation({
        provenance:             PROVENANCE_V2,
        cluster_ids_used:       ['c_x'],
        graph_case_id:          'gc_042',
        weights_used:           { product_judgment: 0.2 },
        rubric_profile:         { rubric_id: 'rp_v2' },
        curation_version:       'curate-2026-q1',
        scoring_engine_version: 'se-4.2.1',
      }),
    });
    await EvaluationStore.save(input);
    const [, , , persisted] = mockDbPutEvaluation.mock.calls[0];
    const rec = persisted as PMGraphEvaluationRecord;
    expect(rec.rubric_version).toBe('2.1.0');
    expect(rec.graph_version).toBe('pm-graph-v2');
    expect(rec.evaluated_at).toBe('2026-04-07T12:34:56Z');
    expect(rec.cluster_ids_used).toEqual(['c_x']);
    expect(rec.graph_case_id).toBe('gc_042');
    expect(rec.weights_used).toEqual({ product_judgment: 0.2 });
    expect(rec.rubric_profile).toEqual({ rubric_id: 'rp_v2' });
    expect(rec.curation_version).toBe('curate-2026-q1');
    expect(rec.scoring_engine_version).toBe('se-4.2.1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 — immutability guard
// ─────────────────────────────────────────────────────────────────────────────

describe('provenance — immutability guard prevents overwriting a successful evaluation', () => {
  it('returns the existing record unchanged when a successful evaluation already exists', async () => {
    const existing = makeStoredRecord();
    mockDbGet.mockResolvedValueOnce(existing);

    const result = await EvaluationStore.save(makeInput());

    // Must return the original frozen record, not a freshly-built one.
    expect(result).toStrictEqual(existing);
  });

  it('does NOT call dbPutEvaluation when an existing successful record is found', async () => {
    mockDbGet.mockResolvedValueOnce(makeStoredRecord());

    await EvaluationStore.save(makeInput());

    expect(mockDbPutEvaluation).not.toHaveBeenCalled();
  });

  it('the returned frozen record preserves the original rubric_version even when the retry input uses a different version', async () => {
    // Original record was scored under version 1.0.0.
    const original = makeStoredRecord({
      rubric_version: '1.0.0',
      graph_version:  'pm-graph-v1',
      evaluated_at:   '2025-11-01T08:00:00Z',
      created_at:     '2025-11-01T08:00:00Z',
    });
    mockDbGet.mockResolvedValueOnce(original);

    // Retry comes in with v2 provenance — must be blocked.
    const result = await EvaluationStore.save(
      makeInput({ evaluation: makeEvaluation({ provenance: PROVENANCE_V2 }) }),
    );

    expect(result.rubric_version).toBe('1.0.0');
    expect(result.graph_version).toBe('pm-graph-v1');
    expect(result.evaluated_at).toBe('2025-11-01T08:00:00Z');
  });

  it('allows writing when no prior record exists (first-time save)', async () => {
    // mockDbGet already returns null by default (set in beforeEach).
    await EvaluationStore.save(makeInput());
    expect(mockDbPutEvaluation).toHaveBeenCalledOnce();
  });

  it('allows overwriting when the prior record has an invalid score (edge case)', async () => {
    // A record with NaN overall_score is not a successful evaluation.
    const broken = makeStoredRecord({ overall_score: NaN });
    mockDbGet.mockResolvedValueOnce(broken);

    await EvaluationStore.save(makeInput());

    expect(mockDbPutEvaluation).toHaveBeenCalledOnce();
  });

  it('isSuccessfulEvaluation returns true for a record with a valid score', () => {
    expect(isSuccessfulEvaluation(makeStoredRecord({ overall_score: 0.82 }))).toBe(true);
    expect(isSuccessfulEvaluation(makeStoredRecord({ overall_score: 0 }))).toBe(true);
    expect(isSuccessfulEvaluation(makeStoredRecord({ overall_score: 1 }))).toBe(true);
  });

  it('isSuccessfulEvaluation returns false for NaN, null-coerced, and out-of-range scores', () => {
    expect(isSuccessfulEvaluation(makeStoredRecord({ overall_score: NaN }))).toBe(false);
    // @ts-expect-error — intentionally testing runtime guard with invalid value
    expect(isSuccessfulEvaluation(makeStoredRecord({ overall_score: null }))).toBe(false);
    expect(isSuccessfulEvaluation(makeStoredRecord({ overall_score: -0.1 }))).toBe(false);
    expect(isSuccessfulEvaluation(makeStoredRecord({ overall_score: 1.1 }))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 — historical records remain readable after new versioned evaluations
// ─────────────────────────────────────────────────────────────────────────────

describe('provenance — historical records remain readable after newer evaluations', () => {
  it('a v1 record built with buildEvaluationRecord carries v1 provenance fields', () => {
    const v1Input = makeInput({
      hello_eq_submission_id: 'is_hist_v1',
      evaluation: makeEvaluation({
        provenance:       PROVENANCE_V1,
        cluster_ids_used: ['old_cluster'],
        curation_version: 'curate-2025-q4',
      }),
    });
    const v1Record = buildEvaluationRecord(v1Input);

    expect(v1Record.rubric_version).toBe('1.0.0');
    expect(v1Record.graph_version).toBe('pm-graph-v1');
    expect(v1Record.evaluated_at).toBe('2025-11-01T08:00:00Z');
    expect(v1Record.cluster_ids_used).toEqual(['old_cluster']);
    expect(v1Record.curation_version).toBe('curate-2025-q4');
  });

  it('a v2 record built with buildEvaluationRecord carries v2 provenance fields', () => {
    const v2Input = makeInput({
      hello_eq_submission_id: 'is_hist_v2',
      evaluation: makeEvaluation({
        provenance:             PROVENANCE_V2,
        cluster_ids_used:       ['new_cluster_a', 'new_cluster_b'],
        curation_version:       'curate-2026-q1',
        scoring_engine_version: 'se-4.2.1',
      }),
    });
    const v2Record = buildEvaluationRecord(v2Input);

    expect(v2Record.rubric_version).toBe('2.1.0');
    expect(v2Record.graph_version).toBe('pm-graph-v2');
    expect(v2Record.evaluated_at).toBe('2026-04-07T12:34:56Z');
    expect(v2Record.cluster_ids_used).toEqual(['new_cluster_a', 'new_cluster_b']);
    expect(v2Record.curation_version).toBe('curate-2026-q1');
    expect(v2Record.scoring_engine_version).toBe('se-4.2.1');
  });

  it('v1 and v2 records for the same exercise have distinct provenance fields', () => {
    const v1 = buildEvaluationRecord(makeInput({
      hello_eq_submission_id: 'is_hist_v1',
      evaluation: makeEvaluation({ provenance: PROVENANCE_V1 }),
    }));
    const v2 = buildEvaluationRecord(makeInput({
      hello_eq_submission_id: 'is_hist_v2',
      evaluation: makeEvaluation({ provenance: PROVENANCE_V2 }),
    }));

    expect(v1.rubric_version).not.toBe(v2.rubric_version);
    expect(v1.graph_version).not.toBe(v2.graph_version);
    expect(v1.evaluated_at).not.toBe(v2.evaluated_at);
  });

  it('selectProvenance on a v1 record returns the v1 snapshot', () => {
    const v1 = buildEvaluationRecord(makeInput({
      hello_eq_submission_id: 'is_hist_v1',
      evaluation: makeEvaluation({
        provenance:       PROVENANCE_V1,
        cluster_ids_used: ['old_cluster'],
        curation_version: 'curate-2025-q4',
      }),
    }));
    const prov = selectProvenance(v1);

    expect(prov.rubric_version).toBe('1.0.0');
    expect(prov.graph_version).toBe('pm-graph-v1');
    expect(prov.evaluated_at).toBe('2025-11-01T08:00:00Z');
    expect(prov.cluster_ids_used).toEqual(['old_cluster']);
    expect(prov.curation_version).toBe('curate-2025-q4');
    // Fields absent in v1 evaluation are null.
    expect(prov.weights_used).toBeNull();
    expect(prov.rubric_profile).toBeNull();
    expect(prov.scoring_engine_version).toBeNull();
  });

  it('selectProvenance on a v2 record returns the full v2 snapshot', () => {
    const weights = { product_judgment: 0.20, specificity: 0.15, tradeoff_awareness: 0.20, segmentation_logic: 0.15, strategic_empathy: 0.15, market_inference: 0.15 };
    const v2 = buildEvaluationRecord(makeInput({
      hello_eq_submission_id: 'is_hist_v2',
      evaluation: makeEvaluation({
        provenance:             PROVENANCE_V2,
        cluster_ids_used:       ['c_a', 'c_b'],
        weights_used:           weights,
        rubric_profile:         { rubric_id: 'rp_v2' },
        curation_version:       'curate-2026-q1',
        scoring_engine_version: 'se-4.2.1',
      }),
    }));
    const prov = selectProvenance(v2);

    expect(prov.rubric_version).toBe('2.1.0');
    expect(prov.graph_version).toBe('pm-graph-v2');
    expect(prov.evaluated_at).toBe('2026-04-07T12:34:56Z');
    expect(prov.cluster_ids_used).toEqual(['c_a', 'c_b']);
    expect(prov.weights_used).toEqual(weights);
    expect(prov.rubric_profile).toEqual({ rubric_id: 'rp_v2' });
    expect(prov.curation_version).toBe('curate-2026-q1');
    expect(prov.scoring_engine_version).toBe('se-4.2.1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4 — UI selectors distinguish records from different rubric/graph versions
// ─────────────────────────────────────────────────────────────────────────────

describe('provenance — UI selectors distinguish records by rubric/graph version', () => {
  const recordV1a = buildEvaluationRecord(makeInput({
    hello_eq_submission_id: 'is_ui_v1a',
    evaluation: makeEvaluation({ provenance: PROVENANCE_V1 }),
  }));
  const recordV1b = buildEvaluationRecord(makeInput({
    hello_eq_submission_id: 'is_ui_v1b',
    hello_eq_exercise_id:   'fc_002',
    evaluation: makeEvaluation({ provenance: PROVENANCE_V1 }),
  }));
  const recordV2a = buildEvaluationRecord(makeInput({
    hello_eq_submission_id: 'is_ui_v2a',
    evaluation: makeEvaluation({ provenance: PROVENANCE_V2 }),
  }));
  const recordV2b = buildEvaluationRecord(makeInput({
    hello_eq_submission_id: 'is_ui_v2b',
    hello_eq_exercise_id:   'fc_003',
    evaluation: makeEvaluation({ provenance: PROVENANCE_V2 }),
  }));

  const allRecords = [recordV1a, recordV1b, recordV2a, recordV2b];

  it('groupByVersion produces exactly two buckets for v1 and v2 records', () => {
    const groups = groupByVersion(allRecords);
    expect(groups.size).toBe(2);
  });

  it('groups records under the correct version key (rubric::graph)', () => {
    const groups = groupByVersion(allRecords);
    expect(groups.has('1.0.0::pm-graph-v1')).toBe(true);
    expect(groups.has('2.1.0::pm-graph-v2')).toBe(true);
  });

  it('v1 bucket contains exactly the two v1 records', () => {
    const groups = groupByVersion(allRecords);
    const v1Bucket = groups.get('1.0.0::pm-graph-v1')!;
    expect(v1Bucket).toHaveLength(2);
    expect(v1Bucket.map(r => r.hello_eq_submission_id).sort()).toEqual(['is_ui_v1a', 'is_ui_v1b'].sort());
  });

  it('v2 bucket contains exactly the two v2 records', () => {
    const groups = groupByVersion(allRecords);
    const v2Bucket = groups.get('2.1.0::pm-graph-v2')!;
    expect(v2Bucket).toHaveLength(2);
    expect(v2Bucket.map(r => r.hello_eq_submission_id).sort()).toEqual(['is_ui_v2a', 'is_ui_v2b'].sort());
  });

  it('groupByVersion returns an empty map for an empty input', () => {
    expect(groupByVersion([])).toEqual(new Map());
  });

  it('groupByVersion handles a single record correctly', () => {
    const groups = groupByVersion([recordV1a]);
    expect(groups.size).toBe(1);
    expect(groups.get('1.0.0::pm-graph-v1')).toHaveLength(1);
  });

  it('selectProvenance returns only provenance fields (no score or feedback fields)', () => {
    const prov = selectProvenance(recordV2a);
    // These provenance fields must be present.
    expect(prov).toHaveProperty('rubric_version');
    expect(prov).toHaveProperty('graph_version');
    expect(prov).toHaveProperty('evaluated_at');
    expect(prov).toHaveProperty('cluster_ids_used');
    expect(prov).toHaveProperty('graph_case_id');
    expect(prov).toHaveProperty('weights_used');
    expect(prov).toHaveProperty('rubric_profile');
    expect(prov).toHaveProperty('curation_version');
    expect(prov).toHaveProperty('scoring_engine_version');
    // Score and feedback must NOT leak into the provenance object.
    expect(prov).not.toHaveProperty('overall_score');
    expect(prov).not.toHaveProperty('dimension_scores');
    expect(prov).not.toHaveProperty('feedback');
  });

  it('two records with the same rubric+graph version land in the same bucket even across different exercises', () => {
    // recordV1a is fc_001, recordV1b is fc_002 — different exercises, same version.
    const groups = groupByVersion([recordV1a, recordV1b]);
    expect(groups.size).toBe(1);
    expect(groups.get('1.0.0::pm-graph-v1')).toHaveLength(2);
  });
});
