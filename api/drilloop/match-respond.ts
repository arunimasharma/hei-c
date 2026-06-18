import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guardPost } from '../_lib/server';
import { buildMatchView, type MatchRow } from '../_lib/matchView';
import type { MatchSideStatus } from '../../src/types/connect';

// POST /api/drilloop/match-respond — a member accepts/declines/snoozes THEIR
// side of a match. Only the viewer's own side is mutable. On mutual accept we
// create the tracked connection. Body: { matchId, action: accept|decline|snooze }

const SNOOZE_DAYS = 7;

function overallStatus(a: MatchSideStatus, b: MatchSideStatus): string {
  if (a === 'declined' || b === 'declined') return 'declined';
  if (a === 'accepted' && b === 'accepted') return 'accepted';
  if (a === 'snoozed' || b === 'snoozed') return 'snoozed';
  return 'suggested';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const guard = await guardPost(req, res);
  if (!guard) return;
  const { sb, user } = guard;

  const { matchId, action } = (req.body ?? {}) as { matchId?: string; action?: string };
  if (!matchId || !['accept', 'decline', 'snooze'].includes(action ?? '')) {
    res.status(400).json({ error: 'matchId and a valid action are required.' });
    return;
  }

  const { data: row, error } = await sb.from('matches').select('*').eq('id', matchId).maybeSingle();
  if (error || !row) { res.status(404).json({ error: 'Match not found.' }); return; }
  const m = row as MatchRow;

  if (user.id !== m.member_a_id && user.id !== m.member_b_id) {
    res.status(403).json({ error: 'Not your match.' });
    return;
  }
  const side: 'a' | 'b' = user.id === m.member_a_id ? 'a' : 'b';
  const newStatus: MatchSideStatus = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'snoozed';

  const aStatus = side === 'a' ? newStatus : m.a_status;
  const bStatus = side === 'b' ? newStatus : m.b_status;
  const snoozedUntil = action === 'snooze'
    ? new Date(Date.now() + SNOOZE_DAYS * 86_400_000).toISOString()
    : m.snoozed_until;

  const { data: updated, error: upErr } = await sb
    .from('matches')
    .update({ a_status: aStatus, b_status: bStatus, status: overallStatus(aStatus, bStatus), snoozed_until: snoozedUntil })
    .eq('id', matchId)
    .select('*')
    .single();
  if (upErr) {
    console.error('[drilloop/match-respond] update error:', upErr.message);
    res.status(500).json({ error: 'Could not update match.' });
    return;
  }

  // Mutual accept → create the tracked connection (idempotent via unique match_id).
  if (aStatus === 'accepted' && bStatus === 'accepted') {
    const { error: cErr } = await sb.from('connections').insert({
      match_id: m.id, member_a_id: m.member_a_id, member_b_id: m.member_b_id,
    });
    if (cErr && !cErr.message.includes('duplicate')) {
      console.error('[drilloop/match-respond] connection insert error:', cErr.message);
    }
  }

  const view = await buildMatchView(sb, user.id, updated as MatchRow);
  res.status(200).json(view);
}
