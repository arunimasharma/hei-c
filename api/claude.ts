/**
 * Vercel Serverless Proxy — /api/claude
 *
 * Responsibilities:
 *  1. Inject the Anthropic API key server-side (never exposed to the client).
 *  2. Log per-request usage (input tokens, output tokens, estimated cost).
 *  3. Enforce a per-session soft rate limit via the X-Session-Id header.
 *  4. Forward the request to the Anthropic Messages API.
 *
 * Cost model (claude-sonnet-4-20250514 as of 2025):
 *   Input:  $3.00 per 1M tokens  |  Output: $15.00 per 1M tokens
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const COST_PER_INPUT_TOKEN  = 3.00  / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 15.00 / 1_000_000;

// In-memory rate limiter (per cold-start window)
const sessionHits = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS  = 60_000;
const RATE_LIMIT_HITS = 30;

function isRateLimited(sessionId: string): boolean {
  const now = Date.now();
  const entry = sessionHits.get(sessionId);
  if (!entry || now > entry.resetAt) {
    sessionHits.set(sessionId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_HITS;
}

interface UsageRecord {
  timestamp: string;
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
}

function logUsage(record: UsageRecord): void {
  console.log(JSON.stringify({ event: 'claude_usage', ...record }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const sessionId = (req.headers['x-session-id'] as string | undefined) ?? 'anonymous';
  if (isRateLimited(sessionId)) {
    res.status(429).json({ error: 'Rate limit exceeded. Please wait before retrying.' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfiguration: API key not set.' });
    return;
  }

  const startMs = Date.now();

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const responseBody = await upstream.json() as {
      usage?: { input_tokens: number; output_tokens: number };
      model?: string;
    };

    const durationMs      = Date.now() - startMs;
    const inputTokens     = responseBody.usage?.input_tokens  ?? 0;
    const outputTokens    = responseBody.usage?.output_tokens ?? 0;
    const estimatedCostUsd =
      inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;

    logUsage({
      timestamp: new Date().toISOString(),
      sessionId,
      model: responseBody.model ?? 'unknown',
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      durationMs,
    });

    res.status(upstream.status);
    res.setHeader('X-HEQ-Input-Tokens',  String(inputTokens));
    res.setHeader('X-HEQ-Output-Tokens', String(outputTokens));
    res.setHeader('X-HEQ-Cost-USD',      estimatedCostUsd.toFixed(6));
    res.setHeader('X-HEQ-Duration-Ms',   String(durationMs));
    res.json(responseBody);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown upstream error';
    console.error('[HEQ] Proxy error:', message);
    res.status(502).json({ error: `Upstream error: ${message}` });
  }
}
