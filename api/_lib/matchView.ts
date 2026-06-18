import type { SupabaseClient } from '@supabase/supabase-js';
import type { Match, MatchView, MatchCounterpart, MatchSideStatus } from '../../src/types/connect';
import { DEFAULT_VISIBILITY } from '../../src/types/connect';

// Builds the limited, visibility-gated view of a match for one viewer. This is
// the ONLY path by which one member sees anything about another — enforced
// server-side, never via cross-user RLS reads. (ARCHITECTURE.md §8)

export interface MatchRow {
  id: string;
  run_id: string | null;
  member_a_id: string;
  member_b_id: string;
  rationale: string;
  match_type: Match['matchType'];
  confidence: number | null;
  a_status: MatchSideStatus;
  b_status: MatchSideStatus;
  status: Match['status'];
  snoozed_until: string | null;
  generated_at: string;
  expires_at: string;
}

export function rowToMatch(r: MatchRow): Match {
  return {
    id: r.id, runId: r.run_id,
    memberAId: r.member_a_id, memberBId: r.member_b_id,
    rationale: r.rationale, matchType: r.match_type, confidence: r.confidence,
    aStatus: r.a_status, bStatus: r.b_status, status: r.status,
    snoozedUntil: r.snoozed_until, generatedAt: r.generated_at, expiresAt: r.expires_at,
  };
}

export async function buildMatchView(sb: SupabaseClient, viewerId: string, r: MatchRow): Promise<MatchView> {
  const match = rowToMatch(r);
  const viewerSide: 'a' | 'b' = viewerId === r.member_a_id ? 'a' : 'b';
  const viewerStatus = viewerSide === 'a' ? r.a_status : r.b_status;
  const counterpartId = viewerSide === 'a' ? r.member_b_id : r.member_a_id;
  const mutualAccepted = r.a_status === 'accepted' && r.b_status === 'accepted';

  const [{ data: cpProfile }, { data: cpBasics }] = await Promise.all([
    sb.from('member_profiles').select('goals, visibility').eq('user_id', counterpartId).maybeSingle(),
    sb.from('profiles').select('display_name, avatar_url, email').eq('id', counterpartId).maybeSingle(),
  ]);

  const visibility = (cpProfile?.visibility as typeof DEFAULT_VISIBILITY | null) ?? DEFAULT_VISIBILITY;
  const canSee = (rule: 'always' | 'mutual_accept' | 'never') =>
    rule === 'always' ? true : rule === 'mutual_accept' ? mutualAccepted : false;

  const goals = ((cpProfile?.goals as Array<{ text: string }> | null) ?? []).map(g => g.text);

  const counterpart: MatchCounterpart = {
    displayName: canSee(visibility.name) ? (cpBasics?.display_name ?? 'A member') : null,
    avatarUrl: canSee(visibility.name) ? (cpBasics?.avatar_url ?? null) : null,
    goals: canSee(visibility.goals) ? goals.slice(0, 5) : [],
    contact: mutualAccepted && canSee(visibility.contact) ? (cpBasics?.email ?? null) : null,
  };

  return { match, viewerSide, viewerStatus, counterpart };
}
