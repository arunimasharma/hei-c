import type { VercelRequest, VercelResponse } from '@vercel/node';
import { service, requireUser } from '../_lib/server';
import { buildMatchView, type MatchRow } from '../_lib/matchView';

// GET /api/drilloop/matches — the viewer's open suggestions + tracked
// connections, each with a visibility-gated counterpart view.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const sb = service();
  if (!sb) { res.status(503).json({ error: 'Service not configured.' }); return; }
  const user = await requireUser(req, sb);
  if (!user) { res.status(401).json({ error: 'Authentication required.' }); return; }

  const { data: matchRows, error: mErr } = await sb
    .from('matches')
    .select('*')
    .or(`member_a_id.eq.${user.id},member_b_id.eq.${user.id}`)
    .order('generated_at', { ascending: false });
  if (mErr) {
    console.error('[drilloop/matches] error:', mErr.message);
    res.status(500).json({ error: 'Could not load matches.' });
    return;
  }

  const matches = await Promise.all((matchRows as MatchRow[]).map(r => buildMatchView(sb, user.id, r)));

  const { data: connections } = await sb
    .from('connections')
    .select('*')
    .or(`member_a_id.eq.${user.id},member_b_id.eq.${user.id}`)
    .order('connected_at', { ascending: false });

  res.status(200).json({
    matches,
    connections: (connections ?? []).map(c => ({
      id: c.id, matchId: c.match_id, memberAId: c.member_a_id, memberBId: c.member_b_id,
      connectedAt: c.connected_at, met: c.met,
      aOutcomeRating: c.a_outcome_rating, bOutcomeRating: c.b_outcome_rating,
      aOutcomeNote: c.a_outcome_note, bOutcomeNote: c.b_outcome_note, status: c.status,
    })),
  });
}
