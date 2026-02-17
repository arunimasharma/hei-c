import type { ActionCategory, EmotionType } from './index';

// ---- Claude API wire types ----

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: ClaudeMessage[];
}

export interface ClaudeResponse {
  id: string;
  content: Array<{ type: 'text'; text: string }>;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

// ---- Structured output expected from Claude ----

export interface LLMGeneratedAction {
  title: string;
  description: string;
  category: ActionCategory;
  estimatedMinutes: number;
  reasoning: string;
  suggestedFor: EmotionType[];
}

export interface LLMActionResponse {
  actions: LLMGeneratedAction[];
  insight: string;
}

// ---- Memory / RAG schema ----

export interface ActionOutcome {
  actionTitle: string;
  category: ActionCategory;
  wasCompleted: boolean;
  emotionContext: EmotionType[];
  timestamp: string;
}

export interface EmotionPattern {
  period: string;
  dominantEmotions: Array<{ emotion: EmotionType; avgIntensity: number; count: number }>;
  triggers: string[];
}

export interface MemoryStore {
  actionOutcomes: ActionOutcome[];
  emotionPatterns: EmotionPattern[];
  lastSummaryTimestamp: string;
  conversationSummary: string;
}

// ---- Hook state ----

export interface LLMActionState {
  isLoading: boolean;
  error: string | null;
  isAiGenerated: boolean;
  insight: string | null;
}

// ---- Journal analysis types ----

export interface JournalAnalysisResult {
  emotion: string;
  intensity: number;
  eventType: string | null;
  companyName: string | null;
  triggers: string[];
  summary: string;
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
  confidence: number;
}

export interface JournalAnalysisState {
  isAnalyzing: boolean;
  error: string | null;
  result: JournalAnalysisResult | null;
}
