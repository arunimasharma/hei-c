import type { AppState } from '../context/AppContext';
import { bulkUpsertTasteExercises, bulkUpsertMicroActions, upsertProfile } from './supabaseSync';

const MIGRATION_FLAG = 'heq_migrated_to_supabase_v1';

interface MigrationResult {
  migrated: boolean;
  exerciseCount: number;
  actionCount: number;
}

/**
 * One-time upload of existing local Dexie data to Supabase.
 * Idempotent — safe to call multiple times; skipped once the flag is set for this user.
 * The flag stores the Supabase user UUID so a different user on the same device
 * gets their own migration run.
 */
export async function migrateToSupabase(
  userId: string,
  state: AppState,
): Promise<MigrationResult> {
  const existingFlag = localStorage.getItem(MIGRATION_FLAG);
  if (existingFlag === userId) {
    return { migrated: false, exerciseCount: 0, actionCount: 0 };
  }

  const exercises = state.tasteExercises.map(e => ({ ...e, userId }));
  const actions = state.actions;

  await Promise.all([
    bulkUpsertTasteExercises(exercises, userId),
    bulkUpsertMicroActions(actions, userId),
    state.user ? upsertProfile({ ...state.user, id: userId }, userId) : Promise.resolve(),
  ]);

  localStorage.setItem(MIGRATION_FLAG, userId);

  return {
    migrated: true,
    exerciseCount: exercises.length,
    actionCount: actions.length,
  };
}
