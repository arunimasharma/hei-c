/**
 * Vercel Serverless Function — /api/evaluate-taste
 *
 * Product Taste Evaluator V1
 *
 * Uses ANTHROPIC_EVALUATOR_API_KEY — a DEDICATED key separate from the shared
 * ANTHROPIC_API_KEY used by all other AI features (/api/claude).
 * Do NOT swap or share these keys.
 *
 * POST /api/evaluate-taste
 * Body: { productName, productContext?, answers: { q1, q2, q3, q4, q5, q6 } }
 * Returns: TasteEvaluatorResult JSON (see src/types/index.ts)
 *
 * Rollback: if ANTHROPIC_EVALUATOR_API_KEY is unset, returns 503.
 * The client falls back to the legacy /api/claude basic analysis.
 *
 * Dev note: core logic lives in api/_evaluatorCore.ts which is also imported
 * by vite.config.ts to power the local dev middleware (npm run dev).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  EVALUATOR_MODEL,
  EVALUATOR_MAX_TOKENS,
  EVALUATOR_SYSTEM_PROMPT,
  buildEvaluatorMessage,
  parseEvaluatorResponse,
} from './_evaluatorCore.js';

// ── Request type ──────────────────────────────────────────────────────────────

interface EvaluateRequestBody {
  productName?: unknown;
  productContext?: unknown;
  answers?: unknown;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // ── Evaluator key — isolated from ANTHROPIC_API_KEY used elsewhere ──────────
  const evaluatorKey = process.env.ANTHROPIC_EVALUATOR_API_KEY;
  if (!evaluatorKey) {
    console.error('[HEQ] evaluate-taste: ANTHROPIC_EVALUATOR_API_KEY is not set');
    res.status(503).json({ error: 'Evaluator feature not configured.' });
    return;
  }

  // ── Input validation ────────────────────────────────────────────────────────
  const body = (req.body ?? {}) as EvaluateRequestBody;

  const productName = typeof body.productName === 'string' ? body.productName.trim() : '';
  if (!productName) {
    res.status(400).json({ error: 'productName is required.' });
    return;
  }
  if (productName.length > 200) {
    res.status(400).json({ error: 'productName must be 200 characters or fewer.' });
    return;
  }

  const productContext = typeof body.productContext === 'string'
    ? body.productContext.trim().slice(0, 500)
    : '';

  const rawAnswers = (body.answers && typeof body.answers === 'object')
    ? body.answers as Record<string, unknown>
    : {};

  const answers = {
    q1: String(rawAnswers.q1 ?? '').trim().slice(0, 2000),
    q2: String(rawAnswers.q2 ?? '').trim().slice(0, 2000),
    q3: String(rawAnswers.q3 ?? '').trim().slice(0, 2000),
    q4: String(rawAnswers.q4 ?? '').trim().slice(0, 2000),
    q5: String(rawAnswers.q5 ?? '').trim().slice(0, 2000),
    q6: String(rawAnswers.q6 ?? '').trim().slice(0, 2000),
  };

  const hasAnyAnswer = Object.values(answers).some(a => a.length > 0);
  if (!hasAnyAnswer) {
    res.status(400).json({ error: 'At least one answer is required.' });
    return;
  }

  // ── Call Anthropic with the evaluator key ───────────────────────────────────
  const userMessage = buildEvaluatorMessage(productName, productContext, answers);
  const startMs = Date.now();

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         evaluatorKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      EVALUATOR_MODEL,
        max_tokens: EVALUATOR_MAX_TOKENS,
        temperature: 0,
        system:     EVALUATOR_SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error('[HEQ] evaluate-taste: Anthropic API error', upstream.status, errText.slice(0, 200));
      res.status(502).json({ error: 'Evaluator upstream error. Please try again.' });
      return;
    }

    const responseBody = await upstream.json() as {
      content?: Array<{ type: string; text: string }>;
      usage?:   { input_tokens: number; output_tokens: number };
    };

    const durationMs   = Date.now() - startMs;
    const inputTokens  = responseBody.usage?.input_tokens  ?? 0;
    const outputTokens = responseBody.usage?.output_tokens ?? 0;
    const rawText      = responseBody.content?.[0]?.text   ?? '';

    console.log(JSON.stringify({
      event:             'evaluator_usage',
      timestamp:         new Date().toISOString(),
      model:             EVALUATOR_MODEL,
      inputTokens,
      outputTokens,
      durationMs,
      productNameLength: productName.length,
      answeredCount:     Object.values(answers).filter(a => a.length > 0).length,
    }));

    let result: ReturnType<typeof parseEvaluatorResponse>;
    try {
      result = parseEvaluatorResponse(rawText);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : 'Parse failed';
      console.error('[HEQ] evaluate-taste: JSON parse error —', msg, '— raw snippet:', rawText.slice(0, 100));
      res.status(422).json({ error: 'Evaluator returned an unexpected response. Please try again.' });
      return;
    }

    res.status(200).json(result);

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[HEQ] evaluate-taste: Network/fetch error —', message);
    res.status(502).json({ error: 'Evaluator network error. Please try again.' });
  }
}
