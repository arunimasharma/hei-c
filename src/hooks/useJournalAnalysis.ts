import { useState, useCallback } from 'react';
import type { UserProfile, JournalReflection } from '../types';
import type { JournalAnalysisResult, JournalAnalysisState } from '../types/llm';
import { callClaude, parseActionResponse } from '../services/claudeApi';
import { JOURNAL_SYSTEM_PROMPT, buildJournalMessage, parseJournalResponse } from '../services/journalPromptBuilder';
import { loadMemory } from '../services/memoryManager';

const initialState: JournalAnalysisState = {
  isAnalyzing: false,
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
      setAnalysisState({ isAnalyzing: false, error: 'Please write something before analyzing.', result: null });
      return null;
    }

    setAnalysisState({ isAnalyzing: true, error: null, result: null });

    try {
      const memory = loadMemory();
      const userMessage = buildJournalMessage(text, user, recentReflections, memory);
      const response = await callClaude(JOURNAL_SYSTEM_PROMPT, userMessage);
      const rawText = parseActionResponse(response);
      const result = parseJournalResponse(rawText);

      setAnalysisState({ isAnalyzing: false, error: null, result });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed. Please try again.';
      setAnalysisState({ isAnalyzing: false, error: message, result: null });
      return null;
    }
  }, []);

  const resetAnalysis = useCallback(() => {
    setAnalysisState(initialState);
  }, []);

  return { analysisState, analyzeJournal, resetAnalysis };
}
