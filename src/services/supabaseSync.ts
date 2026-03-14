import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { UserProfile, TasteExercise, MicroAction } from '../types';

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
