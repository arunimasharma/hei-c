import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guardPost, callClaudeJson } from '../_lib/server';
import { ExtractionSchema } from '../_lib/schemas';
import { rowToDrill, rowToProfile, profileToRow, type DrillRow, type MemberProfileRow } from '../../src/services/drilloop/rows';
import { mergeProfile, emptyProfile } from '../../src/services/matching/profileMerge';
import type { Drill } from '../../src/types/drilloop';
import type { ProfileExtraction } from '../../src/types/connect';

// POST /api/drilloop/profile-extract — parse a profile-drill answer into
// structured signals and merge them into the member's evolving profile.
// Body: { drillId, answer }

function systemPrompt(): string {
  return [
    'You extract a structured professional profile from a member\'s free-text answer to a "profile drill" in Drilloop, a learning + networking membership for PMs.',
    'Pull out, where present: goals (what they\'re working toward), interests (topics/areas they explore), expertiseTags (what they can teach / are strong at), seekingTags (help/intros/skills they want), offeringTags (what they can offer others), and a short senioritySignal (e.g. "senior PM", "founder").',
    'Tags must be SHORT noun phrases (1-4 words), lowercase, deduplicated. Do not invent signals the answer does not support; return empty arrays when unsure.',
    'Return ONLY minified JSON: {"goals":[],"interests":[],"expertiseTags":[],"seekingTags":[],"offeringTags":[],"senioritySignal":null}',
  ].join('\n');
}

function userPrompt(drill: Drill, answer: string): string {
  return [
    `PROFILE DRILL: ${drill.prompt}`,
    '',
    "MEMBER'S ANSWER:",
    answer.trim() || '(left blank)',
    '',
    'Extract the profile signals. Return only the JSON.',
  ].join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const guard = await guardPost(req, res);
  if (!guard) return;
  const { sb, user } = guard;

  const { drillId, answer } = (req.body ?? {}) as { drillId?: string; answer?: string };
  if (!drillId || typeof answer !== 'string' || !answer.trim()) {
    res.status(400).json({ error: 'drillId and a non-empty answer are required.' });
    return;
  }

  const { data: drillRow, error: drillErr } = await sb.from('drills').select('*').eq('id', drillId).maybeSingle();
  if (drillErr || !drillRow) { res.status(404).json({ error: 'Drill not found.' }); return; }
  if ((drillRow as DrillRow).kind !== 'profile') {
    res.status(400).json({ error: 'This endpoint handles profile drills only.' });
    return;
  }
  const drill = rowToDrill(drillRow as DrillRow);

  let extraction: ProfileExtraction;
  try {
    const { value } = await callClaudeJson({
      system: systemPrompt(),
      user: userPrompt(drill, answer),
      schema: ExtractionSchema,
      maxTokens: 600,
    });
    extraction = {
      goals: value.goals, interests: value.interests,
      expertiseTags: value.expertiseTags, seekingTags: value.seekingTags,
      offeringTags: value.offeringTags, senioritySignal: value.senioritySignal ?? null,
    };
  } catch (e) {
    // No silent failure: extraction is the whole point of a profile drill.
    console.error('[drilloop/profile-extract] extraction failed:', e instanceof Error ? e.message : e);
    res.status(502).json({ error: 'Could not parse your answer into a profile. Please try again.' });
    return;
  }

  const now = new Date().toISOString();

  const { data: existing } = await sb.from('member_profiles').select('*').eq('user_id', user.id).maybeSingle();
  const current = existing ? rowToProfile(existing as MemberProfileRow) : emptyProfile(user.id, now);
  const merged = mergeProfile(current, extraction, now);

  const { error: upsertErr } = await sb.from('member_profiles').upsert(profileToRow(merged), { onConflict: 'user_id' });
  if (upsertErr) {
    console.error('[drilloop/profile-extract] upsert error:', upsertErr.message);
    res.status(500).json({ error: 'Failed to save profile.' });
    return;
  }

  // Record the attempt too (for cadence/history); profile drills aren't scored.
  await sb.from('drill_attempts').insert({
    user_id: user.id, drill_id: drill.id, kind: 'profile', phase: drill.phase,
    answer, self_rating: null, day: now.slice(0, 10),
  });

  res.status(200).json(merged);
}
