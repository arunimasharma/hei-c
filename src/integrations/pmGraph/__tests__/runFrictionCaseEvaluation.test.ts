/**
 * runFrictionCaseEvaluation.test.ts
 *
 * Unit tests for the core evaluation pipeline function.
 *
 * runFrictionCaseEvaluation is extracted from usePMGraphEvaluation so it can
 * be tested in a Node environment without a React renderer — matching the
 * repo's existing pattern (pure-function tests, vitest, node environment).
 *
 * All external dependencies (fetch, EvaluationStore.save, syncEvaluation)
 * are injected via the `deps` parameter to allow deterministic unit testing.
 *
 * Coverage:
 *  1. Returns { ok: true, record } on a valid PM Graph response
 *  2. Returns { ok: false, reason: 'network_error' } on fetch throw
 *  3. Returns { ok: false, reason: 'http_error' } on non-ok HTTP status
 *  4. Returns { ok: false, reason: 'degraded' } on degraded adapter response
 *  5. Returns { ok: false, reason: 'store_error' } when EvaluationStore.save throws
 *  6. POSTs to correct route with correct headers
 *  7. Payload includes caseId, submissionId, rootAnswerIndex, fixAnswerIndex
 *  8. reflectionText is included when non-empty, omitted when blank
 *  9. syncFn is called fire-and-forget after successful save
 * 10. markSynced called after successful sync
 * 11. markSyncError called after failed sync
 * 12. sessionIdFn result appears in X-Session-Id header
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runFrictionCaseEvaluation, type EvaluateInput } from '../usePMGraphEvaluation';
import type { FrictionCase } from '../../../data/frictionCases';
import type { InsightSubmission } from '../../../lib/InsightStore';
import type { PMGraphEvaluationRecord } from '../EvaluationStore';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CASE: FrictionCase = {
  id:                    'fc_001',
  trigger:               'exit_intent',
  context:               'Pricing page — cursor moved toward browser chrome',
  rawResponse:           'Too expensive',
  narrative:             'User landed on pricing after clicking Upgrade.',
  theme:                 'pricing',
  rootIssueOptions:      ['Price above market', 'Value unclear', 'No free trial', 'Layout confusing'],
  correctRootIssueIndex: 1,
  fixOptions:            ['Cut price', 'Add social proof', 'Add trial', 'Redesign'],
  correctFixIndex:       1,
  realDataInsight:       '71% of users…',
  signalStrength:        71,
  pmAgreementRate:       58,
};

const SUBMISSION: InsightSubmission = {
  id:               'is_1234_abcd',
  caseId:           'fc_001',
  theme:            'pricing',
  rootIssueCorrect: true,
  fixCorrect:       true,
  score:            1,
  maxScore:         1,
  timestamp:        '2026-04-07T10:00:00.000Z',
};

const BASE_INPUT: EvaluateInput = {
  submission:      SUBMISSION,
  activeCase:      CASE,
  rootAnswerIndex: 1,
  fixAnswerIndex:  1,
  memberId:        null,
};

const VALID_ADAPTER_RESPONSE = {
  score: 0.82,
  dimension_scores: {
    product_judgment:   0.85,
    specificity:        0.78,
    tradeoff_awareness: 0.80,
    segmentation_logic: 0.75,
    strategic_empathy:  0.90,
    market_inference:   0.83,
  },
  provenance: {
    model:        'pm-graph-v1',
    version:      '1.0.0',
    evaluated_at: '2026-04-07T10:00:00Z',
  },
  reasoning: 'Strong diagnostic reasoning.',
  request_id: 'heq_test_req_1',
};

const STORED_RECORD: PMGraphEvaluationRecord = {
  id:                     'eval_abc_xyz',
  member_id:              null,
  hello_eq_exercise_id:   'fc_001',
  hello_eq_submission_id: 'is_1234_abcd',
  exercise_type:          'friction_case',
  overall_score:          0.82,
  dimension_scores:       VALID_ADAPTER_RESPONSE.dimension_scores as PMGraphEvaluationRecord['dimension_scores'],
  feedback:               'Strong diagnostic reasoning.',
  top_missed_insights:    null,
  competing_stances:      null,
  contested:              null,
  benchmark_surface:      'pricing_page',
  graph_case_id:          null,
  cluster_ids_used:       null,
  rubric_version:         '1.0.0',
  graph_version:          'pm-graph-v1',
  evaluated_at:           '2026-04-07T10:00:00Z',
  weights_used:           null,
  rubric_profile:         null,
  curation_version:       null,
  scoring_engine_version: null,
  expert_tag_signals:     null,
  credibility_event:      null,
  created_at:             '2026-04-07T10:00:00Z',
  sync_status:            'pending',
};

// ── Helper: build a mock fetch ────────────────────────────────────────────────

function mockOkFetch(body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok:   true,
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as typeof fetch;
}

function mockStatusFetch(status: number): typeof fetch {
  return vi.fn().mockResolvedValue({ ok: false, status }) as unknown as typeof fetch;
}

// ── Default dep stubs ─────────────────────────────────────────────────────────

function defaultDeps(overrides: Parameters<typeof runFrictionCaseEvaluation>[1] = {}) {
  return {
    saveFn:       vi.fn().mockResolvedValue(STORED_RECORD),
    syncFn:       vi.fn().mockResolvedValue(undefined),
    markSyncedFn: vi.fn().mockResolvedValue(undefined),
    markErrorFn:  vi.fn().mockResolvedValue(undefined),
    sessionIdFn:  vi.fn().mockReturnValue('session-test-id'),
    fetchFn:      mockOkFetch(VALID_ADAPTER_RESPONSE),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

// 1. Success path

describe('successful evaluation', () => {
  it('returns { ok: true, record } on a valid adapter response', async () => {
    const deps = defaultDeps();
    const result = await runFrictionCaseEvaluation(BASE_INPUT, deps);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record).toBe(STORED_RECORD);
  });

  it('calls saveFn with the adapter response, exercise id, and submission id', async () => {
    const deps = defaultDeps();
    await runFrictionCaseEvaluation(BASE_INPUT, deps);
    expect(deps.saveFn).toHaveBeenCalledOnce();
    const arg = (deps.saveFn as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(arg.hello_eq_exercise_id).toBe('fc_001');
    expect(arg.hello_eq_submission_id).toBe('is_1234_abcd');
    expect(arg.benchmark_surface).toBe('pricing_page');
    expect(arg.member_id).toBeNull();
  });

  it('calls syncFn with the stored record after save', async () => {
    const deps = defaultDeps();
    await runFrictionCaseEvaluation(BASE_INPUT, deps);
    // syncFn is fire-and-forget; wait microtask
    await Promise.resolve();
    expect(deps.syncFn).toHaveBeenCalledWith(STORED_RECORD);
  });
});

// 2. Network error

describe('network error', () => {
  it('returns { ok: false, reason: network_error } when fetch throws', async () => {
    const deps = defaultDeps({
      fetchFn: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch,
    });
    const result = await runFrictionCaseEvaluation(BASE_INPUT, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('network_error');
  });

  it('does not call saveFn on network error', async () => {
    const deps = defaultDeps({
      fetchFn: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch,
    });
    await runFrictionCaseEvaluation(BASE_INPUT, deps);
    expect(deps.saveFn).not.toHaveBeenCalled();
  });
});

// 3. HTTP error

describe('http error', () => {
  it('returns { ok: false, reason: http_error } on non-ok status', async () => {
    const deps = defaultDeps({ fetchFn: mockStatusFetch(400) });
    const result = await runFrictionCaseEvaluation(BASE_INPUT, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('http_error');
  });

  it('does not call saveFn on http error', async () => {
    const deps = defaultDeps({ fetchFn: mockStatusFetch(500) });
    await runFrictionCaseEvaluation(BASE_INPUT, deps);
    expect(deps.saveFn).not.toHaveBeenCalled();
  });
});

// 4. Degraded response

describe('degraded adapter response', () => {
  it('returns { ok: false, reason: degraded } when degraded: true', async () => {
    const deps = defaultDeps({
      fetchFn: mockOkFetch({ degraded: true, reason: 'pm_graph_unavailable', score: null, request_id: 'r1' }),
    });
    const result = await runFrictionCaseEvaluation(BASE_INPUT, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('degraded');
  });

  it('does not call saveFn on degraded response', async () => {
    const deps = defaultDeps({
      fetchFn: mockOkFetch({ degraded: true, reason: 'pm_graph_unavailable', score: null }),
    });
    await runFrictionCaseEvaluation(BASE_INPUT, deps);
    expect(deps.saveFn).not.toHaveBeenCalled();
  });
});

// 5. Store error

describe('store error', () => {
  it('returns { ok: false, reason: store_error } when saveFn throws', async () => {
    const deps = defaultDeps({
      saveFn: vi.fn().mockRejectedValue(new Error('IndexedDB unavailable')),
    });
    const result = await runFrictionCaseEvaluation(BASE_INPUT, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('store_error');
  });
});

// 6. Request correctness

describe('request shape', () => {
  it('POSTs to /api/pm-graph/evaluate-friction-case', async () => {
    const deps = defaultDeps();
    await runFrictionCaseEvaluation(BASE_INPUT, deps);
    const [url] = (deps.fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/pm-graph/evaluate-friction-case');
  });

  it('sends Content-Type: application/json', async () => {
    const deps = defaultDeps();
    await runFrictionCaseEvaluation(BASE_INPUT, deps);
    const [, init] = (deps.fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('sends X-Session-Id from sessionIdFn', async () => {
    const deps = defaultDeps({ sessionIdFn: vi.fn().mockReturnValue('my-session-xyz') });
    await runFrictionCaseEvaluation(BASE_INPUT, deps);
    const [, init] = (deps.fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Session-Id']).toBe('my-session-xyz');
  });

  it('includes caseId, submissionId, rootAnswerIndex, fixAnswerIndex in body', async () => {
    const deps = defaultDeps();
    await runFrictionCaseEvaluation(BASE_INPUT, deps);
    const [, init] = (deps.fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.caseId).toBe('fc_001');
    expect(body.submissionId).toBe('is_1234_abcd');
    expect(body.rootAnswerIndex).toBe(1);
    expect(body.fixAnswerIndex).toBe(1);
  });
});

// 7. Payload correctness

describe('payload', () => {
  it('includes reflectionText when non-empty', async () => {
    const deps = defaultDeps();
    await runFrictionCaseEvaluation({ ...BASE_INPUT, reflectionText: 'My reasoning here' }, deps);
    const [, init] = (deps.fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.reflectionText).toBe('My reasoning here');
  });

  it('omits reflectionText when blank', async () => {
    const deps = defaultDeps();
    await runFrictionCaseEvaluation({ ...BASE_INPUT, reflectionText: '   ' }, deps);
    const [, init] = (deps.fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.reflectionText).toBeUndefined();
  });

  it('omits reflectionText when absent', async () => {
    const deps = defaultDeps();
    await runFrictionCaseEvaluation({ ...BASE_INPUT, reflectionText: undefined }, deps);
    const [, init] = (deps.fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.reflectionText).toBeUndefined();
  });
});

// 8. Theme → surface mapping in saveFn call

describe('theme to surface mapping', () => {
  const cases: Array<[FrictionCase['theme'], string]> = [
    ['pricing',    'pricing_page'],
    ['ux',         'product_ux'],
    ['onboarding', 'onboarding_flow'],
    ['value',      'value_proposition'],
    ['trust',      'trust_and_safety'],
  ];
  for (const [theme, surface] of cases) {
    it(`passes benchmark_surface='${surface}' for theme='${theme}'`, async () => {
      const deps = defaultDeps();
      await runFrictionCaseEvaluation(
        { ...BASE_INPUT, activeCase: { ...CASE, theme } },
        deps,
      );
      const arg = (deps.saveFn as ReturnType<typeof vi.fn>).mock.calls[0][0] as { benchmark_surface: string };
      expect(arg.benchmark_surface).toBe(surface);
    });
  }
});

// 9–11. Sync lifecycle

describe('sync lifecycle', () => {
  it('calls syncFn after successful save', async () => {
    const deps = defaultDeps();
    await runFrictionCaseEvaluation(BASE_INPUT, deps);
    await Promise.resolve();
    expect(deps.syncFn).toHaveBeenCalledOnce();
  });

  it('calls markSyncedFn after syncFn resolves', async () => {
    const deps = defaultDeps();
    await runFrictionCaseEvaluation(BASE_INPUT, deps);
    await Promise.resolve(); // flush fire-and-forget .then()
    expect(deps.markSyncedFn).toHaveBeenCalledWith(STORED_RECORD.id);
  });

  it('calls markErrorFn after syncFn rejects', async () => {
    const deps = defaultDeps({
      syncFn: vi.fn().mockRejectedValue(new Error('Supabase down')),
    });
    await runFrictionCaseEvaluation(BASE_INPUT, deps);
    await Promise.resolve();
    expect(deps.markErrorFn).toHaveBeenCalledWith(STORED_RECORD.id);
  });

  it('does not call syncFn on degraded response', async () => {
    const deps = defaultDeps({
      fetchFn: mockOkFetch({ degraded: true, score: null }),
    });
    await runFrictionCaseEvaluation(BASE_INPUT, deps);
    await Promise.resolve();
    expect(deps.syncFn).not.toHaveBeenCalled();
  });

  it('does not call syncFn on store_error', async () => {
    const deps = defaultDeps({
      saveFn: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    await runFrictionCaseEvaluation(BASE_INPUT, deps);
    await Promise.resolve();
    expect(deps.syncFn).not.toHaveBeenCalled();
  });
});

// 12. Success after prior failure

describe('success after failure', () => {
  it('returns ok:true on second call when first call had a network error', async () => {
    const deps = defaultDeps();
    const failDeps = defaultDeps({
      fetchFn: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch,
    });

    const firstResult = await runFrictionCaseEvaluation(BASE_INPUT, failDeps);
    expect(firstResult.ok).toBe(false);

    const secondResult = await runFrictionCaseEvaluation(BASE_INPUT, deps);
    expect(secondResult.ok).toBe(true);
    if (secondResult.ok) expect(secondResult.record).toBe(STORED_RECORD);
  });

  it('calls saveFn once per successful call, not for failed calls', async () => {
    const failDeps = defaultDeps({
      fetchFn: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch,
    });
    const successDeps = defaultDeps();

    await runFrictionCaseEvaluation(BASE_INPUT, failDeps);
    await runFrictionCaseEvaluation(BASE_INPUT, successDeps);

    expect(failDeps.saveFn).not.toHaveBeenCalled();
    expect(successDeps.saveFn).toHaveBeenCalledOnce();
  });
});

// 13. Degraded response does not write to store

describe('degraded response does not write to store', () => {
  it('does not call saveFn on any degraded response', async () => {
    const degradedBodies = [
      { degraded: true, reason: 'pm_graph_unavailable',          score: null, request_id: 'r1' },
      { degraded: true, reason: 'pm_graph_auth_error',           score: null, request_id: 'r2' },
      { degraded: true, reason: 'pm_graph_unexpected_response',  score: null, request_id: 'r3' },
      { degraded: true, reason: 'pm_graph_validation_error',     score: null, request_id: 'r4' },
    ];

    for (const body of degradedBodies) {
      const deps = defaultDeps({ fetchFn: mockOkFetch(body) });
      await runFrictionCaseEvaluation(BASE_INPUT, deps);
      expect(deps.saveFn).not.toHaveBeenCalled();
    }
  });

  it('returns reason:degraded (not ok:true) for a degraded response', async () => {
    const deps = defaultDeps({
      fetchFn: mockOkFetch({ degraded: true, reason: 'pm_graph_unavailable', score: null, request_id: 'r1' }),
    });
    const result = await runFrictionCaseEvaluation(BASE_INPUT, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('degraded');
  });
});

// 14. member_id is passed as snake_case to saveFn

describe('member_id field in saveFn call', () => {
  it('passes member_id: null when memberId is null', async () => {
    const deps = defaultDeps();
    await runFrictionCaseEvaluation({ ...BASE_INPUT, memberId: null }, deps);
    const arg = (deps.saveFn as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(arg.member_id).toBeNull();
    expect('memberId' in arg).toBe(false);
  });

  it('passes member_id: string when memberId is provided', async () => {
    const deps = defaultDeps();
    await runFrictionCaseEvaluation({ ...BASE_INPUT, memberId: 'user_abc_123' }, deps);
    const arg = (deps.saveFn as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(arg.member_id).toBe('user_abc_123');
  });
});
