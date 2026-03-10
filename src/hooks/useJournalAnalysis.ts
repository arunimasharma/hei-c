import { useState, useCallback } from 'react';
import type { UserProfile, JournalReflection } from '../types';
import type { JournalAnalysisResult, JournalAnalysisState } from '../types/llm';
import { callClaude, parseActionResponse } from '../services/claudeApi';
import {
  JOURNAL_SYSTEM_PROMPT,
  buildJournalMessage,
  parseJournalResponse,
  REASONING_STEPS,
  EMPTY_CBT,
} from '../services/journalPromptBuilder';
import { loadMemory } from '../services/memoryManager';

const initialState: JournalAnalysisState = {
  isAnalyzing: false,
  reasoningStep: null,
  error: null,
  result: null,
};


export function useJournalAnalysis() {
  const [analysisState, setAnalysisState] = useState<JournalAnalysisState>(initialState);

  const analyzeJournal = useCallback(async (
    text: string,
    user?: UserProfile | null,
    recentReflections?: JournalReflection[],
  ): Promise<JournalAnalysisResult | null> => {
    if (!text.trim()) {
      setAnalysisState({ isAnalyzing: false, reasoningStep: null, error: 'Please write something before analysing.', result: null });
      return null;
    }

    // Kick off reasoning step narration
    let stepHandle: ReturnType<typeof setTimeout> | null = null;
    let stepIdx = 0;

    const advanceStep = () => {
      setAnalysisState(prev => ({
        ...prev,
        reasoningStep: REASONING_STEPS[stepIdx] ?? REASONING_STEPS[REASONING_STEPS.length - 1],
      }));
      stepIdx += 1;
      if (stepIdx < REASONING_STEPS.length) {
        stepHandle = setTimeout(advanceStep, 1_800);
      }
    };

    setAnalysisState({ isAnalyzing: true, reasoningStep: REASONING_STEPS[0], error: null, result: null });
    advanceStep();

    try {
      const memory = loadMemory();
      const userMessage = buildJournalMessage(text, user, recentReflections, memory);
      const response = await callClaude(JOURNAL_SYSTEM_PROMPT, userMessage);
      const rawText = parseActionResponse(response);
      const result = parseJournalResponse(rawText);

      if (stepHandle !== null) clearTimeout(stepHandle);
      setAnalysisState({ isAnalyzing: false, reasoningStep: null, error: null, result });
      return result;
    } catch (err) {
      if (stepHandle !== null) clearTimeout(stepHandle);
      const message = err instanceof Error ? err.message : 'Analysis failed. Please try again.';
      setAnalysisState({ isAnalyzing: false, reasoningStep: null, error: message, result: null });
      return null;
    }
  }, []);

  const resetAnalysis = useCallback(() => {
    setAnalysisState(initialState);
  }, []);

  return { analysisState, analyzeJournal, resetAnalysis, EMPTY_CBT };
}
