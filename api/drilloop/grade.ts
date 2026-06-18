import type { VercelRequest, VercelResponse } from '@vercel/node';
import { guardPost, callClaudeJson } from '../_lib/server';
import { GradeSchema } from '../_lib/schemas';
import { rowToDrill, type DrillRow } from '../../src/services/drilloop/rows';
import { heuristicGrade } from '../../src/services/drilloop/heuristic';
import type { Drill } from '../../src/types/drilloop';

// POST /api/drilloop/grade — grade a knowledge-drill answer server-side and
// persist the attempt. The client never scores its own answer.
// Body: { drillId, answer, selfRating }

function systemPrompt(): string {
  return [
    'You are the grading layer for "Drilloop", a learning membership that drills experienced PMs on Agentic AI and AI product judgment.',
    "Score a member's free-text answer against the creator's rubric (key points a strong answer hits).",
    'Be a generous-but-honest coach: reward genuine understanding even when wording differs, but do not credit points the answer never makes.',
    'Return ONLY minified JSON: {"score":<0-100 integer>,"feedback":"<2-3 sentence coaching, second person>","strengths":["<rubric point hit>"],"gaps":["<rubric point missed>"]}',
  ].join('\n');
}

function userPrompt(drill: Drill, answer: string): string {
  return [
    `DRILL: ${drill.title}`,
    `QUESTION: ${drill.prompt}`,
    '',
    'RUBRIC:',
    ...drill.keyPoints.map((p, i) => `${i + 1}. ${p}`),
    '',
    'REFERENCE ANSWER (for your judgment, not to parrot back):',
    drill.modelAnswer,
    '',
    "MEMBER'S ANSWER:",
    answer.trim() || '(left blank)',
    '',
    'Grade it. Return only the JSON.',
  ].join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const guard = await guardPost(req, res);
  if (!guard) return;
  const { sb, user } = guard;

  const { drillId, answer, selfRating } = (req.body ?? {}) as {
    drillId?: string; answer?: string; selfRating?: string;
  };
  if (!drillId || typeof answer !== 'string') {
    res.status(400).json({ error: 'drillId and answer are required.' });
    return;
  }
  const rating = ['nailed', 'partial', 'missed'].includes(selfRating ?? '') ? selfRating! : 'partial';

  const { data: drillRow, error: drillErr } = await sb.from('drills').select('*').eq('id', drillId).maybeSingle();
  if (drillErr || !drillRow) { res.status(404).json({ error: 'Drill not found.' }); return; }
  if ((drillRow as DrillRow).kind !== 'knowledge') {
    res.status(400).json({ error: 'This endpoint grades knowledge drills only.' });
    return;
  }
  const drill = rowToDrill(drillRow as DrillRow);

  // AI grade with validated JSON; fall back to the transparent heuristic on failure.
  let score: number, feedback: string, strengths: string[], gaps: string[], aiGraded: boolean;
  try {
    const { value } = await callClaudeJson({
      system: systemPrompt(),
      user: userPrompt(drill, answer),
      schema: GradeSchema,
      maxTokens: 700,
    });
    score = Math.round(value.score);
    feedback = value.feedback;
    strengths = value.strengths.slice(0, 6);
    gaps = value.gaps.slice(0, 6);
    aiGraded = true;
  } catch (e) {
    console.error('[drilloop/grade] AI grade failed, using heuristic:', e instanceof Error ? e.message : e);
    const h = heuristicGrade(drill, answer);
    ({ score, feedback, strengths, gaps, aiGraded } = h);
  }

  const day = new Date().toISOString().slice(0, 10);
  const { data: inserted, error: insErr } = await sb
    .from('drill_attempts')
    .insert({
      user_id: user.id,
      drill_id: drill.id,
      kind: 'knowledge',
      phase: drill.phase,
      answer,
      self_rating: rating,
      ai_score: score,
      ai_feedback: feedback,
      grade: { strengths, gaps, aiGraded },
      day,
    })
    .select('*')
    .single();

  if (insErr) {
    console.error('[drilloop/grade] insert error:', insErr.message);
    res.status(500).json({ error: 'Failed to record attempt.' });
    return;
  }

  res.status(200).json(inserted);
}
