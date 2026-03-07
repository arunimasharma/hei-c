import type { UserProfile } from '../types';

export type ChatMessage = {
  id: string;
  role: 'user' | 'coach';
  text: string;
};

export const COACH_SYSTEM_PROMPT = `You are the Hello-EQ Coach, a warm and empathetic emotional intelligence coach in a career wellness app called Hello-EQ. Your role is to help professionals explore their work emotions through supportive, curious conversation.

GUIDELINES:
- Be warm, genuinely curious, and non-judgmental
- Ask exactly ONE focused follow-up question per response
- Keep responses concise: 1-2 short sentences of empathetic acknowledgment + 1 open-ended question
- Reference specific things the user mentioned to show you are truly listening
- Help them explore the emotions behind events, what triggered them, and their impact at work
- Use second person ("you") and natural conversational language — no lists, no bullet points, no formatting

Respond with only your coaching reply — no labels, no preamble, just natural conversational text.`;

export const COACH_DEEPER_SYSTEM_PROMPT = `You are the Hello-EQ Coach. Based on the conversation so far, ask ONE powerful introspective question that helps the user understand their emotional landscape at work on a deeper level.

Your question should help them explore one of:
- Underlying patterns or recurring themes in how they feel at work
- Core values or needs that are being challenged or unmet
- The "why" behind their emotions — what this situation means to them
- How this emotion connects to their sense of identity or worth at work
- What this experience is trying to tell them about what they truly need

The question must be thought-provoking, specific to their situation, and go well beyond the surface level.

Respond with ONLY the question itself — no acknowledgment, no preamble, no explanation. Just the question.`;

const GREETINGS = [
  "What's been on your mind at work lately?",
  "How are you really feeling about work today?",
  "What's been weighing on you lately?",
  "How did things go at work today?",
  "What's something that's been on your mind lately?",
];

export function buildInitialCoachGreeting(user?: UserProfile | null): string {
  const idx = Math.floor(Date.now() / 10000) % GREETINGS.length;
  const name = user?.name ? `, ${user.name}` : '';
  return `Hey${name}! ${GREETINGS[idx]}`;
}

export function buildCoachApiMessages(
  messages: ChatMessage[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  // The initial coach greeting (id='init') is captured in system prompt context.
  // We start from the first user message onwards.
  return messages
    .filter(m => m.id !== 'init')
    .map(m => ({
      role: m.role === 'coach' ? 'assistant' as const : 'user' as const,
      content: m.text,
    }));
}

export function buildCoachSystemPromptWithContext(
  greeting: string,
  user?: UserProfile | null,
  deeper = false,
): string {
  const base = deeper ? COACH_DEEPER_SYSTEM_PROMPT : COACH_SYSTEM_PROMPT;
  const userContext = user
    ? `\n\nCONTEXT ABOUT THE USER:\nName: ${user.name}\nRole: ${user.role || 'Not specified'}`
    : '';
  const greetingContext = `\n\nYou opened the conversation with: "${greeting}"`;
  return base + userContext + greetingContext;
}
