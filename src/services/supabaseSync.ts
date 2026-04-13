import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { UserProfile, TasteExercise, MicroAction, DecisionLog } from '../types';

// ── Column mapping helpers ────────────────────────────────────────────────────

function exerciseToRow(exercise: TasteExercise, userId: string) {
  return {
    id: exercise.id,
    user_id: userId,
    product_name: exercise.productName,
    answers: exercise.answers,
    summary: exercise.summary,
    score: exercise.score,
    score_comment: exercise.scoreComment,
    evaluation: exercise.evaluation ?? null,
    status: exercise.status,
    created_at: exercise.timestamp,
  };
}

function rowToExercise(row: Record<string, unknown>): TasteExercise {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    productName: row.product_name as string,
    answers: row.answers as TasteExercise['answers'],
    summary: row.summary as string,
    score: row.score as number,
    scoreComment: row.score_comment as string,
    evaluation: row.evaluation as TasteExercise['evaluation'],
    timestamp: row.created_at as string,
    status: 'completed',
  };
}

function actionToRow(action: MicroAction, userId: string) {
  return {
    id: action.id,
    user_id: userId,
    title: action.title,
    description: action.description,
    category: action.category,
    estimated_minutes: action.estimatedMinutes,
    completed: action.completed,
    completed_at: action.completedAt ?? null,
    in_progress: action.inProgress ?? false,
    skipped: action.skipped ?? false,
    approved: action.approved ?? false,
    snoozed: action.snoozed ?? false,
    suggested_for: action.suggestedFor ?? null,
    reasoning: action.reasoning ?? null,
    generated_at: action.generatedAt ?? null,
  };
}

function rowToAction(row: Record<string, unknown>): MicroAction {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    category: row.category as MicroAction['category'],
    estimatedMinutes: row.estimated_minutes as number,
    completed: row.completed as boolean,
    completedAt: row.completed_at as string | undefined,
    inProgress: row.in_progress as boolean | undefined,
    skipped: row.skipped as boolean | undefined,
    approved: row.approved as boolean | undefined,
    snoozed: row.snoozed as boolean | undefined,
    suggestedFor: row.suggested_for as MicroAction['suggestedFor'],
    reasoning: row.reasoning as string | undefined,
    generatedAt: row.generated_at as string | undefined,
  };
}

function profileToRow(profile: UserProfile, userId: string) {
  return {
    id: userId,
    name: profile.name,
    role: profile.role,
    goals: profile.goals ?? null,
    check_in_frequency: profile.checkInFrequency ?? 'as-needed',
    onboarding_complete: profile.onboardingComplete,
    created_at: profile.createdAt,
  };
}

function rowToProfile(row: Record<string, unknown>, supabaseUserId: string): UserProfile {
  return {
    id: supabaseUserId,
    name: row.name as string,
    role: row.role as string,
    goals: row.goals as string | undefined,
    checkInFrequency: row.check_in_frequency as UserProfile['checkInFrequency'],
    onboardingComplete: row.onboarding_complete as boolean,
    createdAt: row.created_at as string,
  };
}

// ── Single-record upserts ────────────────────────────────────────────────────

export async function upsertTasteExercise(exercise: TasteExercise, userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('taste_exercises')
    .upsert(exerciseToRow(exercise, userId), { onConflict: 'id' });
  if (error) throw error;
}

export async function upsertMicroAction(action: MicroAction, userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('micro_actions')
    .upsert(actionToRow(action, userId), { onConflict: 'id' });
  if (error) throw error;
}

export async function upsertProfile(profile: UserProfile, userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('profiles')
    .upsert(profileToRow(profile, userId), { onConflict: 'id' });
  if (error) throw error;
}

// ── Bulk upserts (used during migration) ─────────────────────────────────────

export async function bulkUpsertTasteExercises(exercises: TasteExercise[], userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || exercises.length === 0) return;
  const { error } = await supabase
    .from('taste_exercises')
    .upsert(exercises.map(e => exerciseToRow(e, userId)), { onConflict: 'id' });
  if (error) throw error;
}

