/**
 * Client service for /api/evaluate-taste — Product Taste Evaluator V1.
 *
 * This calls the dedicated evaluator endpoint which uses ANTHROPIC_EVALUATOR_API_KEY
 * server-side. The key never touches the client.
 *
 * If the endpoint returns 503 (key not configured), throw EvaluatorNotConfiguredError
 * so the caller can fall back to the legacy basic analysis path.
 */

import type { TasteEvaluatorResult } from '../types';

export interface EvaluateTastePayload {
  productName: string;
  productContext?: string;
  answers: {
    q1: string;
    q2: string;
    q3: string;
    q4: string;
    q5: string;
    q6: string;
  };
}

export class EvaluatorApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'EvaluatorApiError';
    this.statusCode = statusCode;
  }
}

/** Thrown specifically when the evaluator key is not configured (HTTP 503). */
export class EvaluatorNotConfiguredError extends EvaluatorApiError {
  constructor() {
    super('Evaluator feature not configured.', 503);
    this.name = 'EvaluatorNotConfiguredError';
  }
}

export async function callEvaluateTaste(
  payload: EvaluateTastePayload,
): Promise<TasteEvaluatorResult> {
  const response = await fetch('/api/evaluate-taste', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 503) {
      throw new EvaluatorNotConfiguredError();
    }

    let errorMessage = 'Evaluation failed. Please try again.';
    try {
      const errorBody = await response.json() as { error?: string };
      if (errorBody.error) errorMessage = errorBody.error;
    } catch {
      // ignore JSON parse error on error body
    }
    throw new EvaluatorApiError(errorMessage, response.status);
  }

  const result = await response.json() as TasteEvaluatorResult;
  return result;
}
