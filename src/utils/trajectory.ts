/**
 * Taste Trajectory — data layer for friction-case growth visualization.
 *
 * Reads from InsightStore (localStorage) and builds time-series data
 * for the TasteTrajectoryChart component. Results are cached in localStorage
 * so the chart loads in <200 ms even with many submissions.
 *
 * Key exports:
 *   getTasteTrajectory()         — raw sorted submissions
 *   buildTrajectorySeries()      — convert to chart series
 *   computeTrajectoryInsights()  — derive narrative insights
 *   getCachedOrComputeSeries()   — cache-aware entry point (use this)
 *   invalidateTrajectoryCache()  — call after each new submission
 *
 * Mock data for testing:
 *   getMockTrajectoryData()
 */

import { InsightStore, type InsightSubmission } from '../lib/InsightStore';
import type { FrictionTheme } from '../data/frictionCases';

// ── Constants ──────────────────────────────────────────────────────────────────

export const TRAJECTORY_THEMES: FrictionTheme[] = [
  'pricing', 'ux', 'onboarding', 'trust', 'value',
];

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TrajectoryPoint {
  /** Unix timestamp (ms) */
  x: number;
  /** Running cumulative accuracy 0–100 */
  y: number;
  /** Attempt index across all themes (0-based) */
  index: number;
  /** Raw submission score (0 | 0.5 | 1) */
  score: number;
  /** Which theme this submission was in */
  theme: FrictionTheme;
}

export interface TrajectorySeries {
  overall: TrajectoryPoint[];
  byTheme: Partial<Record<FrictionTheme, TrajectoryPoint[]>>;
}

export interface TrajectoryInsight {
  /** Overall accuracy: last minus first (percentage points, signed) */
  delta: number;
  trend: 'up' | 'down' | 'flat';
  /** Theme with highest final accuracy */
  bestTheme: FrictionTheme | null;
  /** Theme with lowest final accuracy (and ≥2 attempts) */
  weakestTheme: FrictionTheme | null;
  /** Themes that improved by >5pp first→last within-theme */
  improved: Array<{ theme: FrictionTheme; delta: number }>;
  /** Themes where the last 3 attempts moved by ≤5pp (needs ≥3 attempts) */
  plateaued: FrictionTheme[];
  /** Themes whose running accuracy has reached ≥60% (expert threshold) */
  crossedExpertThreshold: FrictionTheme[];
}

// ── Cache ──────────────────────────────────────────────────────────────────────

const CACHE_KEY = 'heq_trajectory_cache_v1';

interface CacheEntry {
  /** Fingerprint: "{submissionCount}:{lastTimestamp}" */
  hash: string;
  series: TrajectorySeries;
  insights: TrajectoryInsight;
}

function cacheHash(submissions: InsightSubmission[]): string {
  return `${submissions.length}:${submissions.at(-1)?.timestamp ?? ''}`;
}

// ── Core functions ─────────────────────────────────────────────────────────────

