/**
 * client.test.ts
 *
 * Unit tests for callPMGraphEvaluate.
 *
 * fetch is stubbed via vi.stubGlobal — no real network calls are made.
 * Retry sleep delays are collapsed to zero via vi.useFakeTimers().
 *
 * Coverage:
 *  1. throws PMGraphUnavailableError when env vars are missing
 *  2. successful 2xx with valid response shape → returns parsed data
 *  3. 401 / 403 → throws PMGraphAuthError (no retry)
 *  4. 4xx (non-auth) → throws PMGraphValidationError (no retry)
 *  5. 5xx → retries up to MAX_RETRIES then throws PMGraphUnavailableError
 *  6. network failure → retries up to MAX_RETRIES then throws PMGraphUnavailableError
 *  7. AbortError (timeout) → treated as PMGraphUnavailableError with timeout message
 *  8. 2xx with invalid response shape → throws PMGraphUnexpectedResponseError
 *  9. 2xx with non-JSON body → throws PMGraphUnexpectedResponseError
 * 10. requestId forwarded as X-Request-Id header when provided
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callPMGraphEvaluate } from '../client';
import {
  PMGraphAuthError,
  PMGraphUnavailableError,
  PMGraphUnexpectedResponseError,
  PMGraphValidationError,
} from '../errors';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_PAYLOAD = {
  exercise_type: 'friction_case',
  answers: { root_issue: 'Value unclear', fix_recommendation: 'Add social proof' },
};

const VALID_RESPONSE = {
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
    evaluated_at: '2026-04-06T10:00:00Z',
  },
  reasoning: 'Strong diagnostic reasoning.',
};

function makeOkFetch(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok:     true,
    status: 200,
    json:   vi.fn().mockResolvedValue(body),
    text:   vi.fn().mockResolvedValue(JSON.stringify(body)),
  });
}

function makeStatusFetch(status: number, text = ''): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok:     status >= 200 && status < 300,
    status,
    json:   vi.fn().mockResolvedValue({}),
    text:   vi.fn().mockResolvedValue(text),
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  process.env.PM_GRAPH_BASE_URL      = 'https://test.pm-graph.internal';
  process.env.PM_GRAPH_SERVICE_TOKEN = 'test-token';
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env.PM_GRAPH_BASE_URL;
  delete process.env.PM_GRAPH_SERVICE_TOKEN;
});

// Helper: runs a call that needs sleep timers advanced to complete.
// Attaches an early .catch() to prevent unhandled-rejection warnings while
// vi.runAllTimersAsync() flushes the sleep queues.
async function runWithTimers<T>(fn: () => Promise<T>): Promise<PromiseSettledResult<T>> {
  const promise = fn();
  // Suppress the transient unhandled-rejection between creation and handler attachment.
  promise.catch(() => {});
  await vi.runAllTimersAsync();
  return promise.then(
    (value) => ({ status: 'fulfilled' as const, value }),
    (reason) => ({ status: 'rejected' as const, reason }),
  );
}

// ── 1. Missing env vars ───────────────────────────────────────────────────────

describe('missing env vars', () => {
  it('throws PMGraphUnavailableError when PM_GRAPH_BASE_URL is missing', async () => {
    delete process.env.PM_GRAPH_BASE_URL;
    await expect(callPMGraphEvaluate(VALID_PAYLOAD)).rejects.toBeInstanceOf(PMGraphUnavailableError);
  });

  it('throws PMGraphUnavailableError when PM_GRAPH_SERVICE_TOKEN is missing', async () => {
    delete process.env.PM_GRAPH_SERVICE_TOKEN;
    await expect(callPMGraphEvaluate(VALID_PAYLOAD)).rejects.toBeInstanceOf(PMGraphUnavailableError);
  });
});

// ── 2. Successful response ────────────────────────────────────────────────────

describe('successful 2xx with valid response', () => {
  it('returns parsed and validated PMGraphEvaluateResponse', async () => {
    vi.stubGlobal('fetch', makeOkFetch(VALID_RESPONSE));
    const result = await callPMGraphEvaluate(VALID_PAYLOAD);
    expect(result.score).toBe(0.82);
    expect(result.dimension_scores.product_judgment).toBe(0.85);
    expect(result.provenance.model).toBe('pm-graph-v1');
  });

  it('POSTs to <baseUrl>/evaluate', async () => {
    const mockFetch = makeOkFetch(VALID_RESPONSE);
    vi.stubGlobal('fetch', mockFetch);
    await callPMGraphEvaluate(VALID_PAYLOAD);
    const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('https://test.pm-graph.internal/evaluate');
  });

  it('strips trailing slash from PM_GRAPH_BASE_URL', async () => {
    process.env.PM_GRAPH_BASE_URL = 'https://test.pm-graph.internal/';
    const mockFetch = makeOkFetch(VALID_RESPONSE);
    vi.stubGlobal('fetch', mockFetch);
    await callPMGraphEvaluate(VALID_PAYLOAD);
    const [calledUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe('https://test.pm-graph.internal/evaluate');
  });
});

// ── 3. Auth failures — no retry ───────────────────────────────────────────────

describe('auth failures (no retry)', () => {
  for (const status of [401, 403]) {
    it(`throws PMGraphAuthError on HTTP ${status} — fetch called exactly once`, async () => {
      const mockFetch = makeStatusFetch(status);
      vi.stubGlobal('fetch', mockFetch);
      await expect(callPMGraphEvaluate(VALID_PAYLOAD)).rejects.toBeInstanceOf(PMGraphAuthError);
      expect(mockFetch.mock.calls).toHaveLength(1);
    });
  }
});

// ── 4. Other 4xx — no retry ───────────────────────────────────────────────────

describe('4xx (non-auth), no retry', () => {
  it('throws PMGraphValidationError on HTTP 400 — fetch called exactly once', async () => {
    const mockFetch = makeStatusFetch(400, 'bad request');
    vi.stubGlobal('fetch', mockFetch);
    await expect(callPMGraphEvaluate(VALID_PAYLOAD)).rejects.toBeInstanceOf(PMGraphValidationError);
    expect(mockFetch.mock.calls).toHaveLength(1);
  });

  it('throws PMGraphValidationError on HTTP 422', async () => {
    vi.stubGlobal('fetch', makeStatusFetch(422, 'unprocessable'));
    await expect(callPMGraphEvaluate(VALID_PAYLOAD)).rejects.toBeInstanceOf(PMGraphValidationError);
  });
});

// ── 5. 5xx with retry ────────────────────────────────────────────────────────

describe('5xx retry behaviour', () => {
  it('retries on 5xx and returns success on a later attempt', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: vi.fn(), text: vi.fn().mockResolvedValue('') })
      .mockResolvedValueOnce({ ok: true,  status: 200, json: vi.fn().mockResolvedValue(VALID_RESPONSE), text: vi.fn() });
    vi.stubGlobal('fetch', mockFetch);

    const settled = await runWithTimers(() => callPMGraphEvaluate(VALID_PAYLOAD));
    expect(settled.status).toBe('fulfilled');
    expect((settled as PromiseFulfilledResult<typeof VALID_RESPONSE>).value.score).toBe(0.82);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws PMGraphUnavailableError after exhausting all retries', async () => {
    vi.stubGlobal('fetch', makeStatusFetch(500));

    const settled = await runWithTimers(() => callPMGraphEvaluate(VALID_PAYLOAD));
    expect(settled.status).toBe('rejected');
    expect((settled as PromiseRejectedResult).reason).toBeInstanceOf(PMGraphUnavailableError);
    // makeStatusFetch returns the same mock for every call — 3 retries total
  });
});

// ── 6. Network failure with retry ────────────────────────────────────────────

describe('network failure retry', () => {
  it('retries on network error and succeeds on a later attempt', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn().mockResolvedValue(VALID_RESPONSE), text: vi.fn() });
    vi.stubGlobal('fetch', mockFetch);

    const settled = await runWithTimers(() => callPMGraphEvaluate(VALID_PAYLOAD));
    expect(settled.status).toBe('fulfilled');
    expect((settled as PromiseFulfilledResult<typeof VALID_RESPONSE>).value.score).toBe(0.82);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws PMGraphUnavailableError after all network retries fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const settled = await runWithTimers(() => callPMGraphEvaluate(VALID_PAYLOAD));
    expect(settled.status).toBe('rejected');
    expect((settled as PromiseRejectedResult).reason).toBeInstanceOf(PMGraphUnavailableError);
  });
});

// ── 7. AbortError (timeout) ───────────────────────────────────────────────────

describe('timeout (AbortError)', () => {
  it('treats AbortError as PMGraphUnavailableError with timeout message', async () => {
    // DOMException(message, name) sets .name via the constructor — do not use Object.assign
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const settled = await runWithTimers(() => callPMGraphEvaluate(VALID_PAYLOAD));
    expect(settled.status).toBe('rejected');
    const err = (settled as PromiseRejectedResult).reason;
    expect(err).toBeInstanceOf(PMGraphUnavailableError);
    expect((err as Error).message).toMatch(/timed out/i);
  });
});

// ── 8. Invalid response shape ─────────────────────────────────────────────────

describe('invalid 2xx response shape', () => {
  it('throws PMGraphUnexpectedResponseError when score is missing', async () => {
    const { score: _s, ...badResponse } = VALID_RESPONSE;
    vi.stubGlobal('fetch', makeOkFetch(badResponse));
    await expect(callPMGraphEvaluate(VALID_PAYLOAD)).rejects.toBeInstanceOf(PMGraphUnexpectedResponseError);
  });

  it('throws PMGraphUnexpectedResponseError when dimension_scores has extra keys', async () => {
    const badResponse = {
      ...VALID_RESPONSE,
      dimension_scores: { ...VALID_RESPONSE.dimension_scores, surprise_key: 0.5 },
    };
    vi.stubGlobal('fetch', makeOkFetch(badResponse));
    await expect(callPMGraphEvaluate(VALID_PAYLOAD)).rejects.toBeInstanceOf(PMGraphUnexpectedResponseError);
  });

  it('throws PMGraphUnexpectedResponseError when provenance is missing', async () => {
    const { provenance: _p, ...badResponse } = VALID_RESPONSE;
    vi.stubGlobal('fetch', makeOkFetch(badResponse));
    await expect(callPMGraphEvaluate(VALID_PAYLOAD)).rejects.toBeInstanceOf(PMGraphUnexpectedResponseError);
  });
});

// ── 9. Non-JSON body ──────────────────────────────────────────────────────────

describe('non-JSON 2xx body', () => {
  it('throws PMGraphUnexpectedResponseError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:     true,
      status: 200,
      json:   vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      text:   vi.fn().mockResolvedValue('not json'),
    }));
    await expect(callPMGraphEvaluate(VALID_PAYLOAD)).rejects.toBeInstanceOf(PMGraphUnexpectedResponseError);
  });
});

// ── 10. requestId forwarded ───────────────────────────────────────────────────

describe('requestId header', () => {
  it('sends X-Request-Id header when requestId is provided', async () => {
    const mockFetch = makeOkFetch(VALID_RESPONSE);
    vi.stubGlobal('fetch', mockFetch);
    await callPMGraphEvaluate(VALID_PAYLOAD, 'heq_test_request_id');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Request-Id']).toBe('heq_test_request_id');
  });

  it('does not send X-Request-Id when requestId is not provided', async () => {
    const mockFetch = makeOkFetch(VALID_RESPONSE);
    vi.stubGlobal('fetch', mockFetch);
    await callPMGraphEvaluate(VALID_PAYLOAD);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Request-Id']).toBeUndefined();
  });
});
