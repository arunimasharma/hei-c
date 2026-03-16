export interface UserProfile {
  id: string;
  name: string;
  role: string;
  goals?: string;
  checkInFrequency?: 'daily' | 'weekly' | 'as-needed';
  onboardingComplete: boolean;
  createdAt: string;
}

export interface EmotionEntry {
  id: string;
  userId: string;
  emotion: EmotionType;
  intensity: number;
  timestamp: string;
  eventId?: string;
  notes?: string;
  triggers?: string[];
}

export interface CareerEvent {
  id: string;
  userId: string;
  title: string;
  type: EventType;
  date: string;
  description?: string;
  outcome?: 'positive' | 'neutral' | 'negative' | 'mixed' | 'pending';
  emotionIds?: string[];
}

export interface MicroAction {
  id: string;
  title: string;
  description: string;
  category: ActionCategory;
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string;
  skipped?: boolean;
  approved?: boolean;
  inProgress?: boolean;
  snoozed?: boolean;
  suggestedFor?: EmotionType[];
  reasoning?: string;
  generatedAt?: string;
}

export type EmotionType =
  | 'Joy' | 'Stress' | 'Anxiety' | 'Confidence'
  | 'Frustration' | 'Pride' | 'Fear' | 'Excitement'
  | 'Sadness' | 'Hope' | 'Anger' | 'Gratitude';

export type EventType =
  | 'Meeting' | 'Project' | 'Review' | 'Interview'
  | 'Promotion' | 'Feedback' | 'Presentation' | 'Deadline'
  | 'Conflict' | 'Achievement' | 'Learning' | 'Other';

export type ActionCategory =
  | 'Build' | 'Experiment'
  | 'Stress Relief' | 'Confidence Building' | 'Energy Boost'
  | 'Reflection' | 'Grounding' | 'Gratitude' | 'Self-Care';

export interface AppSettings {
  theme: 'light' | 'dark';
  notifications: boolean;
  showDemoData: boolean;
  claudeApiKey?: string;
}

export interface JournalReflection {
  id: string;
  text: string;
  timestamp: string;
  status: 'draft' | 'analyzed' | 'approved';
  detectedEmotion?: EmotionType;
  detectedIntensity?: number;
  detectedEventType?: EventType;
  detectedCompanyName?: string;
  detectedTriggers?: string[];
  detectedSummary?: string;
  approvedEmotion?: EmotionType;
  approvedIntensity?: number;
  approvedEventType?: EventType;
  approvedCompanyName?: string;
  createdEmotionId?: string;
  createdEventId?: string;
}

export interface CareerGoal {
  id: string;
  userId: string;
  title: string;
  description: string;
  targetDate: string;
  status: 'active' | 'completed' | 'paused' | 'archived';
  progress: number;
  relatedEventIds?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmotionalIntelligenceGoal {
  id: string;
  userId: string;
  title: string;
  description: string;
  targetDate: string;
  status: 'active' | 'completed' | 'paused' | 'archived';
  progress: number;
  relatedEmotionIds?: string[];
  focusArea: 'self-awareness' | 'self-regulation' | 'empathy' | 'social-skills' | 'motivation';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type Goal = CareerGoal | EmotionalIntelligenceGoal;

export type GoalType = 'career' | 'emotional-intelligence';

export interface TasteExerciseAnswer {
  question: string;
  answer: string;
}

// ── Product Taste Evaluator V1 ────────────────────────────────────────────────

export type TasteVerdict = 'Very Weak' | 'Emerging' | 'Functional' | 'Strong' | 'Exceptional';

/** Rich evaluation returned by /api/evaluate-taste (V1 evaluator). */
export interface TasteEvaluatorResult {
  overall_score: number;
  verdict: TasteVerdict;
  per_question_scores: { q1: number; q2: number; q3: number; q4: number; q5: number; q6: number };
  detailed_reasoning: string;
  strengths: string[];
  weaknesses: string[];
  signals_of_strong_product_taste: string[];
  missing_signals: string[];
  coaching_to_improve: string[];
}

export interface TasteExercise {
  id: string;
  userId: string;
  productName: string;
  answers: TasteExerciseAnswer[];
  summary: string;
  score: number;
  scoreComment: string;
  timestamp: string;
  status: 'completed';
  /** Full V1 evaluator result — present when evaluated via /api/evaluate-taste. */
  evaluation?: TasteEvaluatorResult;
}

export interface DecisionLog {
  id: string;
  userId: string;
  question: string;
  deadline?: string;
  options: string[];
  aiStructuredBrief: string;
  chosenOption?: string;
  chosenReason?: string;
  status: 'open' | 'decided';
  createdAt: string;
  decidedAt?: string;
}

export interface WorkModeEntry {
  id: string;
  userId: string;
  mode: 'strategic' | 'reactive' | 'balanced' | 'survival';
  timestamp: string;
}
