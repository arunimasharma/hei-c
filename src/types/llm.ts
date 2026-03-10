import type { ActionCategory, EmotionType } from './index';

// ── Claude API wire types ────────────────────────────────────────────────────

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

// ── Structured output from Claude ────────────────────────────────────────────

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

// ── Memory / RAG schema ───────────────────────────────────────────────────────

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

export interface MemoryInsight {
  date: string;
  insight: string;
  suggestedTitles: string[];
}

export interface MemoryStore {
  actionOutcomes: ActionOutcome[];
  emotionPatterns: EmotionPattern[];
  lastSummaryTimestamp: string;
  conversationSummary: string;
  recentInsights: MemoryInsight[];
}

// ── Hook state ────────────────────────────────────────────────────────────────

export interface LLMActionState {
  isLoading: boolean;
  error: string | null;
  isAiGenerated: boolean;
  insight: string | null;
}

// ── CBT / Cognitive distortion types ─────────────────────────────────────────

/**
 * Cognitive distortions from Aaron Beck's CBT framework.
 * Detecting these enables targeted reframing suggestions in the coaching layer.
 */
export type CognitiveDistortion =
  | 'catastrophizing'     // Assuming worst-case outcomes
  | 'all-or-nothing'      // Black-and-white thinking; no middle ground
  | 'mind-reading'        // Assuming you know others' thoughts/intentions
  | 'overgeneralization'  // Drawing broad conclusions from a single event
  | 'personalization'     // Taking excessive personal responsibility for external events
  | 'should-statements'   // Rigid rules about how things "must" or "should" be
  | 'emotional-reasoning' // Treating a feeling as proof of a fact ("I feel stupid, so I am")
  | 'labeling'            // Attaching fixed negative labels to self or others
  | 'filtering'           // Exclusively focusing on negatives while ignoring positives
  | 'fortune-telling';    // Predicting negative outcomes as if they were certain

/**
 * CBT ABC Model — the clinical framework for understanding emotional responses.
 *   A = Activating Event  (what happened)
 *   B = Beliefs           (the automatic thought triggered by A)
 *   C = Consequences      (the emotional / behavioral outcome)
 */
export interface CBTAnalysis {
  /** A — The specific activating event as described in the journal entry. */
  activatingEvent: string;
  /** B — The core beliefs or automatic thoughts driving the emotional response. */
  coreBeliefs: string[];
  /** C — The emotional and behavioral consequences identified. */
  consequences: string;
  /** Zero or more cognitive distortions detected in the entry. */
  distortions: CognitiveDistortion[];
  /**
   * One concise, gentle reframe that challenges the most prominent distortion.
   * Empty string when no distortions are detected.
   */
  reframeHint: string;
}

// ── Journal analysis types ────────────────────────────────────────────────────

export interface JournalAnalysisResult {
  emotion: string;
  intensity: number;
  eventType: string | null;
  companyName: string | null;
  triggers: string[];
  summary: string;
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
  confidence: number;
  /** CBT ABC Model analysis — always present on successful analyses. */
  cbt: CBTAnalysis;
}

export interface JournalAnalysisState {
  isAnalyzing: boolean;
  /** Narrates the current AI reasoning step — drives skeleton loader copy. */
  reasoningStep: string | null;
  error: string | null;
  result: JournalAnalysisResult | null;
}
