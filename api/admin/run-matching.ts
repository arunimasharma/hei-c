import type { VercelRequest, VercelResponse } from '@vercel/node';
import { service, requireUser, isAdminEmail, callClaudeJson } from '../_lib/server';
import { MatchRationaleSchema } from '../_lib/schemas';
import { rowToProfile, type MemberProfileRow } from '../../src/services/drilloop/rows';
import {
  runMatching, pairKey, DEFAULT_MATCH_CONFIG,
  type CandidateMember, type PairHistory, type ScoredPair,
} from '../../src/services/matching/engine';
import type { PhaseStrength } from '../../src/types/connect';

// POST /api/admin/run-matching — manual matching run (ARCHITECTURE.md §6/§7).
// Admin/creator only. The same core runs under Cron later with no change.

interface PhaseStrengthRow { user_id: string; phase: number; attempts: number; avg_score: number | null; mastery: number }

function summarize(m: CandidateMember): string {
  const goals = m.profile.goals.slice(0, 3).map(g => g.text);
  const offering = m.profile.offeringTags.slice(0, 4).map(t => t.tag);
  const seeking = m.profile.seekingTags.slice(0, 4).map(t => t.tag);
  const strong = m.phaseStrengths.filter(p => p.mastery >= 70).map(p => `phase ${p.phase}`);
  const weak = m.phaseStrengths.filter(p => p.attempts > 0 && p.mastery <= 40).map(p => `phase ${p.phase}`);
  return [
    goals.length ? `goals: ${goals.join('; ')}` : '',
    offering.length ? `can offer: ${offering.join(', ')}` : '',
    seeking.length ? `seeking: ${seeking.join(', ')}` : '',
    strong.length ? `strong in: ${strong.join(', ')}` : '',
    weak.length ? `still building: ${weak.join(', ')}` : '',
  ].filter(Boolean).join(' | ') || 'active member';
}

