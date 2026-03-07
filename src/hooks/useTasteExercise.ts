import { useState, useCallback } from 'react';
import type { TasteExerciseAnswer } from '../types';
import { callClaude, parseActionResponse } from '../services/claudeApi';
import {
  TASTE_QUESTIONS,
  TASTE_ANALYSIS_SYSTEM_PROMPT,
  buildTasteAnalysisMessage,
  parseTasteAnalysisResponse,
  type TasteAnalysisResult,
} from '../services/tasteExercisePromptBuilder';

export type TastePhase = 'product-select' | 'questioning' | 'analyzing' | 'done';

export function useTasteExercise() {
  const [tePhase, setTePhase] = useState<TastePhase>('product-select');
  const [productName, setProductName] = useState('');
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<TasteExerciseAnswer[]>([]);
  const [result, setResult] = useState<TasteAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startExercise = useCallback((name: string) => {
    setProductName(name.trim());
    setQuestionIdx(0);
    setAnswers([]);
    setResult(null);
    setError(null);
    setTePhase('questioning');
  }, []);

  /** Save current answer and advance to the next question. Returns false if no answer provided. */
  const nextQuestion = useCallback((currentAnswer: string) => {
    if (!currentAnswer.trim()) return false;
    setAnswers(prev => [
      ...prev,
      { question: TASTE_QUESTIONS[questionIdx], answer: currentAnswer.trim() },
    ]);
    setQuestionIdx(i => i + 1);
    return true;
  }, [questionIdx]);

  /** Finish the exercise — optionally save the current answer, then run AI analysis. */
  const finishEntry = useCallback(async (currentAnswer: string): Promise<{
    answers: TasteExerciseAnswer[];
    result: TasteAnalysisResult;
  } | null> => {
    const finalAnswers: TasteExerciseAnswer[] = currentAnswer.trim()
      ? [...answers, { question: TASTE_QUESTIONS[questionIdx], answer: currentAnswer.trim() }]
      : [...answers];

    if (finalAnswers.length === 0) {
      setError('Please answer at least one question before finishing.');
      return null;
    }

    setTePhase('analyzing');
    setError(null);

    try {
      const userMessage = buildTasteAnalysisMessage(productName, finalAnswers);
      const response = await callClaude(TASTE_ANALYSIS_SYSTEM_PROMPT, userMessage);
      const rawText = parseActionResponse(response);
      const analysisResult = parseTasteAnalysisResponse(rawText);

      setAnswers(finalAnswers);
      setResult(analysisResult);
      setTePhase('done');
      return { answers: finalAnswers, result: analysisResult };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed. Please try again.';
      setError(msg);
      setTePhase('questioning');
      return null;
    }
  }, [answers, questionIdx, productName]);

  const reset = useCallback(() => {
    setTePhase('product-select');
    setProductName('');
    setQuestionIdx(0);
    setAnswers([]);
    setResult(null);
    setError(null);
  }, []);

  const isLastQuestion = questionIdx === TASTE_QUESTIONS.length - 1;
  const totalQuestions = TASTE_QUESTIONS.length;
  const currentQuestion = TASTE_QUESTIONS[questionIdx] ?? '';

  return {
    tePhase,
    productName,
    questionIdx,
    currentQuestion,
    isLastQuestion,
    totalQuestions,
    answers,
    result,
    error,
    startExercise,
    nextQuestion,
    finishEntry,
    reset,
  };
}
