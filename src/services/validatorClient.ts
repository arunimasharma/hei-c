import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type {
  ValidatorMode,
  ValidatorMessage,
  ValidatorRole,
  ValidatorSession,
  ValidatorReadiness,
} from '../types/validator';

const API_URL = '/api/validator';

// TEMP: matches the BYPASS_AUTH flag in src/components/validator/RequireAuth.tsx.
// Active only in `npm run dev` (Vite MODE === 'development'). In production
// builds and in vitest, this is false so the real auth + Supabase path runs.
// To force off in dev too, hard-code `false`.
const BYPASS_AUTH = import.meta.env.MODE === 'development';

export class ValidatorError extends Error {
  status: number;
  retryable: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ValidatorError';
    this.status = status;
    this.retryable = status === 429 || status >= 500;
  }
}

async function authedFetch(body: unknown): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (!BYPASS_AUTH) {
    if (!supabase) throw new ValidatorError('Supabase is not configured.', 500);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new ValidatorError('You are not signed in.', 401);
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json() as { error?: string };
      if (data.error) message = data.error;
    } catch { /* fall through */ }
    throw new ValidatorError(message, res.status);
  }
  return res.json() as Promise<T>;
}

// ── Server-backed ops ─────────────────────────────────────────────────────────

export async function sendChat(input: {
  sessionId: string;
  mode: ValidatorMode;
  messages: Array<{ role: ValidatorRole; content: string }>;
}): Promise<{ message: string; readiness: ValidatorReadiness }> {
  const res = await authedFetch({ op: 'chat', ...input });
  return unwrap(res);
}

export async function generateDoc(input: {
  sessionId: string;
  generateAnyway?: boolean;
}): Promise<{ doc: string }> {
  const res = await authedFetch({ op: 'generate', ...input });
  return unwrap(res);
}

// ── Direct Supabase CRUD (RLS-enforced) ───────────────────────────────────────

interface SessionRow {
  id: string;
  user_id: string;
  mode: ValidatorMode;
  title: string | null;
  generated_doc: string | null;
  doc_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: ValidatorRole;
  content: string;
  created_at: string;
}

function toSession(row: SessionRow): ValidatorSession {
  return {
    id:             row.id,
    userId:         row.user_id,
    mode:           row.mode,
    title:          row.title,
    generatedDoc:   row.generated_doc,
    docGeneratedAt: row.doc_generated_at,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

function toMessage(row: MessageRow): ValidatorMessage {
  return {
    id:        row.id,
    sessionId: row.session_id,
    role:      row.role,
    content:   row.content,
    createdAt: row.created_at,
  };
}

export async function listSessions(): Promise<ValidatorSession[]> {
  if (BYPASS_AUTH) {
    const res = await authedFetch({ op: 'list' });
    const { sessions } = await unwrap<{ sessions: SessionRow[] }>(res);
    return sessions.map(toSession);
  }
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('validator_sessions')
    .select('id, user_id, mode, title, generated_doc, doc_generated_at, created_at, updated_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new ValidatorError(error.message, 500);
  return (data ?? []).map(toSession);
}

export async function getSession(sessionId: string): Promise<{
  session: ValidatorSession;
  messages: ValidatorMessage[];
} | null> {
  if (BYPASS_AUTH) {
    const res = await authedFetch({ op: 'get', sessionId });
    if (res.status === 404) return null;
    const { session, messages } = await unwrap<{ session: SessionRow; messages: MessageRow[] }>(res);
    return { session: toSession(session), messages: messages.map(toMessage) };
  }
  if (!isSupabaseConfigured || !supabase) return null;

  const { data: sessionRow, error: sessionErr } = await supabase
    .from('validator_sessions')
    .select('id, user_id, mode, title, generated_doc, doc_generated_at, created_at, updated_at')
    .eq('id', sessionId)
    .is('deleted_at', null)
    .maybeSingle();
  if (sessionErr) throw new ValidatorError(sessionErr.message, 500);
  if (!sessionRow) return null;

  const { data: messageRows, error: msgErr } = await supabase
    .from('validator_messages')
    .select('id, session_id, role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (msgErr) throw new ValidatorError(msgErr.message, 500);

  return {
    session:  toSession(sessionRow),
    messages: (messageRows ?? []).map(toMessage),
  };
}

export async function softDeleteSession(sessionId: string): Promise<void> {
  if (BYPASS_AUTH) {
    const res = await authedFetch({ op: 'delete', sessionId });
    await unwrap<{ ok: true }>(res);
    return;
  }
  if (!isSupabaseConfigured || !supabase) {
    throw new ValidatorError('Supabase is not configured.', 500);
  }
  const { error } = await supabase
    .from('validator_sessions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw new ValidatorError(error.message, 500);
}

// ── Local UUID (for sessionId minted client-side) ─────────────────────────────

export function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback: not cryptographically strong but fine for an opaque id.
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
}
