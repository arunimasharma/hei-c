import { useState, useCallback } from 'react';
import type { UserProfile } from '../types';
import type { JournalAnalysisResult, JournalAnalysisState } from '../types/llm';
import { callClaude, parseActionResponse } from '../services/claudeApi';
import { JOURNAL_SYSTEM_PROMPT, buildJournalMessage, parseJournalResponse } from '../services/journalPromptBuilder';

const initialState: JournalAnalysisState = {
  isAnalyzing: false,
  error: null,
  result: null,
};

export function useJournalAnalysis() {
  const [analysisState, setAnalysisState] = useState<JournalAnalysisState>(initialState);

  const analyzeJournal = useCallback(async (
    text: string,
    apiKey: string,
    user?: UserProfile | null,
  ): Promise<JournalAnalysisResult | null> => {
    if (!apiKey) {
      setAnalysisState({ isAnalyzing: false, error: 'Add your API key in Settings to use AI analysis.', result: null });
      return null;
    }

    if (!text.trim()) {
      setAnalysisState({ isAnalyzing: false, error: 'Please write something before analyzing.', result: null });
      return null;
    }

    setAnalysisState({ isAnalyzing: true, error: null, result: null });

    try {
      const userMessage = buildJournalMessage(text, user);
      const response = await callClaude(JOURNAL_SYSTEM_PROMPT, userMessage, apiKey);
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