/** Load all submissions sorted oldest-first. */
export function getTasteTrajectory(): InsightSubmission[] {
  return InsightStore.getAll().sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

/**
 * Convert raw submissions into chart-ready series.
 *
 * "Overall" = running cumulative accuracy across all themes.
 * "byTheme[t]" = running cumulative accuracy for theme t only.
 */
export function buildTrajectorySeries(submissions: InsightSubmission[]): TrajectorySeries {
  if (submissions.length === 0) return { overall: [], byTheme: {} };

  // Overall running accuracy
  let runningScore = 0;
  const overall: TrajectoryPoint[] = submissions.map((s, i) => {
    runningScore += s.score;
    return {
      x:     new Date(s.timestamp).getTime(),
      y:     Math.round((runningScore / (i + 1)) * 100),
      index: i,
      score: s.score,
      theme: s.theme,
    };
  });

  // Per-theme running accuracy
  const themeRunning: Partial<Record<FrictionTheme, { total: number; count: number }>> = {};
  const byTheme: Partial<Record<FrictionTheme, TrajectoryPoint[]>> = {};

  for (const [i, s] of submissions.entries()) {
    const t = s.theme;
    if (!themeRunning[t]) themeRunning[t] = { total: 0, count: 0 };
    if (!byTheme[t]) byTheme[t] = [];

    themeRunning[t]!.total += s.score;
    themeRunning[t]!.count += 1;

    byTheme[t]!.push({
      x:     new Date(s.timestamp).getTime(),
      y:     Math.round((themeRunning[t]!.total / themeRunning[t]!.count) * 100),
      index: i,
      score: s.score,
      theme: t,
    });
  }

  return { overall, byTheme };
}

/** Derive narrative insights from a computed series. */
export function computeTrajectoryInsights(series: TrajectorySeries): TrajectoryInsight {
  const overall = series.overall;

  const delta = overall.length >= 2
    ? overall.at(-1)!.y - overall[0].y
    : 0;

  const trend: 'up' | 'down' | 'flat' =
    delta > 5 ? 'up' : delta < -5 ? 'down' : 'flat';

  // Best / weakest by final accuracy (require ≥1 attempt)
  const themeEntries = (
    Object.entries(series.byTheme) as [FrictionTheme, TrajectoryPoint[]][]
  )
    .filter(([, pts]) => pts.length > 0)
    .map(([t, pts]) => [t, pts.at(-1)!.y] as [FrictionTheme, number]);

  const bestTheme = themeEntries.length > 0
    ? themeEntries.reduce((a, b) => (a[1] >= b[1] ? a : b))[0]
    : null;

  // Weakest: only themes with ≥2 attempts are meaningful
  const weakestCandidates = (
    Object.entries(series.byTheme) as [FrictionTheme, TrajectoryPoint[]][]
  )
    .filter(([, pts]) => pts.length >= 2)
    .map(([t, pts]) => [t, pts.at(-1)!.y] as [FrictionTheme, number]);

  const weakestTheme = weakestCandidates.length > 0
    ? weakestCandidates.reduce((a, b) => (a[1] <= b[1] ? a : b))[0]
    : null;

  const improved: Array<{ theme: FrictionTheme; delta: number }> = [];
  const plateaued: FrictionTheme[] = [];
  const crossedExpertThreshold: FrictionTheme[] = [];

  for (const [theme, pts] of Object.entries(series.byTheme) as [FrictionTheme, TrajectoryPoint[]][]) {
    if (pts.length < 2) continue;

    const d = pts.at(-1)!.y - pts[0].y;
    if (d > 5) improved.push({ theme, delta: Math.round(d) });

    if (pts.length >= 3) {
      const last3 = pts.slice(-3);
      const range = Math.max(...last3.map(p => p.y)) - Math.min(...last3.map(p => p.y));
      if (range <= 5) plateaued.push(theme);
    }

    if (pts.at(-1)!.y >= 60) crossedExpertThreshold.push(theme);
  }

  return { delta, trend, bestTheme, weakestTheme, improved, plateaued, crossedExpertThreshold };
}

/**
 * Cache-aware entry point — always <200 ms.
 * Recomputes only when the submission fingerprint changes.
 */
export function getCachedOrComputeSeries(): {
  series: TrajectorySeries;
  insights: TrajectoryInsight;
  submissionCount: number;
} {
  const submissions = getTasteTrajectory();
  const hash = cacheHash(submissions);

  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as CacheEntry;
      if (cached.hash === hash) {
        return { series: cached.series, insights: cached.insights, submissionCount: submissions.length };
      }
    }
  } catch { /* ignore */ }

  const series   = buildTrajectorySeries(submissions);
  const insights = computeTrajectoryInsights(series);

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ hash, series, insights } satisfies CacheEntry));
  } catch { /* storage full */ }

  return { series, insights, submissionCount: submissions.length };
}

/** Bust the cache — call this immediately after InsightStore.submit(). */
export function invalidateTrajectoryCache(): void {
  localStorage.removeItem(CACHE_KEY);
}

// ── Mock data (for dev / Storybook) ───────────────────────────────────────────

/**
 * Generates 12 realistic-looking submissions spread over 35 days.
 * Useful for testing the chart without real user data.
 *
 * Usage:
 *   import { getMockTrajectoryData, buildTrajectorySeries } from '@/utils/trajectory';
 *   const series = buildTrajectorySeries(getMockTrajectoryData());
 */
export function getMockTrajectoryData(): InsightSubmission[] {
  const base = Date.now() - 35 * 24 * 60 * 60 * 1000;
  const cases: Array<{ theme: FrictionTheme; score: 0 | 0.5 | 1 }> = [
    { theme: 'ux',         score: 0.5 },
    { theme: 'pricing',    score: 0.5 },
    { theme: 'onboarding', score: 0   },
    { theme: 'ux',         score: 1   },
    { theme: 'trust',      score: 0.5 },
    { theme: 'value',      score: 1   },
    { theme: 'pricing',    score: 1   },
    { theme: 'ux',         score: 1   },
    { theme: 'onboarding', score: 1   },
    { theme: 'trust',      score: 1   },
    { theme: 'ux',         score: 1   },
    { theme: 'pricing',    score: 0.5 },
  ];

  return cases.map(({ theme, score }, i) => ({
    id:               `mock_${i}`,
    caseId:           `case_${i}`,
    theme,
    rootIssueCorrect: score >= 0.5,
    fixCorrect:       score >= 1,
    score,
    timestamp:        new Date(base + i * Math.round(2.8 * 24 * 60 * 60 * 1000)).toISOString(),
  }));
}
