/**
 * publicProfileSync.ts
 *
 * Opt-in sync of the public profile payload to Supabase.
 * Follows the fire-and-forget pattern used throughout the app.
 *
 * ─────────────────────────────────────────────────────────────
 * PRIVACY GUARANTEE
 * Only the following fields are ever written to Supabase:
 *   • credibility_score  (int, 0–100)
 *   • expert_tags        (string array)
 *   • proof_hash         (SHA-256 fingerprint)
 *   • public_slug        (user-chosen, no PII)
 *   • version / last_updated (metadata)
 *
 * Raw answers, journal entries, emotions, and all other
 * sensitive local data are NEVER sent to the network.
 * ─────────────────────────────────────────────────────────────
 */

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { PublicProfilePayload } from '../lib/publicProfile';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'live' | 'error' | 'offline';

// ── Persisted sync state ──────────────────────────────────────────────────────

const STATUS_KEY = 'heq_public_sync_status';

export function getSyncStatus(): SyncStatus {
  return (localStorage.getItem(STATUS_KEY) as SyncStatus) ?? 'idle';
}

function setSyncStatus(s: SyncStatus): void {
  localStorage.setItem(STATUS_KEY, s);
}

// ── Sync ──────────────────────────────────────────────────────────────────────

/**
 * Upserts the public profile row to Supabase.
 *
 * Behaviour:
 *   • No-op when Supabase is not configured (local-only mode)
 *   • Sets status to "offline" when navigator.onLine is false
 *   • Persists status to localStorage so the toggle UI survives page reloads
 *   • Never throws — all errors are caught and stored as status = "error"
 */
export async function syncPublicProfile(
  userId: string,
  slug: string,
  payload: PublicProfilePayload,
): Promise<SyncStatus> {
  if (!isSupabaseConfigured || !supabase) {
    setSyncStatus('offline');
    return 'offline';
  }

  if (!navigator.onLine) {
    setSyncStatus('offline');
    return 'offline';
  }

  setSyncStatus('syncing');

  try {
    const { error } = await supabase
      .from('public_profiles')
      .upsert(
        {
          user_id:           userId,
          public_slug:       slug,
          credibility_score: payload.credibilityScore,
          expert_tags:       payload.expertTags,
          proof_hash:        payload.proofHash,
          version:           payload.version,
          last_updated:      payload.lastUpdated,
        },
        { onConflict: 'user_id' },
      );

    if (error) throw error;
    setSyncStatus('live');
    return 'live';
  } catch {
    setSyncStatus('error');
    return 'error';
  }
}

/**
 * Deletes the public profile row, called when user disables sharing.
 * Silently fails — the user's local opt-out state is the source of truth.
 */
export async function removePublicProfile(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    await supabase.from('public_profiles').delete().eq('user_id', userId);
  } catch { /* silent — local state already reflects disabled */ }
  setSyncStatus('idle');
}
