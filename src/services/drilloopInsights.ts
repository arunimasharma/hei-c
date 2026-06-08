import type {
  CreatorInsights,
  DrillInsight,
  LeaderRow,
  DrillAttempt,
  DrilloopState,
} from '../types/drilloop';
import { getCatalog } from './drilloopCatalog';
import { computeStreaks } from './drilloopStore';

// ── Drilloop creator insights ──
// Aggregates the audience's practice into the "see what your audience struggles
// with" dashboard. In production this is a query across the attempts/grades/
// feedback Postgres tables for a creator's members; here it merges the real
// local member's data with a small seeded demo cohort so the dashboard tells a
// believable story from the first visit. Demo rows are clearly synthetic and
// derived deterministically (no randomness) from the published catalog.

interface CohortMember {
  name: string;
  /** drillId → score, simulating that member's grades. */
  grades: Record<string, number>;
  streak: number;
}

/**
 * A small, deterministic demo cohort so completion rates, average scores and the
 * leaderboard aren't empty before real members exist. Scores are derived from
 * each drill's order so "harder/later" drills show lower averages — the kind of
 * pattern a creator would actually act on.
 */
function demoCohort(drillIds: string[]): CohortMember[] {
  const names = ['Priya', 'Marcus', 'Lena', 'Devon', 'Sofia', 'Aiden', 'Rina'];
  return names.map((name, i) => {
    const grades: Record<string, number> = {};
    // Each member completes a different prefix of the program.
    const completes = Math.max(2, drillIds.length - i * 2);
    for (let d = 0; d < completes && d < drillIds.length; d++) {
      // Base skill per member, minus a difficulty ramp, with a stable per-drill jitter.
      const base = 88 - i * 4;
      const ramp = Math.floor(d * 1.6);
      const jitter = ((i * 7 + d * 13) % 11) - 5;
      grades[drillIds[d]] = Math.max(20, Math.min(100, base - ramp + jitter));
    }
    return { name, grades, streak: Math.max(1, 9 - i) };
  });
}

export function computeCreatorInsights(member: DrilloopState): CreatorInsights {
  const catalog = getCatalog();
  const drillIds = catalog.map(d => d.id);
  const cohort = demoCohort(drillIds);

  // ── Per-drill rollup (cohort + real member) ──
  const drillInsights: DrillInsight[] = catalog.map(drill => {
    const cohortScores = cohort
      .map(m => m.grades[drill.id])
      .filter((s): s is number => typeof s === 'number');

    const realAttempts = member.attempts.filter(a => a.drillId === drill.id);
    const realScores = realAttempts.map(scoreOf);

    const scores = [...cohortScores, ...realScores];
    const attempts = scores.length;
    // "Completion" = of those who started this phase, how many finished this drill.
    const started = cohort.length + (member.tier === 'member' ? 1 : 0);
    const completionRate = started ? attempts / started : 0;
    const avgScore = attempts ? Math.round(avg(scores)) : 0;
    const struggleRate = attempts ? scores.filter(s => s < 55).length / attempts : 0;

    return {
      drillId: drill.id,
      title: drill.title,
      phase: drill.phase,
      attempts,
      completionRate,
      avgScore,
      struggleRate,
      commonGaps: clusterGaps(drill.id, drill.keyPoints, realAttempts, scores),
    };
  });

  // ── Leaderboard (shoutout surface) ──
  const cohortRows: LeaderRow[] = cohort.map(m => {
    const done = Object.keys(m.grades).length;
    const masteryRate =
      done ? Object.values(m.grades).filter(s => s >= 85).length / done : 0;
    return { name: m.name, drillsCompleted: done, streak: m.streak, masteryRate, isYou: false };
  });

  const youDone = new Set(member.attempts.map(a => a.drillId)).size;
  const { current } = computeStreaks(member.attempts);
  const youMastery =
    member.attempts.length
      ? member.attempts.filter(a => a.selfRating === 'nailed').length / member.attempts.length
      : 0;
  const youRow: LeaderRow = {
    name: member.memberName || 'You',
    drillsCompleted: youDone,
    streak: current,
    masteryRate: youMastery,
    isYou: true,
  };

  const leaderboard = [...cohortRows, youRow]
    .sort((a, b) => b.drillsCompleted - a.drillsCompleted || b.masteryRate - a.masteryRate)
    .slice(0, 8);

  // ── Aggregates ──
  const allScores = drillInsights.flatMap(di =>
    Array(di.attempts).fill(di.avgScore),
  );
  const avgScore = allScores.length ? Math.round(avg(allScores)) : 0;
  const avgCompletionRate = drillInsights.length
    ? avg(drillInsights.map(d => d.completionRate))
    : 0;
  const totalAttempts = drillInsights.reduce((s, d) => s + d.attempts, 0);

  return {
    activeMembers: cohort.length + (member.attempts.length ? 1 : 0),
    paidMembers: cohort.length + (member.tier === 'member' ? 1 : 0),
    totalAttempts,
    avgCompletionRate,
    avgScore,
    drillInsights,
    leaderboard,
    recentFeedback: [...member.feedback].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    ),
  };
}

function scoreOf(a: DrillAttempt): number {
  if (a.aiScore !== null && a.aiScore !== undefined) return a.aiScore;
  return a.selfRating === 'nailed' ? 100 : a.selfRating === 'partial' ? 55 : 15;
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

/**
 * "Common wrong answers", clustered. We surface the rubric points the real
 * member most often missed on low-scoring attempts — the concrete thing the
 * creator can re-teach. (The cohort is synthetic, so only real gaps are shown.)
 */
function clusterGaps(
  _drillId: string,
  keyPoints: string[],
  realAttempts: DrillAttempt[],
  scores: number[],
): string[] {
  const lowAttempts = realAttempts.filter(a => scoreOf(a) < 70);
  const counts = new Map<string, number>();
  for (const a of lowAttempts) {
    for (const gap of a.grade?.gaps ?? []) {
      counts.set(gap, (counts.get(gap) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  if (ranked.length > 0) return ranked.slice(0, 3);

  // No graded gaps yet — if the drill is scoring low overall, hint at the rubric.
  const avgScore = scores.length ? avg(scores) : 100;
  if (avgScore < 60 && keyPoints.length) {
    return [`Audience scoring low — likely missing: ${keyPoints[keyPoints.length - 1]}`];
  }
  return [];
}
