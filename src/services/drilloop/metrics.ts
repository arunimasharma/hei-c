import type { Drill, DrillAttempt, DrilloopMetrics, PhaseProgress, SelfRating } from '../../types/drilloop';

// ── Derived member metrics (catalog-driven) ──
// Same math as the old localStorage drilloopStore, but computed against the
// live drill catalog + the member's real attempts from Postgres, so streaks /
// mastery / phase progress reflect the multi-user backend. Pure + testable.

const RATING_SCORE: Record<SelfRating, number> = { nailed: 100, partial: 55, missed: 15 };

const score = (a: DrillAttempt) => a.aiScore ?? RATING_SCORE[a.selfRating];
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export function computeStreaks(attempts: DrillAttempt[]): { current: number; longest: number } {
  if (attempts.length === 0) return { current: 0, longest: 0 };
  const days = [...new Set(attempts.map(a => a.day))].sort();
  let longest = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = dayGap(days[i - 1], days[i]);
    if (gap === 1) { run += 1; longest = Math.max(longest, run); } else run = 1;
  }
  let current = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (dayGap(days[i - 1], days[i]) === 1) current += 1; else break;
  }
  return { current, longest: Math.max(longest, current) };
}

function dayGap(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86_400_000);
}

/** Metrics over knowledge drills only (profile drills don't count toward mastery). */
export function computeMetrics(catalog: Drill[], allAttempts: DrillAttempt[]): DrilloopMetrics {
  const knowledge = catalog.filter(d => (d.kind ?? 'knowledge') === 'knowledge');
  const knowledgeIds = new Set(knowledge.map(d => d.id));
  const attempts = allAttempts.filter(a => knowledgeIds.has(a.drillId));

  const totalDrills = knowledge.length;
  const completedDrills = new Set(attempts.map(a => a.drillId)).size;
  const completionRate = totalDrills ? completedDrills / totalDrills : 0;
  const { current, longest } = computeStreaks(attempts);
  const masteryRate = attempts.length
    ? attempts.filter(a => a.selfRating === 'nailed').length / attempts.length
    : 0;

  const ordered = [...attempts].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
  );
  let improvement = 0;
  if (ordered.length >= 4) {
    const mid = Math.floor(ordered.length / 2);
    improvement = Math.round(avg(ordered.slice(mid).map(score)) - avg(ordered.slice(0, mid).map(score)));
  }

  const daysActive = new Set(attempts.map(a => a.day)).size;

  const phases = [...new Set(knowledge.map(d => d.phase))].sort((a, b) => a - b);
  const phaseProgress: PhaseProgress[] = phases.map(phase => {
    const phaseDrills = knowledge.filter(d => d.phase === phase);
    const phaseAttempts = attempts.filter(a => a.phase === phase);
    const done = new Set(phaseAttempts.map(a => a.drillId)).size;
    return {
      phase,
      phaseTitle: phaseDrills[0]?.phaseTitle ?? '',
      total: phaseDrills.length,
      completed: done,
      mastery: phaseAttempts.length ? Math.round(avg(phaseAttempts.map(score))) : 0,
    };
  });

  return {
    totalDrills, completedDrills, completionRate,
    currentStreak: current, longestStreak: longest,
    masteryRate, improvement, daysActive, phaseProgress,
  };
}
