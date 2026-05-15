export type ValidatorMode = 'quick_prototype' | 'strategic_bet';

export type ValidatorRole = 'user' | 'assistant';

export interface ValidatorMessage {
  id: string;
  sessionId: string;
  role: ValidatorRole;
  content: string;
  createdAt: string;
}

export type OutcomeDidTest    = 'yes' | 'no' | 'in_progress';
export type OutcomeHypothesis = 'held' | 'partly' | 'broke' | 'inconclusive';

export interface ValidatorOutcome {
  didTest: OutcomeDidTest;
  whatLearned: string;
  hypothesisHeld: OutcomeHypothesis;
  nextStep?: string;
  loggedAt: string;
}

export interface ValidatorSession {
  id: string;
  userId: string;
  mode: ValidatorMode;
  title: string | null;
  generatedDoc: string | null;
  docGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
  outcome: ValidatorOutcome | null;
}

export type ReadinessArea =
  | 'pain_and_user'
  | 'workaround_and_gap'
  | 'solution_sketch'
  | 'validation_channel';

export const READINESS_AREAS: readonly ReadinessArea[] = [
  'pain_and_user',
  'workaround_and_gap',
  'solution_sketch',
  'validation_channel',
] as const;

export const READINESS_AREA_LABELS: Record<ReadinessArea, string> = {
  pain_and_user:      'Pain point + who feels it',
  workaround_and_gap: 'Workaround + why it falls short',
  solution_sketch:    'Proposed solution',
  validation_channel: 'Who they could test with',
};

export interface ValidatorReadiness {
  ready: boolean;
  covered: ReadinessArea[];
  missing: ReadinessArea[];
}

export interface ValidatorChatRequest {
  op: 'chat';
  sessionId: string;
  mode: ValidatorMode;
  messages: Array<{ role: ValidatorRole; content: string }>;
}

export interface ValidatorGenerateRequest {
  op: 'generate';
  sessionId: string;
  generateAnyway?: boolean;
}

export type ValidatorRequest = ValidatorChatRequest | ValidatorGenerateRequest;

export interface ValidatorChatResponse {
  message: string;
  readiness: ValidatorReadiness;
}

export interface ValidatorGenerateResponse {
  doc: string;
}
