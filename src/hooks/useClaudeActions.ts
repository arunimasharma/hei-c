import { useState, useCallback } from 'react';
import type { MicroAction, EmotionEntry, CareerEvent, UserProfile, Goal } from '../types';
import type { LLMActionState } from '../types/llm';
import { callClaude, parseActionResponse, ClaudeApiError } from '../services/claudeApi';
import { SYSTEM_PROMPT, buildUserMessage, parseAndValidateResponse } from '../services/promptBuilder';
import { loadMemory, updateEmotionPatterns, updateConversationSummary } from '../services/memoryManager';
import { generateSuggestedActions } from '../utils/actionGenerator';

let actionCounter = 0;
function generateId(): string {
  return `ai_action_${Date.now()}_${actionCounter++}`;
}

export function useClaudeActions() {
  const [llmState, setLlmState] = useState<LLMActionState>({
    isLoading: false,
    error: null,
    isAiGenerated: false,
    insight: null,
  });

  const generateActions = useCallback(async (
    user: UserProfile,
    emotions: EmotionEntry[],
    events: CareerEvent[],
    currentActions: MicroAction[],
    goals: Goal[] = [],
  ): Promise<MicroAction[]> => {

    setLlmState({ isLoading: true, error: null, isAiGenerated: false, insight: null });

    try {
      // Update emotion patterns before building the prompt
      updateEmotionPatterns(emotions);

      const memory = loadMemory();
      const userMessage = buildUserMessage(user, emotions, events, memory, currentActions, goals);
      const response = await callClaude(SYSTEM_PROMPT, userMessage);
      const rawText = parseActionResponse(response);
      const parsed = parseAndValidateResponse(rawText);

      // Convert LLMGeneratedAction[] to MicroAction[]
      const now = new Date().toISOString();
      const actions: MicroAction[] = parsed.actions.map(a => ({
        id: generateId(),
        title: a.title,
        description: a.description,
        category: a.category,
        estimatedMinutes: a.estimatedMinutes,
        completed: false,
        suggestedFor: a.suggestedFor,
        reasoning: a.reasoning,
        generatedAt: now,
      }));

      // Update memory with this interaction
      updateConversationSummary(
        parsed.insight,
        parsed.actions.map(a => a.title),
      );

      setLlmState({ isLoading: false, error: null, isAiGenerated: true, insight: parsed.insight });
      return actions;

    } catch (err) {
      const message = err instanceof ClaudeApiError
        ? `AI unavailable (${err.statusCode}). Using built-in suggestions.`
        : 'AI generation failed. Using built-in suggestions.';

      console.error('Claude action generation failed:', err);
      setLlmState({ isLoading: false, error: message, isAiGenerated: false, insight: null });

      // Graceful fallback to static generation
      return generateSuggestedActions(emotions, currentActions, goals);
    }
  }, []);

  return { llmState, generateActions };
}
