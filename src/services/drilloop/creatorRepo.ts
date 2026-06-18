import { supabase } from '../../lib/supabaseClient';
import type { MatchingRun } from '../../types/connect';

// ── Creator Studio data (aggregate, server-computed) ──
// Reads the anonymized creator_insights_* views (RLS: staff only) and triggers
// matching runs. No individual member's private profile is ever read here.

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export interface NetworkInsights {
  totalMatches: number;
  totalConnections: number;
  acceptanceRate: number | null;
  topMatchType: string | null;
  poolSize: number;
}

export interface DrillStruggle {
  drillId: string;
  title: string;
  phase: number;
  attempts: number;
  avgScore: number | null;
  struggleRate: number | null;
}

export async function getNetworkInsights(): Promise<NetworkInsights> {
  const { data, error } = await db().from('creator_insights_network').select('*').maybeSingle();
  if (error) throw error;
  return {
    totalMatches: data?.total_matches ?? 0,
    totalConnections: data?.total_connections ?? 0,
    acceptanceRate: data?.acceptance_rate ?? null,
    topMatchType: data?.top_match_type ?? null,
    poolSize: data?.pool_size ?? 0,
  };
}

export async function getDrillStruggles(): Promise<DrillStruggle[]> {
  const { data, error } = await db().from('creator_insights_drills').select('*');
  if (error) throw error;
  return (data ?? []).map(d => ({
    drillId: d.drill_id, title: d.title, phase: d.phase,
    attempts: d.attempts, avgScore: d.avg_score, struggleRate: d.struggle_rate,
  }));
}

export async function getMatchingRuns(limit = 5): Promise<MatchingRun[]> {
  const { data, error } = await db()
    .from('matching_runs').select('*').order('started_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(r => ({
    id: r.id, triggerType: r.trigger_type, triggeredBy: r.triggered_by,
    startedAt: r.started_at, finishedAt: r.finished_at, status: r.status,
    membersConsidered: r.members_considered, matchesGenerated: r.matches_generated,
    error: r.error, claudeInputTokens: r.claude_input_tokens,
    claudeOutputTokens: r.claude_output_tokens, costUsd: r.cost_usd,
  }));
}

export async function triggerMatchingRun(): Promise<{ runId: string; membersConsidered: number; matchesGenerated: number }> {
  const { data: { session } } = await db().auth.getSession();
  const res = await fetch('/api/admin/run-matching', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Matching run failed (${res.status}): ${body}`);
  }
  return res.json();
}
