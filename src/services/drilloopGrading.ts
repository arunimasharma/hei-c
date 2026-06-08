import type { Drill, DrillGrade } from '../types/drilloop';
import { callClaude, parseActionResponse } from './claudeApi';

// ── Drilloop grading layer (member side) ──
// The differentiated build: score a member's free-text answer against the
// creator's rubric and return concrete, encouraging feedback. Primary path is
// the Anthropic API via the existing /api/claude proxy; if that's unavailable
// (no key, offline, rate-limited) we fall back to a transparent keyword-overlap
// heuristic so the loop never dead-ends.

function buildSystemPrompt(): string {
  return [
    'You are the grading layer for "Drilloop", a learning membership that drills experienced PMs on Agentic AI and AI product judgment.',
    'You score a member\'s free-text answer against the creator\'s rubric (a list of key points a strong answer hits).',
    'Be a generous-but-honest coach: reward genuine understanding even when wording differs, but do not give credit for points the answer never makes.',
    'Return ONLY minified JSON, no markdown, with this exact shape:',
    '{"score": <0-100 integer>, "feedback": "<2-3 sentence coaching paragraph, second person>", "strengths": ["<rubric point hit>"], "gaps": ["<rubric point missed>"]}',
    'score reflects how many rubric points the answer genuinely covers and how sound the judgment is. strengths/gaps must be phrased as short rubric-point labels.',
  ].join('\n');
}

function buildUserMessage(drill: Drill, answer: string): string {
  return [
    `DRILL: ${drill.title}`,
    `QUESTION: ${drill.prompt}`,
    '',
    'RUBRIC (key points a strong answer hits):',
    ...drill.keyPoints.map((p, i) => `${i + 1}. ${p}`),
    '',
    'REFERENCE ANSWER (for your judgment, not to be parroted back):',
    drill.modelAnswer,
    '',
    "MEMBER'S ANSWER:",
    answer.trim() || '(left blank)',
    '',
    'Grade it. Return only the JSON.',
  ].join('\n');
}

interface RawGrade {
  score?: number;
  feedback?: string;
  strengths?: string[];
  gaps?: string[];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Grade an answer. Always resolves — falls back to a heuristic on any error. */
export async function gradeAnswer(drill: Drill, answer: string): Promise<DrillGrade> {
  try {
    const raw = await callClaude(buildSystemPrompt(), buildUserMessage(drill, answer));
    const text = parseActionResponse(raw).trim();
    const json = extractJson(text);
    const parsed = JSON.parse(json) as RawGrade;
    return {
      score: clamp(parsed.score ?? 0),
      feedback: parsed.feedback?.trim() || 'Graded.',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 6) : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 6) : [],
      aiGraded: true,
    };
  } catch {
    return heuristicGrade(drill, answer);
  }
}

/** Pull the first {...} block out of a model response that may have stray prose. */
function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('no json');
  return text.slice(start, end + 1);
}

// ── Offline fallback ──
// Keyword overlap between the answer and each rubric point. Crude, but honest:
// it tells the member which points it could and couldn't detect, and is clearly
// labelled as not-AI-graded in the UI.

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'that', 'this',
  'for', 'on', 'with', 'as', 'are', 'be', 'by', 'at', 'from', 'not', 'you',
  'your', 'its', 'into', 'than', 'then', 'but', 'can', 'has', 'have', 'will',
  'would', 'when', 'what', 'which', 'how', 'why', 'each', 'one', 'all', 'so',
]);

function keywords(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w)),
  );
}

export function heuristicGrade(drill: Drill, answer: string): DrillGrade {
  const ans = keywords(answer);
  const strengths: string[] = [];
  const gaps: string[] = [];

  for (const point of drill.keyPoints) {
    const kw = [...keywords(point)];
    if (kw.length === 0) continue;
    const hit = kw.filter(w => ans.has(w)).length / kw.length;
    if (hit >= 0.34) strengths.push(point);
    else gaps.push(point);
  }

  const covered = drill.keyPoints.length ? strengths.length / drill.keyPoints.length : 0;
  const lengthOk = answer.trim().split(/\s+/).filter(Boolean).length >= 15;
  // Soften so a thoughtful answer with different wording isn't punished too hard.
  const score = clamp(covered * 80 + (lengthOk ? 12 : 0) + (answer.trim() ? 8 : 0));

  const feedback = answer.trim()
    ? `Offline scoring (no AI key configured): your answer covered ${strengths.length} of ${drill.keyPoints.length} rubric points. Compare against the reference answer below — the gaps listed are points it couldn't detect, which may just be wording.`
    : 'No answer submitted — read the reference answer below, then re-drill this one.';

  return { score, feedback, strengths, gaps, aiGraded: false };
}
