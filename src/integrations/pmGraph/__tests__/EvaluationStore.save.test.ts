/**
 * EvaluationStore.save.test.ts
 *
 * Persistence-layer tests for EvaluationStore.save(), .getById(),
 * .markSynced(), and .markSyncError().
 *
 * The Dexie helpers (dbPutEvaluation, dbGet) are mocked so these tests run in
 * the Node vitest environment without IndexedDB.  The goal is to verify that
 * EvaluationStore correctly:
 *
 *   1. Calls dbPutEvaluation with a fully populated record on a successful save.
 *   2. Derives a deterministic record id (eval_sub_<submissionId>) so that
 *      retrying the same submission always upserts the same Dexie row.
 *   3. Never creates two different ids for the same submission — no duplicates
 *      can accumulate in the table.
 *   4. Preserves all provenance fields (graph_version, rubric_version,
 *      created_at) verbatim in the persisted record.
 *   5. Returns the built record directly from save() so callers get all
 *      provenance fields without a separate read.
 *   6. markSynced / markSyncError read the existing record and re-put it with
 *      the updated sync_status.
 *
 * What is NOT tested here (covered in separate test files):
 *   - buildEvaluationRecord field mapping (EvaluationStore.test.ts)
 *   - Full pipeline degraded-response guard (runFrictionCaseEvaluation.test.ts)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PMGraphEvaluateResponse } from '../schema';
import type { SaveEvaluationInput, PMGraphEvaluationRecord } from '../EvaluationStore';

// ── Mock db module ────────────────────────────────────────────────────────────
//
// vi.mock is hoisted before imports, so when EvaluationStore.ts is first
// loaded its `import { db, dbPutEvaluation, ... }` resolves to these stubs.
// The real Dexie / encryptionService code is never executed.

vi.mock('../../../services/db', () => ({
  db: { exercise_evaluations: {} },
  dbPutEvaluation:              vi.fn().mockResolvedValue(undefined),
  dbGet:                        vi.fn(),
  dbGetAll:                     vi.fn(),
  dbGetEvaluationsByExercise:   vi.fn(),
}));

// Import AFTER mock registration so the module sees the stubs.
import { EvaluationStore } from '../EvaluationStore';
import * as dbModule from '../../../services/db';

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
    reasoning:        'Strong PM reasoning.',
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

// ── Test helpers ──────────────────────────────────────────────────────────────

const mockDbPutEvaluation = vi.mocked(dbModule.dbPutEvaluation);
const mockDbGet            = vi.mocked(dbModule.dbGet);

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockDbPutEvaluation.mockResolvedValue(undefined);
  // Simulate "no pre-existing record" — the immutability guard in save() calls
  // dbGet and checks `existing !== null`.  Without this default, vi.clearAllMocks()
  // leaves the mock returning undefined, which satisfies `!== null` and causes
  // isSuccessfulEvaluation(undefined) to throw.
  mockDbGet.mockResolvedValue(null);
});

// 1. Successful save

describe('EvaluationStore.save — successful save', () => {
  it('calls dbPutEvaluation once', async () => {
    await EvaluationStore.save(makeInput());
    expect(mockDbPutEvaluation).toHaveBeenCalledOnce();
  });

  it('passes the deterministic record id to dbPutEvaluation', async () => {
    await EvaluationStore.save(makeInput({ hello_eq_submission_id: 'is_test_save' }));
    const [, recordId] = mockDbPutEvaluation.mock.calls[0];
    expect(recordId).toBe('eval_sub_is_test_save');
  });

  it('passes hello_eq_exercise_id as the plaintext index arg', async () => {
    await EvaluationStore.save(makeInput({ hello_eq_exercise_id: 'fc_007' }));
    const [, , exerciseId] = mockDbPutEvaluation.mock.calls[0];
    expect(exerciseId).toBe('fc_007');
  });

  it('returns a record whose id matches the deterministic key', async () => {
    const record = await EvaluationStore.save(makeInput({ hello_eq_submission_id: 'is_ret_test' }));
    expect(record.id).toBe('eval_sub_is_ret_test');
  });

  it('returns a record with sync_status pending', async () => {
    const record = await EvaluationStore.save(makeInput());
    expect(record.sync_status).toBe('pending');
  });

  it('the record passed to dbPutEvaluation matches the returned record', async () => {
    const record = await EvaluationStore.save(makeInput());
    const [, , , persisted] = mockDbPutEvaluation.mock.calls[0];
    expect(persisted).toEqual(record);
  });
});

// 2. Retry / upsert semantics

describe('EvaluationStore.save — retry upsert semantics', () => {
  it('produces the same record id on a second save for the same submission', async () => {
    const input = makeInput({ hello_eq_submission_id: 'is_retry_sub' });
    await EvaluationStore.save(input);
    await EvaluationStore.save(input); // simulates a retry

    const calls = mockDbPutEvaluation.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][1]).toBe('eval_sub_is_retry_sub');
    expect(calls[1][1]).toBe('eval_sub_is_retry_sub');
  });

  it('both retry calls pass the same exercise id to the index arg', async () => {
    const input = makeInput({ hello_eq_submission_id: 'is_retry_sub2' });
    await EvaluationStore.save(input);
    await EvaluationStore.save(input);

    const calls = mockDbPutEvaluation.mock.calls;
    expect(calls[0][2]).toBe('fc_001');
    expect(calls[1][2]).toBe('fc_001');
  });

  it('different submission ids produce different record ids (no cross-contamination)', async () => {
    await EvaluationStore.save(makeInput({ hello_eq_submission_id: 'is_sub_aaa' }));
    await EvaluationStore.save(makeInput({ hello_eq_submission_id: 'is_sub_bbb' }));

    const calls = mockDbPutEvaluation.mock.calls;
    expect(calls[0][1]).toBe('eval_sub_is_sub_aaa');
    expect(calls[1][1]).toBe('eval_sub_is_sub_bbb');
    expect(calls[0][1]).not.toBe(calls[1][1]);
  });
});

// 3. No duplicates for same submission

describe('EvaluationStore.save — no duplicate canonical evaluations', () => {
  it('calling save() n times for the same submission always uses the same key', async () => {
    const input = makeInput({ hello_eq_submission_id: 'is_dedup_sub' });
    await EvaluationStore.save(input);
    await EvaluationStore.save(input);
    await EvaluationStore.save(input);

    const ids = mockDbPutEvaluation.mock.calls.map(([, id]) => id);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe('eval_sub_is_dedup_sub');
  });
});

// 4. Provenance fields survive save

describe('EvaluationStore.save — provenance fields survive', () => {
  it('graph_version is preserved in the persisted record', async () => {
    const input = makeInput({
      evaluation: makeEvaluation({ provenance: { model: 'pm-v3', version: '3.0.0', evaluated_at: '2026-04-07T00:00:00Z' } }),
    });
    const record = await EvaluationStore.save(input);

    expect(record.graph_version).toBe('pm-v3');
    const [, , , persisted] = mockDbPutEvaluation.mock.calls[0];
    expect((persisted as PMGraphEvaluationRecord).graph_version).toBe('pm-v3');
  });

  it('rubric_version is preserved in the persisted record', async () => {
    const input = makeInput({
      evaluation: makeEvaluation({ provenance: { model: 'pm-v3', version: '3.0.0', evaluated_at: '2026-04-07T00:00:00Z' } }),
    });
    const record = await EvaluationStore.save(input);

    expect(record.rubric_version).toBe('3.0.0');
    const [, , , persisted] = mockDbPutEvaluation.mock.calls[0];
    expect((persisted as PMGraphEvaluationRecord).rubric_version).toBe('3.0.0');
  });

  it('created_at maps to provenance.evaluated_at and is preserved', async () => {
    const ts = '2026-06-15T09:00:00Z';
    const input = makeInput({
      evaluation: makeEvaluation({ provenance: { model: 'pm-v1', version: '1.0.0', evaluated_at: ts } }),
    });
    const record = await EvaluationStore.save(input);

    expect(record.created_at).toBe(ts);
    const [, , , persisted] = mockDbPutEvaluation.mock.calls[0];
    expect((persisted as PMGraphEvaluationRecord).created_at).toBe(ts);
  });

  it('provenance fields survive across two saves (retry scenario)', async () => {
    const ts = '2026-04-07T12:34:56Z';
    const input = makeInput({
      hello_eq_submission_id: 'is_prov_retry',
      evaluation: makeEvaluation({ provenance: { model: 'pm-v2', version: '2.1.0', evaluated_at: ts } }),
    });
    await EvaluationStore.save(input);
    await EvaluationStore.save(input);

    for (const call of mockDbPutEvaluation.mock.calls) {
      const rec = call[3] as PMGraphEvaluationRecord;
      expect(rec.graph_version).toBe('pm-v2');
      expect(rec.rubric_version).toBe('2.1.0');
      expect(rec.created_at).toBe(ts);
    }
  });
});

// 5. markSynced / markSyncError update sync_status

describe('EvaluationStore.markSynced', () => {
  it('reads the existing record then re-puts it with sync_status synced', async () => {
    const existingRecord: PMGraphEvaluationRecord = {
      id:                     'eval_sub_is_mark_sync',
      member_id:              null,
      hello_eq_exercise_id:   'fc_001',
      hello_eq_submission_id: 'is_mark_sync',
      exercise_type:          'friction_case',
      overall_score:          0.8,
      dimension_scores:       DIMENSION_SCORES,
      feedback:               null,
      top_missed_insights:    null,
      competing_stances:      null,
      contested:              null,
      benchmark_surface:      'pricing_page',
      graph_case_id:          null,
      cluster_ids_used:       null,
      rubric_version:         '2.1.0',
      graph_version:          'pm-graph-v2',
      evaluated_at:           '2026-04-07T12:34:56Z',
      weights_used:           null,
      rubric_profile:         null,
      curation_version:       null,
      scoring_engine_version: null,
      expert_tag_signals:     null,
      credibility_event:      null,
      created_at:             '2026-04-07T12:34:56Z',
      sync_status:            'pending',
    };

    mockDbGet.mockResolvedValueOnce(existingRecord);

    await EvaluationStore.markSynced('eval_sub_is_mark_sync');

    // dbGet should have been called to read the current record.
    expect(mockDbGet).toHaveBeenCalledWith(
      expect.anything(),
      'eval_sub_is_mark_sync',
    );

    // dbPutEvaluation should re-put with sync_status: 'synced'.
    expect(mockDbPutEvaluation).toHaveBeenCalledOnce();
    const [, , , updated] = mockDbPutEvaluation.mock.calls[0];
    expect((updated as PMGraphEvaluationRecord).sync_status).toBe('synced');
    expect((updated as PMGraphEvaluationRecord).id).toBe('eval_sub_is_mark_sync');
  });

  it('is a no-op when the record does not exist', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await EvaluationStore.markSynced('eval_sub_nonexistent');
    expect(mockDbPutEvaluation).not.toHaveBeenCalled();
  });
});

describe('EvaluationStore.markSyncError', () => {
  it('re-puts with sync_status error', async () => {
    const existingRecord: PMGraphEvaluationRecord = {
      id:                     'eval_sub_is_mark_err',
      member_id:              null,
      hello_eq_exercise_id:   'fc_001',
      hello_eq_submission_id: 'is_mark_err',
      exercise_type:          'friction_case',
      overall_score:          0.7,
      dimension_scores:       DIMENSION_SCORES,
      feedback:               null,
      top_missed_insights:    null,
      competing_stances:      null,
      contested:              null,
      benchmark_surface:      'pricing_page',
      graph_case_id:          null,
      cluster_ids_used:       null,
      rubric_version:         '2.1.0',
      graph_version:          'pm-graph-v2',
      evaluated_at:           '2026-04-07T12:34:56Z',
      weights_used:           null,
      rubric_profile:         null,
      curation_version:       null,
      scoring_engine_version: null,
      expert_tag_signals:     null,
      credibility_event:      null,
      created_at:             '2026-04-07T12:34:56Z',
      sync_status:            'pending',
    };

    mockDbGet.mockResolvedValueOnce(existingRecord);

    await EvaluationStore.markSyncError('eval_sub_is_mark_err');

    const [, , , updated] = mockDbPutEvaluation.mock.calls[0];
    expect((updated as PMGraphEvaluationRecord).sync_status).toBe('error');
  });

  it('is a no-op when the record does not exist', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await EvaluationStore.markSyncError('eval_sub_nonexistent');
    expect(mockDbPutEvaluation).not.toHaveBeenCalled();
  });
});

// 6. Degraded response cannot produce a record via save()
//
// save() accepts a PMGraphEvaluateResponse (success shape), not a degraded
// shape. The pipeline guard (runFrictionCaseEvaluation) is the enforcer — it
// checks `raw.degraded === true` before ever calling save().
// Here we verify the structural contract: a degraded body cannot satisfy the
// SaveEvaluationInput type because it lacks `score`, `dimension_scores`, and
// `provenance`. This is enforced at compile time by TypeScript, not at runtime.
//
// The runtime guard is exercised in runFrictionCaseEvaluation.test.ts.
// We include a single runtime smoke test for belt-and-suspenders.

describe('EvaluationStore.save — degraded response guard (runtime)', () => {
  it('throws or produces a broken record when given a degraded body — save() is never called on degraded data in the real pipeline', async () => {
    // Cast to force the call — in production, the pipeline check prevents this.
    const degradedBody = { degraded: true, score: null, dimension_scores: null, provenance: null };

    // save() will call buildEvaluationRecord which reads evaluation.score,
    // evaluation.dimension_scores, etc. — all null → the record is malformed.
    // We verify that calling save() with degraded data does NOT silently
    // produce a record that looks like a valid evaluation (overall_score would
    // be null/NaN, not a number in [0,1]).
    let record: PMGraphEvaluationRecord | null = null;
    let threw = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      record = await EvaluationStore.save({ evaluation: degradedBody as any, hello_eq_exercise_id: 'fc_001', hello_eq_submission_id: 'is_degrade', benchmark_surface: 'pricing_page', member_id: null });
    } catch {
      threw = true;
    }

    // Either it threw (accessing .score on null) OR the record's overall_score
    // is null/NaN — neither is a valid successful evaluation record.
    if (!threw && record !== null) {
      expect(typeof record.overall_score === 'number' && record.overall_score >= 0).toBe(false);
    }
    // The key guarantee: the pipeline never reaches this path. The test above
    // documents the behaviour without prescribing whether it throws or produces
    // a broken record — both outcomes are acceptable because the real code
    // never passes degraded data to save().
  });
});
