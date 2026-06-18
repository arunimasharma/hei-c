import type { Drill, DrillGrade } from '../../types/drilloop';

// ── Offline heuristic grade (pure) ──
// Keyword-overlap fallback used when the AI grade can't be produced. Honest and
// transparent: tells the member which rubric points it could/couldn't detect.
// Pure (no network, no client-only imports) so it runs on the server too.

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'that', 'this',
  'for', 'on', 'with', 'as', 'are', 'be', 'by', 'at', 'from', 'not', 'you',
  'your', 'its', 'into', 'than', 'then', 'but', 'can', 'has', 'have', 'will',
  'would', 'when', 'what', 'which', 'how', 'why', 'each', 'one', 'all', 'so',
]);

function keywords(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)),
  );
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function heuristicGrade(drill: Drill, answer: string): DrillGrade {
  const ans = keywords(answer);
  const strengths: string[] = [];
  const gaps: string[] = [];
  for (const point of drill.keyPoints) {
    const kw = [...keywords(point)];
    if (kw.length === 0) continue;
    const hit = kw.filter(w => ans.has(w)).length / kw.length;
    if (hit >= 0.34) strengths.push(point); else gaps.push(point);
  }
  const covered = drill.keyPoints.length ? strengths.length / drill.keyPoints.length : 0;
  const lengthOk = answer.trim().split(/\s+/).filter(Boolean).length >= 15;
  const score = clamp(covered * 80 + (lengthOk ? 12 : 0) + (answer.trim() ? 8 : 0));
  const feedback = answer.trim()
    ? `Offline scoring (AI grade unavailable): your answer covered ${strengths.length} of ${drill.keyPoints.length} rubric points. Compare against the reference answer — listed gaps may just be wording.`
    : 'No answer submitted — read the reference answer, then re-drill this one.';
  return { score, feedback, strengths, gaps, aiGraded: false };
}
