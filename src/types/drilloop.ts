// ── Drilloop — types ──
// A creator-led subscription learning membership. Members complete short daily
// drills tied to a creator's content (here: Agentic AI & AI Product Judgment),
// get feedback, and see a visible path to improvement. The creator gets a
// recurring-revenue membership and signal on what to teach next.

/** The kind of practice a drill demands. */
export type DrillType = 'judgment' | 'recall' | 'scenario';

export type DrillDifficulty = 'core' | 'stretch' | 'mastery';

/** One repeatable practice unit, tied to a phase of the creator's study plan. */
export interface Drill {
  id: string;
  /** 0-8 — maps to the study-plan phase the drill drills. */
  phase: number;
  phaseTitle: string;
  /** Stable sequence order across the whole program. */
  order: number;
  type: DrillType;
  difficulty: DrillDifficulty;
  title: string;
  /** The question the member must answer in their own words. */
  prompt: string;
  /** Rubric — the points a strong answer hits. Used for grading + self-assessment. */
  keyPoints: string[];
  /** The creator's reference answer, revealed after the member commits theirs. */
  modelAnswer: string;
  tags: string[];
  /** Free preview drills are visible to non-members (the "demonstrate value" rung). */
  isSample?: boolean;
  /** Content linking — the free post/video this drill sends members to practice from. */
  sourceUrl?: string;
  sourceLabel?: string;
  /** True if the creator authored this in-app (vs. seeded program content). */
  authored?: boolean;
}

/** A draft drill produced by the AI authoring tool, before the creator publishes it. */
export interface DrillDraft {
  title: string;
  type: DrillType;
  difficulty: DrillDifficulty;
  prompt: string;
  keyPoints: string[];
  modelAnswer: string;
}

/** How confident the member felt after seeing the model answer. */
export type SelfRating = 'nailed' | 'partial' | 'missed';

/** Result of the LLM grading layer scoring an answer against the rubric. */
export interface DrillGrade {
  /** 0-100. */
  score: number;
  /** Short coaching paragraph. */
  feedback: string;
  /** Rubric points the answer hit. */
  strengths: string[];
  /** Rubric points the answer missed. */
  gaps: string[];
  /** True when scored by the LLM; false when the offline heuristic fallback ran. */
  aiGraded: boolean;
}

/** A completed attempt at a drill. The core unit the loop is built on. */
export interface DrillAttempt {
  drillId: string;
  phase: number;
  /** ISO timestamp. */
  completedAt: string;
  /** YYYY-MM-DD of completion, for streak + daily logic. */
  day: string;
  answer: string;
  selfRating: SelfRating;
  /** 0-100 if graded, else null. */
  aiScore: number | null;
  aiFeedback: string | null;
  /** Full grade payload when the grading layer ran. */
  grade?: DrillGrade;
}

/** Lightweight post-drill signal, routed to the creator's insight dashboard. */
export type FeedbackTag = 'useful' | 'confusing' | 'too-easy' | 'too-hard';

export interface DrillFeedback {
  id: string;
  drillId: string;
  tag: FeedbackTag;
  note: string;
  at: string;
}

/** Membership tier — drives the free→paid value ladder. */
export type MembershipTier = 'free' | 'member';

export interface DrilloopState {
  tier: MembershipTier;
  /** ISO timestamp the member upgraded, null while free. */
  joinedAt: string | null;
  /** How many free drills have been spent (free tier is capped). */
  freeDrillsUsed: number;
  attempts: DrillAttempt[];
  /** Post-drill feedback the member has left, routed to the creator. */
  feedback: DrillFeedback[];
  /** Recognition the member has earned. */
  shoutouts: Shoutout[];
  /** Member-facing display name for the leaderboard / shoutouts. */
  memberName: string;
}

/** A recognition event — the loop's status/community reward. */
export interface Shoutout {
  id: string;
  label: string;
  detail: string;
  earnedAt: string;
  emoji: string;
}

/** Per-phase mastery, derived from attempts. */
export interface PhaseProgress {
  phase: number;
  phaseTitle: string;
  total: number;
  completed: number;
  /** Average self-rating mapped to 0-100. */
  mastery: number;
}

/** The aggregate the member + creator dashboards read from. */
export interface DrilloopMetrics {
  totalDrills: number;
  completedDrills: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  /** % of attempts the member rated 'nailed'. A proxy for judgment improving. */
  masteryRate: number;
  /** Trend of mastery: first-half vs second-half of attempts. */
  improvement: number;
  daysActive: number;
  phaseProgress: PhaseProgress[];
}

// ── Creator-facing insight types ──

/** Per-drill performance, the row the creator's insight dashboard renders. */
export interface DrillInsight {
  drillId: string;
  title: string;
  phase: number;
  attempts: number;
  /** Members who completed / members who started. */
  completionRate: number;
  avgScore: number;
  /** Share of attempts the member struggled with (rated/scored low). */
  struggleRate: number;
  /** LLM/heuristic-clustered common gaps across wrong answers. */
  commonGaps: string[];
}

/** A leaderboard row — the shoutout/recognition surface. */
export interface LeaderRow {
  name: string;
  drillsCompleted: number;
  streak: number;
  masteryRate: number;
  /** True for the real local member (vs. demo cohort rows). */
  isYou: boolean;
}

/** The aggregate the creator dashboard reads from. */
export interface CreatorInsights {
  activeMembers: number;
  paidMembers: number;
  totalAttempts: number;
  avgCompletionRate: number;
  avgScore: number;
  drillInsights: DrillInsight[];
  leaderboard: LeaderRow[];
  recentFeedback: DrillFeedback[];
}
