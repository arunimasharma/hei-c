/**
 * route.test.ts
 *
 * Integration-style tests for the /api/pm-graph/evaluate-friction-case handler.
 *
 * callPMGraphEvaluate is mocked — no real HTTP calls are made.
 * The mapper and validation run for real so this tests the full request pipeline.
 *
 * Coverage:
 *  1. 405 on non-POST methods
 *  2. 400 when X-Session-Id header is missing
 *  3. 400 when required body fields are missing or invalid
 *  4. 200 with full PM Graph response + request_id on success
 *  5. 200 degraded response on PMGraphUnavailableError
 *  6. 200 degraded response on PMGraphAuthError
 *  7. 200 degraded response on PMGraphUnexpectedResponseError
 *  8. 200 degraded response on PMGraphValidationError
 *  9. request_id propagated from X-Request-Id header
 * 10. request_id auto-generated when X-Request-Id is absent
 * 11. secrets are never present in the response body
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ── Mock callPMGraphEvaluate before importing the handler ────────────────────
// vi.mock is hoisted to the top of the file by Vitest's transformer.
vi.mock('../client', () => ({
  callPMGraphEvaluate: vi.fn(),
}));

import handler from '../../../../api/pm-graph/evaluate-friction-case';
import { callPMGraphEvaluate } from '../client';
import {
  PMGraphAuthError,
  PMGraphUnavailableError,
  PMGraphUnexpectedResponseError,
  PMGraphValidationError,
} from '../errors';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_RESPONSE = {
  score: 0.75,
  dimension_scores: {
    product_judgment:   0.80,
    specificity:        0.70,
    tradeoff_awareness: 0.75,
    segmentation_logic: 0.70,
    strategic_empathy:  0.85,
    market_inference:   0.70,
  },
  provenance: {
    model:        'pm-graph-v1',
    version:      '1.0.0',
    evaluated_at: '2026-04-06T10:00:00Z',
  },
};

const VALID_BODY = {
  caseId:           'fc_001',
  submissionId:     'is_1234_abcd',
  theme:            'pricing',
  context:          'Pricing page — cursor moved toward browser chrome',
  narrative:        'User landed on pricing after clicking Upgrade.',
  rawResponse:      'Too expensive',
  rootIssueOptions: ['Price above market', 'Value unclear', 'No free trial'],
  rootAnswerIndex:  1,
  fixOptions:       ['Cut price', 'Add social proof', 'Add free trial'],
  fixAnswerIndex:   1,
};

// ── Mock request / response builders ─────────────────────────────────────────

function makeReq(overrides: {
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown> | null;
} = {}): VercelRequest {
  return {
    method:  overrides.method  ?? 'POST',
    headers: overrides.headers ?? { 'x-session-id': 'session-abc' },
    body:    overrides.body    ?? VALID_BODY,
  } as unknown as VercelRequest;
}

function makeRes(): {
  res: VercelResponse;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  lastStatus: () => number;
  lastJson: () => unknown;
} {
  let _status = 0;
  let _body: unknown = null;

  const json = vi.fn((body: unknown) => { _body = body; return resObj; });
  const status = vi.fn((code: number) => { _status = code; return resObj; });

  const resObj = { status, json } as unknown as VercelResponse;

  return {
    res:        resObj,
    status,
    json,
    lastStatus: () => _status,
    lastJson:   () => _body,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const mockCallPMGraph = callPMGraphEvaluate as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockCallPMGraph.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 1. Method guard ───────────────────────────────────────────────────────────

describe('method guard', () => {
  for (const method of ['GET', 'PUT', 'DELETE', 'PATCH']) {
    it(`returns 405 for ${method}`, async () => {
      const { res, lastStatus } = makeRes();
      await handler(makeReq({ method }), res);
      expect(lastStatus()).toBe(405);
    });
  }
});

// ── 2. Auth — missing session header ─────────────────────────────────────────

describe('session header', () => {
  it('returns 400 when X-Session-Id is absent', async () => {
    const { res, lastStatus, lastJson } = makeRes();
    await handler(makeReq({ headers: {} }), res);
    expect(lastStatus()).toBe(400);
    expect((lastJson() as { error: string }).error).toMatch(/X-Session-Id/i);
  });

  it('returns 400 when X-Session-Id is blank', async () => {
    const { res, lastStatus } = makeRes();
    await handler(makeReq({ headers: { 'x-session-id': '   ' } }), res);
    expect(lastStatus()).toBe(400);
  });
});

// ── 3. Input validation ───────────────────────────────────────────────────────

describe('input validation', () => {
  it('returns 400 when caseId is missing', async () => {
    const { res, lastStatus } = makeRes();
    await handler(makeReq({ body: { ...VALID_BODY, caseId: undefined } }), res);
    expect(lastStatus()).toBe(400);
  });

  it('returns 400 when theme is invalid', async () => {
    const { res, lastStatus } = makeRes();
    await handler(makeReq({ body: { ...VALID_BODY, theme: 'invalid_theme' } }), res);
    expect(lastStatus()).toBe(400);
  });

  it('returns 400 when context is missing', async () => {
    const { res, lastStatus } = makeRes();
    await handler(makeReq({ body: { ...VALID_BODY, context: '' } }), res);
    expect(lastStatus()).toBe(400);
  });

  it('returns 400 when rootIssueOptions is not an array', async () => {
    const { res, lastStatus } = makeRes();
    await handler(makeReq({ body: { ...VALID_BODY, rootIssueOptions: 'not-array' } }), res);
    expect(lastStatus()).toBe(400);
  });

  it('returns 400 when rootAnswerIndex is out of bounds', async () => {
    const { res, lastStatus } = makeRes();
    await handler(makeReq({ body: { ...VALID_BODY, rootAnswerIndex: 99 } }), res);
    expect(lastStatus()).toBe(400);
  });

  it('returns 400 when fixOptions is empty', async () => {
    const { res, lastStatus } = makeRes();
    await handler(makeReq({ body: { ...VALID_BODY, fixOptions: [] } }), res);
    expect(lastStatus()).toBe(400);
  });

  it('returns 400 when fixAnswerIndex is out of bounds', async () => {
    const { res, lastStatus } = makeRes();
    await handler(makeReq({ body: { ...VALID_BODY, fixAnswerIndex: -1 } }), res);
    expect(lastStatus()).toBe(400);
  });
});

// ── 4. Success path ───────────────────────────────────────────────────────────

describe('success path', () => {
  it('returns 200 with PM Graph response merged with request_id', async () => {
    mockCallPMGraph.mockResolvedValue(VALID_RESPONSE);

    const { res, lastStatus, lastJson } = makeRes();
    await handler(makeReq(), res);

    expect(lastStatus()).toBe(200);
    const body = lastJson() as Record<string, unknown>;
    expect(body.score).toBe(0.75);
    expect(body.provenance).toBeDefined();
    expect(typeof body.request_id).toBe('string');
    expect((body.request_id as string).length).toBeGreaterThan(0);
  });

  it('does not include degraded:true on success', async () => {
    mockCallPMGraph.mockResolvedValue(VALID_RESPONSE);

    const { res, lastJson } = makeRes();
    await handler(makeReq(), res);

    const body = lastJson() as Record<string, unknown>;
    expect(body.degraded).toBeUndefined();
  });
});

// ── 5–8. Degraded paths ───────────────────────────────────────────────────────

describe('degraded responses', () => {
  const degradedCases: Array<{
    label: string;
    error: Error;
    expectedReason: string;
  }> = [
    {
      label:          'PMGraphUnavailableError',
      error:          new PMGraphUnavailableError('service down'),
      expectedReason: 'pm_graph_unavailable',
    },
    {
      label:          'PMGraphAuthError',
      error:          new PMGraphAuthError('bad token'),
      expectedReason: 'pm_graph_auth_error',
    },
    {
      label:          'PMGraphUnexpectedResponseError',
      error:          new PMGraphUnexpectedResponseError('schema mismatch'),
      expectedReason: 'pm_graph_unexpected_response',
    },
    {
      label:          'PMGraphValidationError',
      error:          new PMGraphValidationError('bad payload'),
      expectedReason: 'pm_graph_validation_error',
    },
  ];

  for (const { label, error, expectedReason } of degradedCases) {
    it(`returns HTTP 200 with degraded=true and reason=${expectedReason} on ${label}`, async () => {
      mockCallPMGraph.mockRejectedValue(error);

      const { res, lastStatus, lastJson } = makeRes();
      await handler(makeReq(), res);

      expect(lastStatus()).toBe(200);
      const body = lastJson() as Record<string, unknown>;
      expect(body.degraded).toBe(true);
      expect(body.reason).toBe(expectedReason);
      expect(body.score).toBeNull();
      expect(body.dimension_scores).toBeNull();
      expect(body.provenance).toBeNull();
      expect(body.reasoning).toBeNull();
    });

    it(`degraded response on ${label} includes a request_id`, async () => {
      mockCallPMGraph.mockRejectedValue(error);

      const { res, lastJson } = makeRes();
      await handler(makeReq(), res);

      const body = lastJson() as Record<string, unknown>;
      expect(typeof body.request_id).toBe('string');
      expect((body.request_id as string).length).toBeGreaterThan(0);
    });
  }
});

// ── 9. request_id propagated from header ──────────────────────────────────────

describe('request_id propagation', () => {
  it('uses X-Request-Id from request headers when present', async () => {
    mockCallPMGraph.mockResolvedValue(VALID_RESPONSE);

    const { res, lastJson } = makeRes();
    await handler(
      makeReq({ headers: { 'x-session-id': 'session-abc', 'x-request-id': 'caller-req-123' } }),
      res,
    );

    const body = lastJson() as Record<string, unknown>;
    expect(body.request_id).toBe('caller-req-123');
  });

  it('forwards request_id to callPMGraphEvaluate as second argument', async () => {
    mockCallPMGraph.mockResolvedValue(VALID_RESPONSE);

    const { res } = makeRes();
    await handler(
      makeReq({ headers: { 'x-session-id': 'session-abc', 'x-request-id': 'trace-xyz' } }),
      res,
    );

    expect(mockCallPMGraph).toHaveBeenCalledWith(
      expect.any(Object),
      'trace-xyz',
    );
  });
});

// ── 10. request_id auto-generated ────────────────────────────────────────────

describe('request_id auto-generation', () => {
  it('generates a non-empty request_id when X-Request-Id is absent', async () => {
    mockCallPMGraph.mockResolvedValue(VALID_RESPONSE);

    const { res, lastJson } = makeRes();
    await handler(makeReq(), res);

    const body = lastJson() as Record<string, unknown>;
    expect(typeof body.request_id).toBe('string');
    expect((body.request_id as string).startsWith('heq_')).toBe(true);
  });

  it('generates unique request_ids across calls', async () => {
    mockCallPMGraph.mockResolvedValue(VALID_RESPONSE);

    const { res: res1, lastJson: lastJson1 } = makeRes();
    const { res: res2, lastJson: lastJson2 } = makeRes();

    await handler(makeReq(), res1);
    await handler(makeReq(), res2);

    const id1 = (lastJson1() as Record<string, unknown>).request_id;
    const id2 = (lastJson2() as Record<string, unknown>).request_id;

    expect(id1).not.toBe(id2);
  });
});

// ── 11. Secrets not in response ───────────────────────────────────────────────

describe('secrets policy', () => {
  it('does not expose PM_GRAPH_SERVICE_TOKEN in the response body', async () => {
    process.env.PM_GRAPH_SERVICE_TOKEN = 'super-secret-token-never-log-me';
    mockCallPMGraph.mockResolvedValue(VALID_RESPONSE);

    const { res, lastJson } = makeRes();
    await handler(makeReq(), res);

    const body = JSON.stringify(lastJson());
    expect(body).not.toContain('super-secret-token-never-log-me');

    delete process.env.PM_GRAPH_SERVICE_TOKEN;
  });

  it('does not expose PM_GRAPH_BASE_URL in the response body', async () => {
    process.env.PM_GRAPH_BASE_URL = 'https://internal-secret-endpoint.pm-graph.io';
    mockCallPMGraph.mockResolvedValue(VALID_RESPONSE);

    const { res, lastJson } = makeRes();
    await handler(makeReq(), res);

    const body = JSON.stringify(lastJson());
    expect(body).not.toContain('internal-secret-endpoint.pm-graph.io');

    delete process.env.PM_GRAPH_BASE_URL;
  });
});
