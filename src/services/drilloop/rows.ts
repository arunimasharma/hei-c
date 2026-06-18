import type { Drill, DrillAttempt, SelfRating } from '../../types/drilloop';
import type {
  MemberProfile,
  WeightedTag,
  WeightedGoal,
  ProfileVisibility,
} from '../../types/connect';
import { DEFAULT_VISIBILITY } from '../../types/connect';

// ── DB row shapes (snake_case) and mappers to the camelCase app types ──
// One place that knows the Postgres column names, so the rest of the app speaks
// in domain types. Shared by the client repository and the server endpoints.

export interface DrillRow {
  id: string;
  slug: string | null;
  kind: 'knowledge' | 'profile';
  format: 'judgment' | 'recall' | 'scenario' | null;
  phase: number;
  phase_title: string | null;
  drill_order: number;
  difficulty: 'core' | 'stretch' | 'mastery' | null;
  title: string;
  prompt: string;
  key_points: string[];
  model_answer: string | null;
  tags: string[];
  is_sample: boolean;
  source_url: string | null;
  source_label: string | null;
  author_id: string | null;
  is_published: boolean;
  created_at: string;
}

export function rowToDrill(r: DrillRow): Drill {
  return {
    id: r.id,
    kind: r.kind,
    phase: r.phase,
    phaseTitle: r.phase_title ?? '',
    order: r.drill_order,
    type: r.format ?? 'judgment',
    difficulty: r.difficulty ?? 'core',
    title: r.title,
    prompt: r.prompt,
    keyPoints: r.key_points ?? [],
    modelAnswer: r.model_answer ?? '',
    tags: r.tags ?? [],
    isSample: r.is_sample,
    sourceUrl: r.source_url ?? undefined,
    sourceLabel: r.source_label ?? undefined,
    authored: r.author_id != null,
  };
}

export interface AttemptRow {
  id: string;
  user_id: string;
  drill_id: string;
  kind: 'knowledge' | 'profile';
  phase: number;
  answer: string;
  self_rating: SelfRating | null;
  ai_score: number | null;
  ai_feedback: string | null;
  grade: { strengths?: string[]; gaps?: string[]; aiGraded?: boolean } | null;
  completed_at: string;
  day: string;
}

export function rowToAttempt(r: AttemptRow): DrillAttempt {
  return {
    drillId: r.drill_id,
    phase: r.phase,
    completedAt: r.completed_at,
    day: r.day,
    answer: r.answer,
    selfRating: (r.self_rating ?? 'partial') as SelfRating,
    aiScore: r.ai_score,
    aiFeedback: r.ai_feedback,
    grade: r.grade
      ? {
          score: r.ai_score ?? 0,
          feedback: r.ai_feedback ?? '',
          strengths: r.grade.strengths ?? [],
          gaps: r.grade.gaps ?? [],
          aiGraded: r.grade.aiGraded ?? false,
        }
      : undefined,
  };
}

export interface MemberProfileRow {
  user_id: string;
  goals: WeightedGoal[];
  interests: WeightedGoal[];
  expertise_tags: WeightedTag[];
  seeking_tags: WeightedTag[];
  offering_tags: WeightedTag[];
  seniority_signal: string | null;
  summary: string | null;
  matching_opt_in: boolean;
  visibility: ProfileVisibility | null;
  last_updated: string;
}

export function rowToProfile(r: MemberProfileRow): MemberProfile {
  return {
    userId: r.user_id,
    goals: r.goals ?? [],
    interests: r.interests ?? [],
    expertiseTags: r.expertise_tags ?? [],
    seekingTags: r.seeking_tags ?? [],
    offeringTags: r.offering_tags ?? [],
    senioritySignal: r.seniority_signal,
    summary: r.summary,
    matchingOptIn: r.matching_opt_in,
    visibility: r.visibility ?? { ...DEFAULT_VISIBILITY },
    lastUpdated: r.last_updated,
  };
}

export function profileToRow(p: MemberProfile): MemberProfileRow {
  return {
    user_id: p.userId,
    goals: p.goals,
    interests: p.interests,
    expertise_tags: p.expertiseTags,
    seeking_tags: p.seekingTags,
    offering_tags: p.offeringTags,
    seniority_signal: p.senioritySignal,
    summary: p.summary,
    matching_opt_in: p.matchingOptIn,
    visibility: p.visibility,
    last_updated: p.lastUpdated,
  };
}
