/**
 * Vercel Serverless Function — /api/validator
 *
 * Single endpoint for the Idea Validator feature. Discriminated by `op`:
 *   { op: 'chat',     sessionId, mode, messages }
 *   { op: 'generate', sessionId }
 *
 * Auth: requires `Authorization: Bearer <supabase access token>`. The token
 * is verified against Supabase; subsequent DB writes use a Supabase client
 * initialised with the same JWT so existing RLS policies enforce ownership.
 *
 * Persistence: writes user/assistant turns to `validator_messages` and the
 * generated doc to `validator_sessions.generated_doc`. Session list/get/delete
 * is performed client-side via supabase (also RLS-protected); see
 * src/services/validatorClient.ts.
 *
 * Per-user rate limits (in-memory, per cold-start window):
 *   - 30 chat turns per session (enforced via stored message count)
 *   - 10 generations per user per 24h
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildChatSystemPrompt,
  buildGenerationPrompt,
  evaluateReadiness,
  stripAreasTag,
  deriveSessionTitle,
} from '../src/services/validatorPrompts.js';
import type {
  ValidatorMode,
  ValidatorRole,
} from '../src/types/validator.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const CHAT_MODEL          = 'claude-sonnet-4-20250514';
const CHAT_MAX_TOKENS     = 800;
const GENERATE_MAX_TOKENS = 4096;
const MAX_MESSAGES_PER_SESSION = 30;
const MAX_GENERATIONS_PER_DAY  = 10;

// ── Generation rate limiter (per cold-start) ──────────────────────────────────

const genHits = new Map<string, { count: number; resetAt: number }>();
const GEN_WINDOW_MS = 24 * 60 * 60 * 1000;

function isGenerationLimited(userId: string): boolean {
  const now = Date.now();
  const entry = genHits.get(userId);
  if (!entry || now > entry.resetAt) {
    genHits.set(userId, { count: 1, resetAt: now + GEN_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_GENERATIONS_PER_DAY;
}

// ── Env helpers ───────────────────────────────────────────────────────────────

function readSupabaseEnv(): { url: string; anonKey: string } | null {
  const url     = process.env.SUPABASE_URL     ?? process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

function clientForUser(jwt: string): SupabaseClient | null {
  const env = readSupabaseEnv();
  if (!env) return null;
  return createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
}

// ── Anthropic call ────────────────────────────────────────────────────────────

interface AnthropicTextBlock { type: 'text'; text: string; }
interface AnthropicResponse  { content: AnthropicTextBlock[]; }

async function callAnthropic(
  apiKey: string,
  system: string,
  messages: Array<{ role: ValidatorRole; content: string }>,
  maxTokens: number,
): Promise<string> {
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      CHAT_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    throw new Error(`Anthropic ${upstream.status}: ${text || 'request failed'}`);
  }

  const body = await upstream.json() as AnthropicResponse;
  const text = body.content?.find(b => b.type === 'text')?.text;
  if (!text) throw new Error('Anthropic returned no text content');
  return text;
}

// ── Body shapes (untrusted input) ─────────────────────────────────────────────

interface RawBody {
  op?: unknown;
  sessionId?: unknown;
  mode?: unknown;
  messages?: unknown;
  generateAnyway?: unknown;
}

function isMode(v: unknown): v is ValidatorMode {
  return v === 'quick_prototype' || v === 'strategic_bet';
}

function isMessageArray(v: unknown): v is Array<{ role: ValidatorRole; content: string }> {
  return Array.isArray(v) && v.every(m =>
    m && typeof m === 'object'
    && (((m as { role: unknown }).role === 'user') || ((m as { role: unknown }).role === 'assistant'))
    && typeof (m as { content: unknown }).content === 'string',
  );
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // ── Auth ──
  const authHeader = req.headers.authorization;
  const jwt = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';
  if (!jwt) {
    res.status(401).json({ error: 'Missing bearer token.' });
    return;
  }

  const supabase = clientForUser(jwt);
  if (!supabase) {
    res.status(500).json({ error: 'Server misconfiguration: Supabase env not set.' });
    return;
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return;
  }
  const userId = userData.user.id;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfiguration: Anthropic key not set.' });
    return;
  }

  const body = (req.body ?? {}) as RawBody;
  const op   = body.op;

  if (op === 'chat')     return handleChat(req, res, supabase, body, apiKey, userId);
  if (op === 'generate') return handleGenerate(res, supabase, body, apiKey, userId);

  res.status(400).json({ error: 'Unknown op. Expected "chat" or "generate".' });
}

// ── op: chat ──────────────────────────────────────────────────────────────────

async function handleChat(
  _req: VercelRequest,
  res: VercelResponse,
  supabase: SupabaseClient,
  body: RawBody,
  apiKey: string,
  userId: string,
) {
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required.' });
    return;
  }
  if (!isMode(body.mode)) {
    res.status(400).json({ error: 'mode must be "quick_prototype" or "strategic_bet".' });
    return;
  }
  if (!isMessageArray(body.messages) || body.messages.length === 0) {
    res.status(400).json({ error: 'messages must be a non-empty array.' });
    return;
  }
  const messages = body.messages;
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== 'user') {
    res.status(400).json({ error: 'Last message must be from the user.' });
    return;
  }
  const userText = lastMessage.content.trim();
  if (!userText) {
    res.status(400).json({ error: 'Empty user message.' });
    return;
  }

  // Ensure the session exists (and belongs to this user via RLS).
  const session = await ensureSession(supabase, sessionId, userId, body.mode, userText);
  if ('error' in session) {
    res.status(session.status).json({ error: session.error });
    return;
  }

  // Per-session message cap (count user messages only; assistant turns are derived).
  const { count, error: countErr } = await supabase
    .from('validator_messages')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('role', 'user');
  if (countErr) {
    res.status(500).json({ error: 'Failed to read message count.' });
    return;
  }
  if ((count ?? 0) >= MAX_MESSAGES_PER_SESSION) {
    res.status(429).json({
      error: `Chat limit reached (${MAX_MESSAGES_PER_SESSION} messages per session). Generate the doc or start a new session.`,
    });
    return;
  }

  // Persist the user turn before calling the model.
  const { error: insertUserErr } = await supabase
    .from('validator_messages')
    .insert({ session_id: sessionId, role: 'user', content: userText });
  if (insertUserErr) {
    res.status(500).json({ error: 'Failed to persist user message.' });
    return;
  }

  let rawAssistantText: string;
  try {
    rawAssistantText = await callAnthropic(
      apiKey,
      buildChatSystemPrompt(body.mode),
      messages,
      CHAT_MAX_TOKENS,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown upstream error';
    res.status(502).json({ error: message });
    return;
  }

  // Readiness comes from the raw text (the AREAS_COVERED tag is on it); the
  // tag is stripped before persistence and before sending to the client.
  const readiness = evaluateReadiness(rawAssistantText);
  const assistantText = stripAreasTag(rawAssistantText);

  const { error: insertAssistantErr } = await supabase
    .from('validator_messages')
    .insert({ session_id: sessionId, role: 'assistant', content: assistantText });
  if (insertAssistantErr) {
    res.status(500).json({ error: 'Failed to persist assistant message.' });
    return;
  }

  await supabase
    .from('validator_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  res.status(200).json({ message: assistantText, readiness });
}

// ── op: generate ──────────────────────────────────────────────────────────────

async function handleGenerate(
  res: VercelResponse,
  supabase: SupabaseClient,
  body: RawBody,
  apiKey: string,
  userId: string,
) {
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required.' });
    return;
  }

  if (isGenerationLimited(userId)) {
    res.status(429).json({
      error: `Generation limit reached (${MAX_GENERATIONS_PER_DAY} per day). Try again tomorrow.`,
    });
    return;
  }

  const { data: session, error: sessionErr } = await supabase
    .from('validator_sessions')
    .select('id, mode')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionErr) {
    res.status(500).json({ error: 'Failed to load session.' });
    return;
  }
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }
  if (!isMode(session.mode)) {
    res.status(500).json({ error: 'Session has invalid mode.' });
    return;
  }

  const { data: messageRows, error: msgErr } = await supabase
    .from('validator_messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (msgErr) {
    res.status(500).json({ error: 'Failed to load messages.' });
    return;
  }
  const chatHistory = (messageRows ?? [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as ValidatorRole, content: m.content as string }));

  if (chatHistory.length === 0) {
    res.status(400).json({ error: 'Cannot generate from an empty chat.' });
    return;
  }

  // Generate-now escape hatch: the button is always clickable. If the user
  // explicitly opted into "generate anyway", or if the latest assistant turn
  // doesn't pass the readiness check, tell the generation prompt to flag
  // assumptions for the gaps. We never refuse to generate.
  const lastAssistant = [...chatHistory].reverse().find(m => m.role === 'assistant');
  const readiness = lastAssistant ? evaluateReadiness(lastAssistant.content) : null;
  const generateAnyway =
    body.generateAnyway === true || !readiness || !readiness.ready;

  const prompt = buildGenerationPrompt({ mode: session.mode, chatHistory, generateAnyway });

  let doc: string;
  try {
    doc = await callAnthropic(
      apiKey,
      'You are an exceptional product leader. Respond with markdown only — no preamble, no code fences.',
      [{ role: 'user', content: prompt }],
      GENERATE_MAX_TOKENS,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown upstream error';
    res.status(502).json({ error: message });
    return;
  }

  const { error: updateErr } = await supabase
    .from('validator_sessions')
    .update({
      generated_doc:    doc,
      doc_generated_at: new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    })
    .eq('id', sessionId);
  if (updateErr) {
    res.status(500).json({ error: 'Failed to persist generated doc.' });
    return;
  }

  res.status(200).json({ doc });
}

// ── Session bootstrap ─────────────────────────────────────────────────────────
//
// Idempotently ensure a session row exists. The client generates the
// sessionId (UUID) up front so it can route to /validator/<id> immediately.

async function ensureSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  mode: ValidatorMode,
  firstUserMessage: string,
): Promise<{ ok: true } | { error: string; status: number }> {
  const { data: existing, error: selectErr } = await supabase
    .from('validator_sessions')
    .select('id, user_id, mode, deleted_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (selectErr) return { error: 'Failed to load session.', status: 500 };

  if (existing) {
    if (existing.user_id !== userId)   return { error: 'Forbidden.',       status: 403 };
    if (existing.deleted_at !== null)  return { error: 'Session deleted.', status: 410 };
    if (existing.mode !== mode) {
      // Switching modes mid-session resets the conversation; the client
      // creates a new sessionId for that flow, so reaching here is a bug.
      return { error: 'Mode mismatch on existing session.', status: 409 };
    }
    return { ok: true };
  }

  const { error: insertErr } = await supabase
    .from('validator_sessions')
    .insert({
      id:      sessionId,
      user_id: userId,
      mode,
      title:   deriveSessionTitle(firstUserMessage),
    });
  if (insertErr) return { error: 'Failed to create session.', status: 500 };
  return { ok: true };
}
