import { supabase } from '../../lib/supabaseClient';
import type { Drill, DrillAttempt, SelfRating, FeedbackTag } from '../../types/drilloop';
import type { MemberProfile, MatchView, Connection, ProfileVisibility } from '../../types/connect';
import {
  rowToDrill, rowToAttempt, rowToProfile,
  type DrillRow, type AttemptRow, type MemberProfileRow,
} from './rows';

// ── Drilloop data layer (client) ──
// Replaces the old localStorage stores. Member reads/writes go straight to
// Supabase under RLS (own rows / published drills). Trust-bearing operations —
// grading an answer, extracting a profile, generating/responding to matches —
// go through Vercel functions (service role), never written directly here.

function db() {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  return supabase;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const { data: { session } } = await db().auth.getSession();
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  return headers;
}

async function currentUserId(): Promise<string> {
  const { data: { user } } = await db().auth.getUser();
  if (!user) throw new Error('Not authenticated.');
  return user.id;
}

// ── Catalog ──

export async function getCatalog(): Promise<Drill[]> {
  const { data, error } = await db()
    .from('drills')
    .select('*')
    .eq('is_published', true)
    .order('phase', { ascending: true })
    .order('drill_order', { ascending: true });
  if (error) throw error;
  return (data as DrillRow[]).map(rowToDrill);
}

export async function getKnowledgeDrills(): Promise<Drill[]> {
  return (await getCatalog()).filter(d => (d.kind ?? 'knowledge') === 'knowledge');
}

export async function getProfileDrills(): Promise<Drill[]> {
  return (await getCatalog()).filter(d => d.kind === 'profile');
}

// ── Attempts ──

export async function getMyAttempts(): Promise<DrillAttempt[]> {
  const userId = await currentUserId();
  const { data, error } = await db()
    .from('drill_attempts')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });
  if (error) throw error;
  return (data as AttemptRow[]).map(rowToAttempt);
}

/**
 * Record a knowledge-drill answer, then ask the server to grade it. The server
 * writes ai_score/grade (the client never scores its own answer). Returns the
 * graded attempt.
 */
export async function submitKnowledgeAttempt(input: {
  drill: Drill;
  answer: string;
  selfRating: SelfRating;
}): Promise<DrillAttempt> {
  const res = await fetch('/api/drilloop/grade', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      drillId: input.drill.id,
      answer: input.answer,
      selfRating: input.selfRating,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Grading failed (${res.status}): ${body}`);
  }
  const row = (await res.json()) as AttemptRow;
  return rowToAttempt(row);
}

/**
 * Record a profile-drill answer; the server extracts structured signals and
 * merges them into the member profile. Returns the updated profile.
 */
export async function submitProfileAttempt(input: {
  drillId: string;
  answer: string;
}): Promise<MemberProfile> {
  const res = await fetch('/api/drilloop/profile-extract', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Profile extraction failed (${res.status}): ${body}`);
  }
  return (await res.json()) as MemberProfile;
}

export async function recordFeedback(drillId: string, tag: FeedbackTag, note: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await db().from('drill_feedback').insert({
    user_id: userId, drill_id: drillId, tag, note: note.trim(),
  });
  if (error) throw error;
}

// ── Member profile + matching preferences ──

export async function getMyProfile(): Promise<MemberProfile | null> {
  const userId = await currentUserId();
  const { data, error } = await db()
    .from('member_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as MemberProfileRow) : null;
}

/** Toggle inclusion in the matching pool (opt-out default — see ARCHITECTURE.md §8). */
export async function setMatchingOptIn(optIn: boolean): Promise<void> {
  const userId = await currentUserId();
  const { error } = await db()
    .from('member_profiles')
    .upsert({ user_id: userId, matching_opt_in: optIn, last_updated: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function setVisibility(visibility: ProfileVisibility): Promise<void> {
  const userId = await currentUserId();
  const { error } = await db()
    .from('member_profiles')
    .update({ visibility, last_updated: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw error;
}

/** Clear all derived profile data (member control — keeps the row + opt-in flag). */
export async function clearProfileData(): Promise<void> {
  const userId = await currentUserId();
  const { error } = await db()
    .from('member_profiles')
    .update({
      goals: [], interests: [], expertise_tags: [], seeking_tags: [], offering_tags: [],
      seniority_signal: null, summary: null, last_updated: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw error;
}

// ── Matches & connections (server-mediated for counterpart visibility) ──

export async function getMatches(): Promise<{ matches: MatchView[]; connections: Connection[] }> {
  const res = await fetch('/api/drilloop/matches', { headers: await authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Could not load connections (${res.status}): ${body}`);
  }
  return (await res.json()) as { matches: MatchView[]; connections: Connection[] };
}

export type MatchAction = 'accept' | 'decline' | 'snooze';

export async function respondToMatch(matchId: string, action: MatchAction): Promise<MatchView> {
  const res = await fetch('/api/drilloop/match-respond', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ matchId, action }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Could not update match (${res.status}): ${body}`);
  }
  return (await res.json()) as MatchView;
}
