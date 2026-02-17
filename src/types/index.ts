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
  suggestedFor?: EmotionType[];
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
