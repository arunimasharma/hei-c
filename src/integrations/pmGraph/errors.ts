/**
 * Typed errors for the PM Graph adapter layer.
 *
 * These are thrown by client.ts and caught in the API route to map onto
 * the appropriate degraded-response reason codes.
 */

/**
 * PM Graph is unreachable — network failure, all retries exhausted, or the
 * service returned a 5xx after retries. Treat as transient; safe to degrade.
 */
export class PMGraphUnavailableError extends Error {
  readonly code = 'PM_GRAPH_UNAVAILABLE' as const;
  constructor(message = 'PM Graph service is unavailable') {
    super(message);
    this.name = 'PMGraphUnavailableError';
  }
}

/**
 * PM Graph rejected the service token — 401 or 403. Indicates a
 * configuration problem (wrong or expired PM_GRAPH_SERVICE_TOKEN).
 * Do NOT retry; alert ops.
 */
export class PMGraphAuthError extends Error {
  readonly code = 'PM_GRAPH_AUTH_ERROR' as const;
  constructor(message = 'PM Graph rejected the service token') {
    super(message);
    this.name = 'PMGraphAuthError';
  }
}

/**
 * PM Graph returned 4xx (other than auth) — the request payload was
 * structurally invalid. Indicates a mapper bug or schema drift.
 * Do NOT retry; needs a code fix.
 */
export class PMGraphValidationError extends Error {
  readonly code = 'PM_GRAPH_VALIDATION_ERROR' as const;
  constructor(message: string) {
    super(message);
    this.name = 'PMGraphValidationError';
  }
}

/**
 * PM Graph returned 2xx but the response body did not match
 * PMGraphEvaluateResponseSchema. Indicates schema drift on the PM Graph side.
 * Do NOT retry; log and degrade.
 */
export class PMGraphUnexpectedResponseError extends Error {
  readonly code = 'PM_GRAPH_UNEXPECTED_RESPONSE' as const;
  constructor(message: string) {
    super(message);
    this.name = 'PMGraphUnexpectedResponseError';
  }
}
