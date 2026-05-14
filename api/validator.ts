/**
 * Vercel Serverless Function — /api/validator
 *
 * Stateless proxy for the Idea Validator. Discriminated by `op`:
 *   { op: 'chat',     mode, messages }
 *   { op: 'generate', mode, messages, generateAnyway? }
 *
 * No authentication. Sessions and messages are persisted client-side in
 * localStorage (see src/services/validatorClient.ts); the server only calls
 * Anthropic and returns the model output.
 *
 * Soft per-IP, per-cold-start rate limit on `generate` to bound spend.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  buildChatSystemPrompt,
  buildGenerationPrompt,
  evaluateReadiness,
  stripAreasTag,
} from '../src/services/validatorPrompts.js';
import type {
  ValidatorMode,
  ValidatorRole,
} from '../src/types/validator.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const CHAT_MODEL          = 'claude-sonnet-4-20250514';
const CHAT_MAX_TOKENS     = 800;
const GENERATE_MAX_TOKENS = 4096;
const MAX_GENERATIONS_PER_DAY_PER_IP = 30;

// ── Generation rate limiter (per IP, per cold-start) ─────────────────────────

const genHits = new Map<string, { count: number; resetAt: number }>();
const GEN_WINDOW_MS = 24 * 60 * 60 * 1000;

function isGenerationLimited(key: string): boolean {
  const now = Date.now();
  const entry = genHits.get(key);
  if (!entry || now > entry.resetAt) {
    genHits.set(key, { count: 1, resetAt: now + GEN_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_GENERATIONS_PER_DAY_PER_IP;
}

function clientKey(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const ip = Array.isArray(fwd) ? fwd[0] : (fwd ?? '').split(',')[0].trim();
  return ip || 'unknown';
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfiguration: Anthropic key not set.' });
    return;
  }

  const body = (req.body ?? {}) as RawBody;
  const op   = body.op;

  if (op === 'chat')     return handleChat(res, body, apiKey);
  if (op === 'generate') return handleGenerate(req, res, body, apiKey);

  res.status(400).json({ error: 'Unknown op. Expected "chat" or "generate".' });
}

// ── op: chat ──────────────────────────────────────────────────────────────────

async function handleChat(
  res: VercelResponse,
  body: RawBody,
  apiKey: string,
) {
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
  if (!lastMessage.content.trim()) {
    res.status(400).json({ error: 'Empty user message.' });
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

  const readiness = evaluateReadiness(rawAssistantText);
  const assistantText = stripAreasTag(rawAssistantText);

  res.status(200).json({ message: assistantText, readiness });
}

// ── op: generate ──────────────────────────────────────────────────────────────

async function handleGenerate(
  req: VercelRequest,
  res: VercelResponse,
  body: RawBody,
  apiKey: string,
) {
  if (!isMode(body.mode)) {
    res.status(400).json({ error: 'mode must be "quick_prototype" or "strategic_bet".' });
    return;
  }
  if (!isMessageArray(body.messages) || body.messages.length === 0) {
    res.status(400).json({ error: 'messages must be a non-empty array.' });
    return;
  }

  if (isGenerationLimited(clientKey(req))) {
    res.status(429).json({
      error: `Generation limit reached (${MAX_GENERATIONS_PER_DAY_PER_IP} per day). Try again tomorrow.`,
    });
    return;
  }

  const chatHistory = body.messages;
  const lastAssistant = [...chatHistory].reverse().find(m => m.role === 'assistant');
  const readiness = lastAssistant ? evaluateReadiness(lastAssistant.content) : null;
  const generateAnyway =
    body.generateAnyway === true || !readiness || !readiness.ready;

  const prompt = buildGenerationPrompt({ mode: body.mode, chatHistory, generateAnyway });

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

  res.status(200).json({ doc });
}
