import { useState, useCallback, useRef } from 'react';
import type { UserProfile } from '../types';
import { callClaudeMessages, parseActionResponse } from '../services/claudeApi';
import {
  buildInitialCoachGreeting,
  buildCoachApiMessages,
  buildCoachSystemPromptWithContext,
} from '../services/coachPromptBuilder';

export type ChatMessage = {
  id: string;
  role: 'user' | 'coach';
  text: string;
};

export function useCoachChat(user?: UserProfile | null) {
  const greetingRef = useRef(buildInitialCoachGreeting(user));
  const initialMessage: ChatMessage = { id: 'init', role: 'coach', text: greetingRef.current };
  const messagesRef = useRef<ChatMessage[]>([initialMessage]);

  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [isCoachTyping, setIsCoachTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const _callCoach = useCallback(async (
    allMessages: ChatMessage[],
    deeper: boolean,
  ) => {
    setIsCoachTyping(true);
    setError(null);
    try {
      const systemPrompt = buildCoachSystemPromptWithContext(greetingRef.current, user, deeper);
      let apiMessages = buildCoachApiMessages(allMessages);

      // For "Go Deeper" there's no new user message — append a hidden trigger turn
      // so the API messages always end with a user role as required by Anthropic
      if (deeper) {
        apiMessages = [
          ...apiMessages,
          { role: 'user' as const, content: 'Help me go deeper.' },
        ];
      }

      const response = await callClaudeMessages(systemPrompt, apiMessages, 400);
      const coachText = parseActionResponse(response).trim();
      const coachMsg: ChatMessage = { id: `c_${Date.now()}`, role: 'coach', text: coachText };

      messagesRef.current = [...allMessages, coachMsg];
      setMessages(messagesRef.current);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not get a response. Try again.';
      setError(msg);
    } finally {
      setIsCoachTyping(false);
    }
  }, [user]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: 'user', text: text.trim() };
    const next = [...messagesRef.current, userMsg];
    messagesRef.current = next;
    setMessages(next);
    await _callCoach(next, false);
  }, [_callCoach]);

  const goDeeper = useCallback(async () => {
    await _callCoach(messagesRef.current, true);
  }, [_callCoach]);

  const reset = useCallback(() => {
    greetingRef.current = buildInitialCoachGreeting(user);
    const fresh: ChatMessage = { id: 'init', role: 'coach', text: greetingRef.current };
    messagesRef.current = [fresh];
    setMessages([fresh]);
    setError(null);
    setIsCoachTyping(false);
  }, [user]);

  /** All user messages joined as a reflection text for storage */
  const getJournalText = useCallback(() => {
    return messagesRef.current
      .filter(m => m.role === 'user')
      .map(m => m.text)
      .join('\n\n');
  }, []);

  /** Full conversation transcript for richer AI analysis */
  const getConversationTranscript = useCallback(() => {
    return messagesRef.current
      .map(m => `${m.role === 'coach' ? 'Coach' : 'Me'}: ${m.text}`)
      .join('\n\n');
  }, []);

  const userMessageCount = messages.filter(m => m.role === 'user').length;
  const lastMessageIsCoach =
    messages.length > 0 && messages[messages.length - 1].role === 'coach';

  return {
    messages,
    isCoachTyping,
    error,
    sendMessage,
    goDeeper,
    reset,
    getJournalText,
    getConversationTranscript,
    userMessageCount,
    lastMessageIsCoach,
  };
}
