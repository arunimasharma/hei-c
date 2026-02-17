import type { ClaudeRequest, ClaudeResponse } from '../types/llm';

const PROXY_URL = '/api/claude';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;

export class ClaudeApiError extends Error {
  statusCode: number;
  isRetryable: boolean;

  constructor(
    message: string,
    statusCode: number,
    isRetryable: boolean,
  ) {
    super(message);
    this.name = 'ClaudeApiError';
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

/**
 * Calls the Claude API through the Vite proxy.
 * The API key is sent as a standard Authorization: Bearer token.
 * The proxy extracts the Bearer token and re-maps it to Anthropic's
 * x-api-key header server-side — the raw key never appears in a
 * custom header on the client-side request.
 */
export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
): Promise<ClaudeResponse> {
  const body: ClaudeRequest = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  };

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    const isRetryable = response.status === 429 || response.status >= 500;
    throw new ClaudeApiError(
      `Claude API error ${response.status}: ${errorBody}`,
      response.status,
      isRetryable,
    );
  }

  return response.json() as Promise<ClaudeResponse>;
}

export function parseActionResponse(raw: ClaudeResponse): string {
  const textBlock = raw.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('No text content in Claude response');
  return textBlock.text;
}

export async function testConnection(apiKey: string): Promise<boolean> {
  try {
    const body: ClaudeRequest = {
      model: MODEL,
      max_tokens: 20,
      system: 'Respond with exactly: {"status":"ok"}',
      messages: [{ role: 'user', content: 'ping' }],
    };

    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    return response.ok;
  } catch {
    return false;
  }
}
