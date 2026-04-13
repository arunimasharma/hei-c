/**
 * usePMGraphEvaluation
 *
 * React hook that manages the full PM Graph evaluation lifecycle for a single
 * Friction Case submission.
 *
 * State machine:
 *
 *   idle ──► evaluating ──► evaluated
 *                  │
 *                  └──► evaluation_failed ──► evaluating  (retry)
 *
 * Usage (in FrictionCaseExercise):
 *
 *   const { evalStatus, evalRecord, evaluate, retry } = usePMGraphEvaluation();
 *
 *   // After InsightStore.submit() returns a submission:
 *   evaluate({ submission, activeCase, rootAnswerIndex, fixAnswerIndex, memberId: null });
 *
 * Guarantees:
 *   - InsightStore submission is always saved before evaluate() is called —
 *     this hook never touches InsightStore.
 *   - evaluate() is non-blocking: the hook updates evalStatus reactively.
 *   - EvaluationStore.save() is called only on a non-degraded adapter response.
 *   - Supabase sync is fire-and-forget; it never blocks the UI.
 *   - Degraded responses (degraded: true) set status → evaluation_failed.
 *   - Network / HTTP errors also set status → evaluation_failed.
 *   - retry() replays the last evaluate() call.
 */

import { useState, useCallback, useRef } from 'react';
import type { InsightSubmission } from '../../lib/InsightStore';
import type { FrictionCase } from '../../data/frictionCases';
import { EvaluationStore, type PMGraphEvaluationRecord } from './EvaluationStore';
import { syncEvaluation } from '../../services/supabaseSync';

// ── State machine ─────────────────────────────────────────────────────────────

export type EvalStatus = 'idle' | 'evaluating' | 'evaluated' | 'evaluation_failed';

// ── Hook inputs ───────────────────────────────────────────────────────────────

export interface EvaluateInput {
  /** The InsightStore submission — created by the caller before evaluate(). */
  submission: InsightSubmission;
  /** The friction case the submission belongs to. */
  activeCase: FrictionCase;
  /** The user's selected root-issue index. */
  rootAnswerIndex: number;
  /** The user's selected fix index. */
  fixAnswerIndex: number;
  /** Optional reflection text the user typed before reveal. */
  reflectionText?: string;
  /**
   * Authenticated user ID if available.
   * Pass null when HEQ does not have a verified user identity at this point.
   */
  memberId: string | null;
}

// ── Evaluation result ─────────────────────────────────────────────────────────

export type EvaluationOutcome =
  | { ok: true;  record: PMGraphEvaluationRecord }
  | { ok: false; reason: 'network_error' | 'http_error' | 'degraded' | 'store_error' };

// ── Session ID (stable per browser session — matches /api/claude pattern) ─────

