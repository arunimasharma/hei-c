import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ZodType } from 'zod';

// ── Shared server helpers for Drilloop backend endpoints ──
// Service-role Supabase (bypasses RLS), bearer-token auth, and a Claude call
// that validates structured output with zod and does one repair-retry before
// failing loudly. Mirrors the conventions in api/claude.ts and api/usage-increment.ts.

const MODEL = 'claude-sonnet-4-20250514';
const COST_PER_INPUT_TOKEN = 3.0 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 15.0 / 1_000_000;

export function service(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Resolve the authenticated user from the Authorization: Bearer header. */
export async function requireUser(req: VercelRequest, sb: SupabaseClient) {
  const authHeader = req.headers.authorization as string | undefined;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const { data: { user } } = await sb.auth.getUser(authHeader.replace('Bearer ', ''));
  return user ?? null;
}

const ADMIN_EMAILS = (process.env.VITE_ALLOWED_ADMIN_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));
}

/** Standard guard: POST + service configured + authed user. Returns user or null (after responding). */
export async function guardPost(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return null; }
  const sb = service();
  if (!sb) { res.status(503).json({ error: 'Service not configured.' }); return null; }
  const user = await requireUser(req, sb);
  if (!user) { res.status(401).json({ error: 'Authentication required.' }); return null; }
  return { sb, user };
}

export interface ClaudeUsage { inputTokens: number; outputTokens: number; costUsd: number }

function emptyUsage(): ClaudeUsage { return { inputTokens: 0, outputTokens: 0, costUsd: 0 }; }
function addUsage(a: ClaudeUsage, b: ClaudeUsage): ClaudeUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costUsd: a.costUsd + b.costUsd,
  };
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

async function callOnce(system: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>, maxTokens: number) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });
  if (!upstream.ok) {
    const body = await upstream.text().catch(() => '');
    throw new Error(`Anthropic ${upstream.status}: ${body.slice(0, 300)}`);
  }
  const json = (await upstream.json()) as AnthropicResponse;
  const text = json.content?.find(b => b.type === 'text')?.text ?? '';
  const inputTokens = json.usage?.input_tokens ?? 0;
  const outputTokens = json.usage?.output_tokens ?? 0;
  const usage: ClaudeUsage = {
    inputTokens, outputTokens,
    costUsd: inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN,
  };
  return { text, usage };
}

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON object in response');
  return text.slice(start, end + 1);
}

export class ClaudeJsonError extends Error {}

/**
 * Call Claude and validate the JSON result against a zod schema. On a parse or
 * validation failure, retry ONCE with a repair instruction; if it still fails,
 * throw. Never returns unvalidated model output.
 */
export async function callClaudeJson<T>(opts: {
  system: string;
  user: string;
  schema: ZodType<T>;
  maxTokens?: number;
}): Promise<{ value: T; usage: ClaudeUsage }> {
  const maxTokens = opts.maxTokens ?? 1024;
  let usage = emptyUsage();
  let lastErr = '';

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [{ role: 'user', content: opts.user }];
    if (attempt > 0) {
      messages.push({ role: 'assistant', content: '{' });
      messages[0].content += `\n\nYour previous reply could not be parsed (${lastErr}). Return ONLY valid minified JSON matching the required shape.`;
    }
    const { text, usage: u } = await callOnce(opts.system, messages, maxTokens);
    usage = addUsage(usage, u);
    try {
      const parsed = opts.schema.parse(JSON.parse(extractJson(attempt > 0 ? '{' + text : text)));
      return { value: parsed, usage };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'parse error';
    }
  }
  throw new ClaudeJsonError(`Validation failed after retry: ${lastErr}`);
}

export { addUsage, emptyUsage };
