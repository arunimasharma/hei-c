import { useEffect, useRef } from 'react';
import type { AppState, Action } from '../context/AppContext';
import {
  upsertProfile,
  upsertTasteExercise,
  upsertMicroAction,
  bulkUpsertMicroActions,
} from '../services/supabaseSync';

/**
 * Fires non-blocking Supabase upserts in response to AppContext dispatches.
 * Mirrors the existing persistMutation pattern but targets the remote DB.
 * Errors are logged and never thrown — the app stays functional offline.
 */
export function useSupabaseSync(
  state: AppState,
  action: Action | null,
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
            await upsertTasteExercise(action.payload, userId);
            break;

          case 'COMPLETE_ACTION':
          case 'SKIP_ACTION':
          case 'APPROVE_ACTION':
          case 'START_ACTION':
          case 'SNOOZE_ACTION': {
            const a = stateRef.current.actions.find(x => x.id === action.payload);
            if (a) await upsertMicroAction(a, userId);
            break;
          }

          case 'SET_ACTIONS':
            await bulkUpsertMicroActions(stateRef.current.actions, userId);
            break;

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