export function getSessionId(): string {
  const STORAGE_KEY = 'heq_session_id';
  let id = sessionStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

// ── Theme → surface (duplicated from mapper to keep hook self-contained) ──────

const THEME_TO_SURFACE: Record<string, string> = {
  pricing:    'pricing_page',
  ux:         'product_ux',
  onboarding: 'onboarding_flow',
  value:      'value_proposition',
  trust:      'trust_and_safety',
};

// ── Core evaluation function (exported for testing) ───────────────────────────

/**
 * Runs the full evaluation pipeline for a Friction Case submission:
 *   1. POSTs to /api/pm-graph/evaluate-friction-case
 *   2. On success, saves to EvaluationStore
 *   3. Fire-and-forget Supabase sync
 *
 * Returns an EvaluationOutcome — never throws.
 *
 * Exported separately from the hook so tests can call it in a Node environment
 * without a React renderer (same pattern as api/_evaluatorCore.ts).
 *
 * Dependencies are injected for testability:
 *   - `fetchFn`        — defaults to global fetch; override in tests
 *   - `saveFn`         — defaults to EvaluationStore.save; override in tests
 *   - `syncFn`         — defaults to syncEvaluation; override in tests
 *   - `sessionIdFn`    — defaults to getSessionId; override in tests
 */
export async function runFrictionCaseEvaluation(
  input: EvaluateInput,
  deps: {
    fetchFn?:       typeof fetch;
    saveFn?:        typeof EvaluationStore.save;
    syncFn?:        typeof syncEvaluation;
    markSyncedFn?:  typeof EvaluationStore.markSynced;
    markErrorFn?:   typeof EvaluationStore.markSyncError;
    sessionIdFn?:   () => string;
  } = {},
): Promise<EvaluationOutcome> {
  const {
    fetchFn       = fetch,
    saveFn        = EvaluationStore.save.bind(EvaluationStore),
    syncFn        = syncEvaluation,
    markSyncedFn  = EvaluationStore.markSynced.bind(EvaluationStore),
    markErrorFn   = EvaluationStore.markSyncError.bind(EvaluationStore),
    sessionIdFn   = getSessionId,
  } = deps;

  const { submission, activeCase, rootAnswerIndex, fixAnswerIndex, reflectionText, memberId } = input;

  const payload = {
    caseId:           activeCase.id,
    submissionId:     submission.id,
    theme:            activeCase.theme,
    context:          activeCase.context,
    narrative:        activeCase.narrative,
    rawResponse:      activeCase.rawResponse,
    rootIssueOptions: activeCase.rootIssueOptions,
    rootAnswerIndex,
    fixOptions:       activeCase.fixOptions,
    fixAnswerIndex,
    reflectionText:   reflectionText?.trim() || undefined,
  };

  // ── 1. POST to adapter ────────────────────────────────────────────────────
  let raw: Record<string, unknown>;
  try {
    const res = await fetchFn('/api/pm-graph/evaluate-friction-case', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionIdFn(),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { ok: false, reason: 'http_error' };
    }

    raw = await res.json() as Record<string, unknown>;
  } catch {
    return { ok: false, reason: 'network_error' };
  }

  // ── 2. Check for degraded response ────────────────────────────────────────
  if (raw.degraded === true) {
    return { ok: false, reason: 'degraded' };
  }

  // ── 3. Save to EvaluationStore ────────────────────────────────────────────
  let record: PMGraphEvaluationRecord;
  try {
    record = await saveFn({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      evaluation:             raw as any,
      hello_eq_exercise_id:   activeCase.id,
      hello_eq_submission_id: submission.id,
      benchmark_surface:      THEME_TO_SURFACE[activeCase.theme] ?? activeCase.theme,
      member_id:              memberId,
    });
  } catch {
    return { ok: false, reason: 'store_error' };
  }

  // ── 4. Fire-and-forget sync ───────────────────────────────────────────────
  syncFn(record)
    .then(() => markSyncedFn(record.id))
    .catch(() => markErrorFn(record.id));

  return { ok: true, record };
}

// ── React hook ────────────────────────────────────────────────────────────────

export interface UsePMGraphEvaluationResult {
  evalStatus: EvalStatus;
  /** Set only when status is 'evaluated'. Null otherwise. */
  evalRecord: PMGraphEvaluationRecord | null;
  /**
   * Starts a PM Graph evaluation for the given submission.
   * Safe to call multiple times — each call replaces the prior result.
   */
  evaluate: (input: EvaluateInput) => void;
  /**
   * Retries the most recent failed evaluation.
   * No-op when evalStatus !== 'evaluation_failed'.
   */
  retry: () => void;
  /** Resets the hook back to idle (e.g. when selecting a new case). */
  reset: () => void;
}

export function usePMGraphEvaluation(): UsePMGraphEvaluationResult {
  const [evalStatus, setEvalStatus] = useState<EvalStatus>('idle');
  const [evalRecord, setEvalRecord] = useState<PMGraphEvaluationRecord | null>(null);

  // Store the last input so retry() can replay without re-passing args.
  const lastInputRef = useRef<EvaluateInput | null>(null);

  const run = useCallback(async (input: EvaluateInput) => {
    setEvalStatus('evaluating');
    setEvalRecord(null);

    const outcome = await runFrictionCaseEvaluation(input);

    if (outcome.ok) {
      setEvalRecord(outcome.record);
      setEvalStatus('evaluated');
    } else {
      setEvalStatus('evaluation_failed');
    }
  }, []);

  const evaluate = useCallback((input: EvaluateInput) => {
    lastInputRef.current = input;
    void run(input);
  }, [run]);

  const retry = useCallback(() => {
    if (lastInputRef.current) {
      void run(lastInputRef.current);
    }
  }, [run]);

  const reset = useCallback(() => {
    lastInputRef.current = null;
    setEvalStatus('idle');
    setEvalRecord(null);
  }, []);

  return { evalStatus, evalRecord, evaluate, retry, reset };
}