export async function bulkUpsertMicroActions(actions: MicroAction[], userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || actions.length === 0) return;
  const { error } = await supabase
    .from('micro_actions')
    .upsert(actions.map(a => actionToRow(a, userId)), { onConflict: 'id' });
  if (error) throw error;
}

// ── Decision upsert ──────────────────────────────────────────────────────────

export async function upsertDecision(decision: DecisionLog, userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('decisions')
    .upsert({
      id: decision.id,
      user_id: userId,
      question: decision.question,
      deadline: decision.deadline ?? null,
      options: decision.options,
      ai_structured_brief: decision.aiStructuredBrief,
      chosen_option: decision.chosenOption ?? null,
      chosen_reason: decision.chosenReason ?? null,
      status: decision.status,
      created_at: decision.createdAt,
      decided_at: decision.decidedAt ?? null,
    }, { onConflict: 'id' });
  if (error) throw error;
}

// ── PM Graph evaluation sync ─────────────────────────────────────────────────

import type { PMGraphEvaluationRecord } from '../integrations/pmGraph/EvaluationStore';

/**
 * Upserts a single PM Graph evaluation record to Supabase.
 *
 * Expected Supabase table: `exercise_evaluations`
 * (schema definition in docs/integrations/pm-graph/adapter.md)
 *
 * Usage — fire-and-forget after EvaluationStore.save() resolves:
 *
 *   const record = await EvaluationStore.save(input);
 *   syncEvaluation(record).catch(console.warn); // non-blocking
 *
 * Call EvaluationStore.markSynced(record.id) on success and
 * EvaluationStore.markSyncError(record.id) on failure so that
 * sync_status stays accurate in IndexedDB.
 *
 * Silently no-ops when Supabase is not configured (local-only environments).
 */
export async function syncEvaluation(record: PMGraphEvaluationRecord): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  const row = {
    id:                      record.id,
    member_id:               record.member_id,
    hello_eq_exercise_id:    record.hello_eq_exercise_id,
    hello_eq_submission_id:  record.hello_eq_submission_id,
    exercise_type:           record.exercise_type,
    overall_score:           record.overall_score,
    dimension_scores:        record.dimension_scores,
    feedback:                record.feedback,
    top_missed_insights:     record.top_missed_insights,
    competing_stances:       record.competing_stances,
    contested:               record.contested,
    benchmark_surface:       record.benchmark_surface,
    graph_case_id:           record.graph_case_id,
    cluster_ids_used:        record.cluster_ids_used,
    rubric_version:          record.rubric_version,
    graph_version:           record.graph_version,
    // Explicit provenance timestamp — canonical scoring moment.
    evaluated_at:            record.evaluated_at,
    // Extended provenance fields (null when PM Graph does not return them).
    weights_used:            record.weights_used,
    rubric_profile:          record.rubric_profile,
    curation_version:        record.curation_version,
    scoring_engine_version:  record.scoring_engine_version,
    expert_tag_signals:      record.expert_tag_signals,
    credibility_event:       record.credibility_event,
    created_at:              record.created_at,
  };

  const { error } = await supabase
    .from('exercise_evaluations')
    .upsert(row, { onConflict: 'id' });

  if (error) throw error;
}

// ── Load all synced data for a user ──────────────────────────────────────────

const EMPTY_REMOTE = { profile: null, tasteExercises: [], microActions: [] };

export async function loadFromSupabase(userId: string): Promise<{
  profile: UserProfile | null;
  tasteExercises: TasteExercise[];
  microActions: MicroAction[];
}> {
  if (!isSupabaseConfigured || !supabase) return EMPTY_REMOTE;

  const [profileRes, exercisesRes, actionsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('taste_exercises').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('micro_actions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);

  return {
    profile: profileRes.data ? rowToProfile(profileRes.data as Record<string, unknown>, userId) : null,
    tasteExercises: (exercisesRes.data ?? []).map(r => rowToExercise(r as Record<string, unknown>)),
    microActions: (actionsRes.data ?? []).map(r => rowToAction(r as Record<string, unknown>)),
  };
}