/** Ask Claude for richer rationales for the selected pairs. Falls back to base rationale. */
async function enrichRationales(
  selected: ScoredPair[],
  byId: Map<string, CandidateMember>,
): Promise<{ map: Map<string, { rationale: string; confidence: number }>; usage: { inputTokens: number; outputTokens: number; costUsd: number } }> {
  const map = new Map<string, { rationale: string; confidence: number }>();
  if (selected.length === 0) return { map, usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } };

  const lines = selected.map((p, i) => {
    const a = byId.get(p.memberAId)!;
    const b = byId.get(p.memberBId)!;
    return `pair ${i}: [${p.matchType}] PERSON A — ${summarize(a)} ;; PERSON B — ${summarize(b)}`;
  });
  const system = [
    'You write short, warm, specific rationales for why two members of a PM learning community should meet.',
    'For each pair, write 1-2 sentences a member would actually find compelling — name the concrete reason (complementary strengths, or aligned goals where one offers what the other seeks). No names, no fluff.',
    'Return ONLY minified JSON: {"rationales":[{"pairId":"<index>","rationale":"","matchType":"knowledge_complement|goal_aligned|mixed","confidence":0.0-1.0}]}',
  ].join('\n');

  try {
    const { value, usage } = await callClaudeJson({
      system,
      user: `Pairs:\n${lines.join('\n')}\n\nWrite a rationale for each. pairId is the index (0-based). Return only JSON.`,
      schema: MatchRationaleSchema,
      maxTokens: 1200,
    });
    for (const r of value.rationales) map.set(String(r.pairId), { rationale: r.rationale, confidence: r.confidence });
    return { map, usage };
  } catch (e) {
    console.error('[run-matching] rationale enrichment failed, using base rationales:', e instanceof Error ? e.message : e);
    return { map, usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const sb = service();
  if (!sb) { res.status(503).json({ error: 'Service not configured.' }); return; }
  const user = await requireUser(req, sb);
  if (!isAdminEmail(user?.email)) { res.status(403).json({ error: 'Admin access required.' }); return; }

  const cfg = DEFAULT_MATCH_CONFIG;

  // Open a run row for observability.
  const { data: run, error: runErr } = await sb
    .from('matching_runs')
    .insert({ trigger_type: 'manual', triggered_by: user!.id, status: 'running' })
    .select('*').single();
  if (runErr || !run) { res.status(500).json({ error: 'Could not start run.' }); return; }

  try {
    // 1. opted-in members + their profiles
    const { data: profileRows } = await sb.from('member_profiles').select('*').eq('matching_opt_in', true);
    const profiles = (profileRows as MemberProfileRow[] ?? []).map(rowToProfile);
    const memberIds = profiles.map(p => p.userId);

    // 2. phase strengths for those members
    const { data: psRows } = await sb.from('phase_strengths').select('*').in('user_id', memberIds.length ? memberIds : ['']);
    const psByUser = new Map<string, PhaseStrength[]>();
    for (const r of (psRows as PhaseStrengthRow[] ?? [])) {
      const list = psByUser.get(r.user_id) ?? [];
      list.push({ userId: r.user_id, phase: r.phase, attempts: r.attempts, avgScore: r.avg_score, mastery: r.mastery });
      psByUser.set(r.user_id, list);
    }

    // 3. existing matches → pair history (cooldown/active) + lifetime suggestion counts
    const { data: existing } = await sb.from('matches').select('member_a_id, member_b_id, status, generated_at');
    const history = new Map<string, PairHistory>();
    const lifetime = new Map<string, number>();
    for (const m of (existing ?? []) as Array<{ member_a_id: string; member_b_id: string; status: string; generated_at: string }>) {
      const key = pairKey(m.member_a_id, m.member_b_id);
      const h = history.get(key) ?? {};
      if (m.status === 'suggested' || m.status === 'accepted') h.active = true;
      if (m.status === 'declined') h.lastDeclinedAt = m.generated_at; // approx (no updated_at column)
      history.set(key, h);
      lifetime.set(m.member_a_id, (lifetime.get(m.member_a_id) ?? 0) + 1);
      lifetime.set(m.member_b_id, (lifetime.get(m.member_b_id) ?? 0) + 1);
    }
    const { data: conns } = await sb.from('connections').select('member_a_id, member_b_id');
    for (const c of (conns ?? []) as Array<{ member_a_id: string; member_b_id: string }>) {
      const key = pairKey(c.member_a_id, c.member_b_id);
      history.set(key, { ...(history.get(key) ?? {}), active: true });
    }

    const members: CandidateMember[] = profiles.map(p => ({
      userId: p.userId,
      profile: p,
      phaseStrengths: psByUser.get(p.userId) ?? [],
      lifetimeSuggestions: lifetime.get(p.userId) ?? 0,
    }));
    const byId = new Map(members.map(m => [m.userId, m]));

    // 4. deterministic scoring + guardrails
    const selected = runMatching(members, history, cfg, Date.now());

    // 5. LLM-enriched rationales (with base-rationale fallback)
    const { map: enriched, usage } = await enrichRationales(selected, byId);

    // 6. persist matches
    const expiresAt = new Date(Date.now() + cfg.expiresInDays * 86_400_000).toISOString();
    const rows = selected.map((p, i) => {
      const e = enriched.get(String(i));
      return {
        run_id: run.id,
        member_a_id: p.memberAId,
        member_b_id: p.memberBId,
        rationale: e?.rationale ?? p.rationale,
        match_type: p.matchType,
        confidence: e?.confidence ?? Math.min(1, p.score),
        expires_at: expiresAt,
      };
    });
    if (rows.length) {
      const { error: insErr } = await sb.from('matches').insert(rows);
      if (insErr) throw new Error(`insert matches: ${insErr.message}`);
    }

    await sb.from('matching_runs').update({
      status: 'success', finished_at: new Date().toISOString(),
      members_considered: members.length, matches_generated: rows.length,
      claude_input_tokens: usage.inputTokens, claude_output_tokens: usage.outputTokens, cost_usd: usage.costUsd,
    }).eq('id', run.id);

    res.status(200).json({ runId: run.id, membersConsidered: members.length, matchesGenerated: rows.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[run-matching] failed:', message);
    await sb.from('matching_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error: message }).eq('id', run.id);
    res.status(500).json({ error: 'Matching run failed.', detail: message });
  }
}
