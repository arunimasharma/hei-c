// ── Drilloop — connection product types ──
// The data layer for profile drills, the derived member profile, and the
// matching engine. These mirror the Postgres schema in
// supabase/migrations/20260612_drilloop_core.sql (camelCase here, snake_case there).

// ── Member profile (derived, incrementally merged) ──

/** A signal whose strength decays unless reinforced by later profile drills. */
export interface WeightedTag {
  tag: string;
  /** 0..1 — reinforced on mention, decayed otherwise; pruned below a floor. */
  weight: number;
  /** ISO timestamp of the most recent mention. */
  lastSeen: string;
}

/** A goal/interest phrase carried with the same weight+decay treatment as tags. */
export interface WeightedGoal {
  text: string;
  weight: number;
  lastSeen: string;
}

/** What a matched counterpart may see, by match state. Enforced server-side. */
export interface ProfileVisibility {
  name: 'always' | 'mutual_accept';
  goals: 'always' | 'mutual_accept';
  contact: 'always' | 'mutual_accept' | 'never';
}

export const DEFAULT_VISIBILITY: ProfileVisibility = {
  name: 'always',
  goals: 'always',
  contact: 'mutual_accept',
};

/** The structured, evolving profile derived from a member's profile drills. */
export interface MemberProfile {
  userId: string;
  goals: WeightedGoal[];
  interests: WeightedGoal[];
  expertiseTags: WeightedTag[];
  seekingTags: WeightedTag[];
  offeringTags: WeightedTag[];
  senioritySignal: string | null;
  /** Human-readable summary that fuels match rationales. */
  summary: string | null;
  /** Opt-OUT default: members are in the pool unless they leave (ARCHITECTURE.md §8). */
  matchingOptIn: boolean;
  visibility: ProfileVisibility;
  lastUpdated: string;
}

/** Strict shape Claude must return when extracting a profile-drill answer. */
export interface ProfileExtraction {
  goals: string[];
  interests: string[];
  expertiseTags: string[];
  seekingTags: string[];
  offeringTags: string[];
  senioritySignal?: string | null;
}

// ── Phase strengths (from the phase_strengths SQL view) ──

export interface PhaseStrength {
  userId: string;
  phase: number;
  attempts: number;
  avgScore: number | null;
  /** 0..100, from self-ratings. */
  mastery: number;
}

// ── Matches & connections ──

export type MatchType = 'knowledge_complement' | 'goal_aligned' | 'mixed';
export type MatchSideStatus = 'suggested' | 'accepted' | 'declined' | 'snoozed';
export type MatchStatus = MatchSideStatus | 'expired';

export interface Match {
  id: string;
  runId: string | null;
  /** Canonical ordering: memberAId < memberBId. */
  memberAId: string;
  memberBId: string;
  rationale: string;
  matchType: MatchType;
  confidence: number | null;
  aStatus: MatchSideStatus;
  bStatus: MatchSideStatus;
  /** Overall, derived: 'accepted' once both accept; 'declined' if either declines. */
  status: MatchStatus;
  snoozedUntil: string | null;
  generatedAt: string;
  expiresAt: string;
}

export interface Connection {
  id: string;
  matchId: string;
  memberAId: string;
  memberBId: string;
  connectedAt: string;
  met: boolean | null;
  aOutcomeRating: number | null;
  bOutcomeRating: number | null;
  aOutcomeNote: string | null;
  bOutcomeNote: string | null;
  status: 'active' | 'archived';
}

/** Limited counterpart view returned to a member for a given match (visibility-gated). */
export interface MatchCounterpart {
  /** Only present when the counterpart's visibility allows it for this match state. */
  displayName: string | null;
  avatarUrl: string | null;
  goals: string[];
  /** Only after mutual accept, and only if the counterpart shares contact. */
  contact: string | null;
}

/** A match as surfaced to one member in the Connect tab. */
export interface MatchView {
  match: Match;
  /** Which side the viewer is ('a' | 'b'). */
  viewerSide: 'a' | 'b';
  /** The viewer's own status for this match. */
  viewerStatus: MatchSideStatus;
  counterpart: MatchCounterpart;
}

export interface MatchingRun {
  id: string;
  triggerType: 'manual' | 'scheduled';
  triggeredBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'success' | 'failed';
  membersConsidered: number;
  matchesGenerated: number;
  error: string | null;
  claudeInputTokens: number;
  claudeOutputTokens: number;
  costUsd: number;
}
