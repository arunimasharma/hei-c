/**
 * Vercel Serverless Function — /api/pm-graph/evaluate-friction-case
 *
 * Server-side adapter: wraps PM Graph evaluation for Hello-EQ Friction Case
 * submissions. Hello-EQ never calls PM Graph directly from the browser;
 * all PM Graph traffic routes through this endpoint.
 *
 * POST /api/pm-graph/evaluate-friction-case
 * Headers:  X-Session-Id: <session-id>   (required — ties request to a frontend session)
 *           X-Request-Id: <id>           (optional — propagated upstream; generated if absent)
 * Body:     HEQFrictionCaseSubmission JSON
 * Returns:  SuccessResponse JSON  (HTTP 200, includes request_id)
 *           DegradedResponse JSON (HTTP 200, degraded: true, includes request_id)
 *           { error: string }     (HTTP 400/405 for bad input)
 *
 * Auth approach:
 *   Matches the project-wide pattern from /api/claude:
 *   - X-Session-Id header required (soft session identity; enables future rate-limiting).
 *   - PM_GRAPH_SERVICE_TOKEN is never exposed to the browser; sent server-to-server only.
 *
 * Secrets policy:
 *   PM_GRAPH_SERVICE_TOKEN is NEVER logged — not the value, not a prefix, not its length.
 *   session_id is logged as a soft identifier (not a secret in this project's model).
 *
 * Requires env vars:
 *   PM_GRAPH_BASE_URL        — base URL of the PM Graph service (no trailing slash)
 *   PM_GRAPH_SERVICE_TOKEN   — service-to-service bearer token for PM Graph
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callPMGraphEvaluate } from '../../src/integrations/pmGraph/client.js';
import {
  mapFrictionCaseToPMGraphRequest,
  type HEQFrictionCaseSubmission,
} from '../../src/integrations/pmGraph/mapper.js';
import {
  PMGraphAuthError,
  PMGraphUnavailableError,
  PMGraphUnexpectedResponseError,
  PMGraphValidationError,
} from '../../src/integrations/pmGraph/errors.js';
import type { PMGraphEvaluateResponse } from '../../src/integrations/pmGraph/schema.js';

// ── Request ID ────────────────────────────────────────────────────────────────

function generateRequestId(): string {
  return `heq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Response shapes ───────────────────────────────────────────────────────────

type DegradedReason =
  | 'pm_graph_unavailable'
  | 'pm_graph_auth_error'
  | 'pm_graph_unexpected_response'
  | 'pm_graph_validation_error';

interface DegradedResponse {
  degraded: true;
  reason: DegradedReason;
  score: null;
  dimension_scores: null;
  provenance: null;
  reasoning: null;
  request_id: string;
}

type SuccessResponse = PMGraphEvaluateResponse & { request_id: string };

function makeDegraded(reason: DegradedReason, requestId: string): DegradedResponse {
  return {
    degraded:         true,
    reason,
    score:            null,
    dimension_scores: null,
    provenance:       null,
    reasoning:        null,
    request_id:       requestId,
  };
}

// ── Inbound body type ─────────────────────────────────────────────────────────

interface RawBody {
  caseId?: unknown;
  submissionId?: unknown;
  theme?: unknown;
  context?: unknown;
  narrative?: unknown;
  rawResponse?: unknown;
  rootIssueOptions?: unknown;
  rootAnswerIndex?: unknown;
  fixOptions?: unknown;
  fixAnswerIndex?: unknown;
  reflectionText?: unknown;
  productName?: unknown;
  productContext?: unknown;
}

// ── Structured log helpers ────────────────────────────────────────────────────

function logEvent(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...fields }));
}

function logError(fields: Record<string, unknown>): void {
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), ...fields }));
}

const VALID_THEMES = ['pricing', 'ux', 'onboarding', 'value', 'trust'] as const;
type FrictionTheme = typeof VALID_THEMES[number];

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {

  // ── Method guard ──────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // ── Request ID — propagate from caller or generate ────────────────────────
  const incomingId = req.headers['x-request-id'];
  const requestId  = (typeof incomingId === 'string' && incomingId.trim())
    ? incomingId.trim()
    : generateRequestId();

  // ── Session auth ──────────────────────────────────────────────────────────
  const sessionId = req.headers['x-session-id'];
  if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
    res.status(400).json({ error: 'X-Session-Id header is required.' });
    return;
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const body = (req.body ?? {}) as RawBody;

  const caseId = typeof body.caseId === 'string' ? body.caseId.trim() : '';
  if (!caseId) {
    res.status(400).json({ error: 'caseId is required.' });
    return;
  }

  if (!VALID_THEMES.includes(body.theme as FrictionTheme)) {
    res.status(400).json({ error: `theme must be one of: ${VALID_THEMES.join(', ')}.` });
    return;
  }
  const theme = body.theme as FrictionTheme;

  const context     = typeof body.context     === 'string' ? body.context.trim()     : '';
  const narrative   = typeof body.narrative   === 'string' ? body.narrative.trim()   : '';
  const rawResponse = typeof body.rawResponse === 'string' ? body.rawResponse.trim() : '';

  if (!context || !narrative || !rawResponse) {
    res.status(400).json({ error: 'context, narrative, and rawResponse are required.' });
    return;
  }

  const rootIssueOptions =
    Array.isArray(body.rootIssueOptions) &&
    body.rootIssueOptions.every((o) => typeof o === 'string')
      ? (body.rootIssueOptions as string[])
      : null;
  if (!rootIssueOptions || rootIssueOptions.length === 0) {
    res.status(400).json({ error: 'rootIssueOptions must be a non-empty string array.' });
    return;
  }

  const rootAnswerIndex =
    typeof body.rootAnswerIndex === 'number' ? Math.floor(body.rootAnswerIndex) : -1;
  if (rootAnswerIndex < 0 || rootAnswerIndex >= rootIssueOptions.length) {
    res.status(400).json({ error: 'rootAnswerIndex is out of bounds.' });
    return;
  }

  const fixOptions =
    Array.isArray(body.fixOptions) &&
    body.fixOptions.every((o) => typeof o === 'string')
      ? (body.fixOptions as string[])
      : null;
  if (!fixOptions || fixOptions.length === 0) {
    res.status(400).json({ error: 'fixOptions must be a non-empty string array.' });
    return;
  }

  const fixAnswerIndex =
    typeof body.fixAnswerIndex === 'number' ? Math.floor(body.fixAnswerIndex) : -1;
  if (fixAnswerIndex < 0 || fixAnswerIndex >= fixOptions.length) {
    res.status(400).json({ error: 'fixAnswerIndex is out of bounds.' });
    return;
  }

  const submission: HEQFrictionCaseSubmission = {
    caseId,
    submissionId:   typeof body.submissionId === 'string' ? body.submissionId.trim() : undefined,
    theme,
    context:        context.slice(0, 1000),
    narrative:      narrative.slice(0, 2000),
    rawResponse:    rawResponse.slice(0, 500),
    rootIssueOptions,
    rootAnswerIndex,
    fixOptions,
    fixAnswerIndex,
    reflectionText: typeof body.reflectionText === 'string'
      ? body.reflectionText.trim().slice(0, 3000)
      : undefined,
    productName:    typeof body.productName === 'string'
      ? body.productName.trim().slice(0, 200)
      : undefined,
    productContext: typeof body.productContext === 'string'
      ? body.productContext.trim().slice(0, 500)
      : undefined,
  };

  // ── Map to PM Graph request ───────────────────────────────────────────────
  const pmGraphRequest = mapFrictionCaseToPMGraphRequest(submission);

  // ── Call PM Graph ─────────────────────────────────────────────────────────
  const startMs = Date.now();

  logEvent({
    event:      'pm_graph_request_start',
    request_id: requestId,
    case_id:    caseId,
    theme,
    session_id: sessionId,
  });

  let result: SuccessResponse | DegradedResponse;

  try {
    const evaluation = await callPMGraphEvaluate(
      pmGraphRequest as Record<string, unknown>,
      requestId,
    );

    const latencyMs = Date.now() - startMs;

    logEvent({
      event:      'pm_graph_request_success',
      request_id: requestId,
      case_id:    caseId,
      score:      evaluation.score,
      latency_ms: latencyMs,
    });

    result = { ...evaluation, request_id: requestId };

  } catch (err) {
    const latencyMs = Date.now() - startMs;

    const isKnown =
      err instanceof PMGraphUnavailableError ||
      err instanceof PMGraphAuthError ||
      err instanceof PMGraphValidationError ||
      err instanceof PMGraphUnexpectedResponseError;

    const reason: DegradedReason = !isKnown
      ? 'pm_graph_unavailable'
      : err instanceof PMGraphUnavailableError
        ? 'pm_graph_unavailable'
        : err instanceof PMGraphAuthError
          ? 'pm_graph_auth_error'
          : err instanceof PMGraphValidationError
            ? 'pm_graph_validation_error'
            : 'pm_graph_unexpected_response';

    // err.message may include HTTP status codes but never the service token
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    logError({
      event:      'pm_graph_request_failure',
      request_id: requestId,
      case_id:    caseId,
      reason,
      error:      errorMessage,
      latency_ms: latencyMs,
    });

    result = makeDegraded(reason, requestId);
  }

  res.status(200).json(result);
}
