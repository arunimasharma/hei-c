import { useEffect, useRef } from 'react';
import type { UserProfile, MicroAction, TasteExercise, DecisionLog } from '../types';
import {
  upsertProfile,
  upsertTasteExercise,
  upsertMicroAction,
  bulkUpsertMicroActions,
  upsertDecision,
} from '../services/supabaseSync';

// Minimal local types — avoids a circular dependency with AppContext.tsx.
interface SyncableState {
  user: UserProfile | null;
  actions: MicroAction[];
  decisions: DecisionLog[];
}

type SyncableAction =
  | { type: 'SET_USER' | 'UPDATE_USER' }
  | { type: 'ADD_TASTE_EXERCISE'; payload: TasteExercise }
  | { type: 'COMPLETE_ACTION' | 'SKIP_ACTION' | 'APPROVE_ACTION' | 'START_ACTION' | 'SNOOZE_ACTION'; payload: string }
  | { type: 'SET_ACTIONS' }
  | { type: 'ADD_DECISION'; payload: DecisionLog }
  | { type: 'RESOLVE_DECISION'; payload: { id: string } }
  | { type: string };

/**
 * Fires non-blocking Supabase upserts in response to AppContext dispatches.
 * Mirrors the existing persistMutation pattern but targets the remote DB.
 * Errors are logged and never thrown — the app stays functional offline.
 */
export function useSupabaseSync(
  state: SyncableState,
  action: SyncableAction | null,
  userId: string | null,
): void {
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!action || !userId) return;

    const sync = async () => {
      try {
        switch (action.type) {
          case 'SET_USER':
          case 'UPDATE_USER':
            if (stateRef.current.user) {
              await upsertProfile(stateRef.current.user, userId);
            }
            break;

          case 'ADD_TASTE_EXERCISE':
            await upsertTasteExercise((action as { type: string; payload: TasteExercise }).payload, userId);
            break;

          case 'COMPLETE_ACTION':
          case 'SKIP_ACTION':
          case 'APPROVE_ACTION':
          case 'START_ACTION':
          case 'SNOOZE_ACTION': {
            const id = (action as { type: string; payload: string }).payload;
            const a = stateRef.current.actions.find(x => x.id === id);
            if (a) await upsertMicroAction(a, userId);
            break;
          }

          case 'SET_ACTIONS':
            await bulkUpsertMicroActions(stateRef.current.actions, userId);
            break;

          case 'ADD_DECISION':
            await upsertDecision((action as { type: string; payload: DecisionLog }).payload, userId);
            break;

          case 'RESOLVE_DECISION': {
            const id = (action as { type: string; payload: { id: string } }).payload.id;
            const d = stateRef.current.decisions.find(x => x.id === id);
            if (d) await upsertDecision(d, userId);
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.warn('[HEQ] Supabase sync error', err);
      }
    };

    void sync();
  }); // runs after every render, same as persistMutation
}
