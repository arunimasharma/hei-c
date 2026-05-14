import type {
  ValidatorMode,
  ValidatorMessage,
  ValidatorRole,
  ValidatorSession,
  ValidatorReadiness,
} from '../types/validator';

const API_URL = '/api/validator';
const STORAGE_KEY = 'hei.validator.sessions.v1';

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

// ── Local persistence ─────────────────────────────────────────────────────────
//
// Sessions live entirely in localStorage on the user's device. The server is
// stateless for this feature — it only proxies Anthropic calls.

interface StoredSession {
  id: string;
  mode: ValidatorMode;
  title: string | null;
  generatedDoc: string | null;
  docGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  messages: ValidatorMessage[];
}

function loadStore(): Record<string, StoredSession> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredSession>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, StoredSession>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded or storage unavailable — silently drop the write.
  }
}

function toSession(s: StoredSession): ValidatorSession {
  return {
    id:             s.id,
    userId:         '',
    mode:           s.mode,
    title:          s.title,
    generatedDoc:   s.generatedDoc,
    docGeneratedAt: s.docGeneratedAt,
    createdAt:      s.createdAt,
    updatedAt:      s.updatedAt,
  };
}

function ensureStoredSession(
  store: Record<string, StoredSession>,
  sessionId: string,
  mode: ValidatorMode,
  firstUserMessage: string,
): StoredSession {
  const existing = store[sessionId];
  if (existing && !existing.deletedAt) return existing;
  const now = new Date().toISOString();
  const created: StoredSession = {
    id:             sessionId,
    mode,
    title:          deriveTitle(firstUserMessage),
    generatedDoc:   null,
    docGeneratedAt: null,
    createdAt:      now,
    updatedAt:      now,
    deletedAt:      null,
    messages:       [],
  };
  store[sessionId] = created;
  return created;
}

function deriveTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Untitled idea';
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
}

function localMessageId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

// ── Server proxy (Anthropic only — no auth) ───────────────────────────────────

async function postValidator(body: unknown): Promise<Response> {
  return fetch(API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
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

// ── Public API ────────────────────────────────────────────────────────────────

export async function sendChat(input: {
  sessionId: string;
  mode: ValidatorMode;
  messages: Array<{ role: ValidatorRole; content: string }>;
}): Promise<{ message: string; readiness: ValidatorReadiness }> {
  const res = await postValidator({ op: 'chat', mode: input.mode, messages: input.messages });
  const { message, readiness } = await unwrap<{ message: string; readiness: ValidatorReadiness }>(res);

  // Persist the user turn + assistant reply locally.
  const lastUser = [...input.messages].reverse().find(m => m.role === 'user');
  const store = loadStore();
  const session = ensureStoredSession(store, input.sessionId, input.mode, lastUser?.content ?? '');
  const now = new Date().toISOString();
  if (lastUser) {
    session.messages.push({
      id:        localMessageId(),
      sessionId: input.sessionId,
      role:      'user',
      content:   lastUser.content,
      createdAt: now,
    });
  }
  session.messages.push({
    id:        localMessageId(),
    sessionId: input.sessionId,
    role:      'assistant',
    content:   message,
    createdAt: new Date().toISOString(),
  });
  session.updatedAt = new Date().toISOString();
  saveStore(store);

  return { message, readiness };
}

export async function generateDoc(input: {
  sessionId: string;
  generateAnyway?: boolean;
}): Promise<{ doc: string }> {
  const store = loadStore();
  const session = store[input.sessionId];
  if (!session || session.deletedAt) {
    throw new ValidatorError('Session not found.', 404);
  }
  const chatHistory = session.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }));
  if (chatHistory.length === 0) {
    throw new ValidatorError('Cannot generate from an empty chat.', 400);
  }

  const res = await postValidator({
    op:             'generate',
    mode:           session.mode,
    messages:       chatHistory,
    generateAnyway: input.generateAnyway === true,
  });
  const { doc } = await unwrap<{ doc: string }>(res);

  const now = new Date().toISOString();
  session.generatedDoc   = doc;
  session.docGeneratedAt = now;
  session.updatedAt      = now;
  saveStore(store);

  return { doc };
}

export async function listSessions(): Promise<ValidatorSession[]> {
  const store = loadStore();
  return Object.values(store)
    .filter(s => !s.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toSession);
}

export async function getSession(sessionId: string): Promise<{
  session: ValidatorSession;
  messages: ValidatorMessage[];
} | null> {
  const store = loadStore();
  const s = store[sessionId];
  if (!s || s.deletedAt) return null;
  return {
    session:  toSession(s),
    messages: [...s.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

export async function softDeleteSession(sessionId: string): Promise<void> {
  const store = loadStore();
  const s = store[sessionId];
  if (!s) return;
  s.deletedAt = new Date().toISOString();
  saveStore(store);
}

// ── Local UUID (for sessionId minted client-side) ─────────────────────────────

export function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
}
