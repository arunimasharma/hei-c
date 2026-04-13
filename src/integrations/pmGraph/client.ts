/**
 * Server-side PM Graph client.
 *
 * Responsibilities:
 *  - reads PM_GRAPH_BASE_URL and PM_GRAPH_SERVICE_TOKEN from env
 *  - POSTs to the PM Graph /evaluate endpoint with Bearer auth
 *  - enforces a per-request timeout via AbortController
 *  - validates the response shape via PMGraphEvaluateResponseSchema before returning
 *  - retries on transient 5xx / network / timeout failures (up to MAX_RETRIES attempts)
 *  - does NOT retry on 4xx (auth or validation failures)
 *
 * This module is intended for server-side use only (Vercel functions, Node).
 * Never import it in browser code.
 *
 * Secrets policy:
 *  PM_GRAPH_SERVICE_TOKEN is read here and sent in the Authorization header.
 *  It is NEVER logged — not the full value, not a prefix, not its length.
 */

import { PMGraphEvaluateResponseSchema, type PMGraphEvaluateResponse } from './schema.js';
import {
  PMGraphAuthError,
  PMGraphUnavailableError,
  PMGraphUnexpectedResponseError,
  PMGraphValidationError,
} from './errors.js';

// ── Config ─────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
/** Base delay in ms — multiplied by attempt number (300 → 600 → 900). */
const RETRY_BASE_MS = 300;
/** Per-attempt hard timeout in ms. Aborts and retries if exceeded. */
export const REQUEST_TIMEOUT_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True for HTTP status codes worth retrying. */
function isRetryableStatus(status: number): boolean {
  return status >= 500;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Calls the PM Graph /evaluate endpoint and returns the validated response.
 *
 * @param payload   - Full request body to POST (mapper output).
 * @param requestId - Optional correlation ID forwarded as X-Request-Id to PM Graph.
 *
 * @throws {PMGraphUnavailableError}        on network failure, timeout, or 5xx after all retries.
 * @throws {PMGraphAuthError}               on 401 / 403 — misconfigured service token.
 * @throws {PMGraphValidationError}         on 4xx (other than auth) — bad request payload.
 * @throws {PMGraphUnexpectedResponseError} on 2xx but schema validation failure.
 */
export async function callPMGraphEvaluate(
  payload: Record<string, unknown>,
  requestId?: string,
): Promise<PMGraphEvaluateResponse> {
  const baseUrl = process.env.PM_GRAPH_BASE_URL;
  const token   = process.env.PM_GRAPH_SERVICE_TOKEN;

  if (!baseUrl || !token) {
    throw new PMGraphUnavailableError(
      'PM_GRAPH_BASE_URL or PM_GRAPH_SERVICE_TOKEN is not configured',
    );
  }

  const url = `${baseUrl.replace(/\/$/, '')}/evaluate`;

  const upstreamHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  if (requestId) {
    upstreamHeaders['X-Request-Id'] = requestId;
  }

  let lastError: Error = new PMGraphUnavailableError('PM Graph unreachable');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;

    // ── Network / timeout call ────────────────────────────────────────────────
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: upstreamHeaders,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (networkErr) {
      const isTimeout =
        networkErr instanceof Error && networkErr.name === 'AbortError';
      const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
      lastError = new PMGraphUnavailableError(
        isTimeout
          ? `PM Graph request timed out after ${REQUEST_TIMEOUT_MS}ms`
          : `PM Graph network error: ${msg}`,
      );
      if (attempt < MAX_RETRIES) await sleep(RETRY_BASE_MS * attempt);
      continue;
    } finally {
      clearTimeout(timeoutHandle);
    }

    // ── Auth failures — no retry ──────────────────────────────────────────────
    if (response.status === 401 || response.status === 403) {
      throw new PMGraphAuthError(
        `PM Graph rejected the service token (HTTP ${response.status})`,
      );
    }

    // ── Other 4xx — no retry ──────────────────────────────────────────────────
    if (response.status >= 400 && response.status < 500) {
      const body = await response.text().catch(() => '');
      throw new PMGraphValidationError(
        `PM Graph rejected the request (HTTP ${response.status}): ${body.slice(0, 300)}`,
      );
    }

    // ── 5xx — retryable ───────────────────────────────────────────────────────
    if (isRetryableStatus(response.status)) {
      lastError = new PMGraphUnavailableError(`PM Graph returned HTTP ${response.status}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_BASE_MS * attempt);
      continue;
    }

    // ── 2xx — parse and validate ──────────────────────────────────────────────
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new PMGraphUnexpectedResponseError('PM Graph returned a non-JSON body');
    }

    const parsed = PMGraphEvaluateResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new PMGraphUnexpectedResponseError(
        `PM Graph response failed schema validation: ${parsed.error.message}`,
      );
    }

    return parsed.data;
  }

  throw lastError;
}
