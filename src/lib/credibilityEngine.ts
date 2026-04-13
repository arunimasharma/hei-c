/**
 * credibilityEngine.ts
 *
 * Deterministic, AI-free credibility computation for Hello-EQ's
 * Credibility & Insight Computation layer.
 *
 * Design principles:
 *  • Pure functions — no side effects, no I/O, fully testable
 *  • Deterministic — same input always produces same output
 *  • Revocable — expert tags disappear if performance drops below threshold
 *  • Anti-gaming — volume cap + duplicate-submission filter
 *  • O(n) — single pass over exercises per computation
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Formula (credibility score):
 *
 *   Score = Σ(Accuracy_i × Volume_i) / Σ(Volume_max) × 100
 *
 *   Volume_i   = log(1 + min(attempts_i, CAP))   — rewards breadth+repetition
 *   Volume_max = log(1 + CAP)                     — normaliser per active theme
 *   CAP        = 10 attempts per theme
 *
 * Properties:
 *  • A single lucky perfect attempt never scores > ~27/100 (low volume drag)
 *  • Many low-accuracy attempts score low (accuracy drag)
 *  • Score = 100 only with ≥CAP attempts AND perfect accuracy in every theme tried
 *  • Trying a new theme with few attempts slightly lowers score (honest signal)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { FrictionTheme } from '../data/frictionCases';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Hard cap for volume normalization.
 * Attempts beyond this still count for accuracy but add no extra weight —
 * prevents spam inflation while rewarding genuine volume.
 */
export const MAX_ATTEMPTS_PER_THEME = 10;

/** Precomputed: log(1 + MAX_ATTEMPTS_PER_THEME). */
const VOLUME_MAX = Math.log(1 + MAX_ATTEMPTS_PER_THEME);

/** Minimum distinct exercise submissions before Expert Tag is eligible. */
export const MIN_ATTEMPTS_FOR_EXPERT = 2;

/**
 * Minimum accuracy (0–1 fraction) required to earn Expert Tag.
 * 0.60 = 60 % correct on total possible points in that theme.
 */
export const MIN_ACCURACY_FOR_EXPERT = 0.6;

/**
 * Anti-gaming window (ms).
 * Two submissions in the same theme within this window are treated as
 * duplicates — the second is silently dropped.
 */
const DUPLICATE_WINDOW_MS = 60_000; // 60 seconds

// ── Input type ────────────────────────────────────────────────────────────────

/**
 * Normalised exercise record consumed by the engine.
 * Maps 1-to-1 with a FrictionCaseExercise submission.
 */
export interface ExerciseRecord {
  id: string;
  theme: FrictionTheme;
  /**
   * Partial score earned: 0 | 0.5 | 1 for friction cases
   * (0.5 for correct root issue + 0.5 for correct fix).
   */
  score: number;
  /**
   * Maximum achievable score for this exercise.
   * Defaults to 1.0 for all friction cases.
   */
  maxScore: number;
  /** Unix milliseconds — used for ordering and duplicate detection. */
  createdAt: number;
  /**
   * Opaque string identifying the scoring regime under which this record was
   * produced (e.g. `'1.0.0::pm-graph-v1'`).
   *
   * Set by the PM Graph bridge (`pmGraphCredibility.ts`) as
   * `<rubric_version>::<graph_version>`.  Absent on legacy InsightStore records
   * that pre-date version tracking.
   *
   * Used by `computeCredibilityProfile` to detect mixed-version histories and
   * populate `CredibilityProfile.versionMix`.
   */
  versionKey?: string;
}

// ── Output types ──────────────────────────────────────────────────────────────

/** Per-theme aggregate stats after deduplication. */
export interface ThemeStat {
  attempts: number;
  totalScore: number;
  totalMaxScore: number;
  /**
   * accuracy = totalScore / totalMaxScore
   * Point-based, not attempt-based — a half-correct answer scores 0.5/1.0,
   * not 0/1, which more faithfully represents partial understanding.
   */
  accuracy: number;
}

export type ThemeStats = Partial<Record<FrictionTheme, ThemeStat>>;

/** Expert tag decision for a single theme. */
export interface ExpertTag {
  isExpert: boolean;
  accuracy: number;
  attempts: number;
}

export type ExpertTagMap = Partial<Record<FrictionTheme, ExpertTag>>;

/**
 * Confidence band for the overall credibility score.
 *
 * Surfaces reliability signal to the UI so that a 2-exercise profile is never
 * treated with the same authority as a 20-exercise profile.
 *
 *  low    : < 5 exercises  — provisional, high variance
 *  medium : 5–14           — emerging signal
 *  high   : ≥ 15           — stable, reliable
 */
export type ConfidenceBand = 'low' | 'medium' | 'high';

/**
 * Describes the scoring-regime diversity of a credibility profile.
 *
 * Produced by `computeCredibilityProfile` when at least one input
 * `ExerciseRecord` carries a `versionKey`.  Null for legacy records
 * (InsightStore path) that pre-date version tracking.
 *
 * When `isMixed` is true the profile aggregates records evaluated under
 * different rubric or graph versions.  Scores across regimes are not
 * directly comparable, so the UI should surface a disclosure label.
 * See docs/integrations/pm-graph/mixed-version-handling.md for policy.
 */
export interface VersionMixInfo {
  /**
   * Sorted list of every distinct `versionKey` that appears in the exercise
   * records used to compute this profile.
   * Format of each entry: `'<rubric_version>::<graph_version>'`.
   */
  distinctVersions: string[];
  /**
   * True when more than one scoring regime contributed to this profile.
   * UI callers should show a disclosure label when this is true.
   */
  isMixed: boolean;
}

/** Full credibility profile returned to the Influence Page. */
export interface CredibilityProfile {
  /** Credibility score 0–100, rounded integer. */
  score: number;
  /** Reliability of the score given current exercise volume. */
  confidence: ConfidenceBand;
  /** Per-theme aggregates (only themes with ≥1 attempt appear). */
  themes: ThemeStats;
  /** Expert tag decisions, keyed by theme. */
  expertTags: ExpertTagMap;
  /** Convenience list of themes where isExpert === true. */
  expertThemes: FrictionTheme[];
  /** Total deduplicated exercises counted. */
  totalExercises: number;
  /**
   * Frontend-ready breakdown object matching the Influence Page contract:
   * { [theme]: { accuracy, attempts } }
   */
  breakdown: Partial<Record<FrictionTheme, { accuracy: number; attempts: number }>>;
  /**
   * Version mixture information for the records that contributed to this profile.
   *
   * Null when no records carry a `versionKey` (legacy InsightStore path).
   * When `isMixed` is true, the credibility score aggregates evaluations from
   * different rubric or graph versions — the UI should show a disclosure label.
   *
   * Policy: Hello-EQ aggregates across all versions (scores remain comparable
   * within the normalized [0, 100] range) but labels mixed histories so users
   * understand that earlier evaluations may have used different criteria.
   */
  versionMix: VersionMixInfo | null;
}

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * computeThemeStats
 *
 * Single O(n) pass over exercises — builds per-theme aggregates.
 *
 * Accuracy = totalScore / totalMaxScore  (point-based, not attempt-count-based)
 *
 * Anti-gaming: submissions for the same theme within DUPLICATE_WINDOW_MS of a
 * previous submission are dropped before aggregation.  This prevents a user
 * from spamming a low-variance case to inflate their attempt count.
 */
export function computeThemeStats(exercises: ExerciseRecord[]): ThemeStats {
  if (exercises.length === 0) return {};

  const deduped = deduplicateSubmissions(exercises);
  const stats: ThemeStats = {};

  for (const ex of deduped) {
    if (!stats[ex.theme]) {
      stats[ex.theme] = { attempts: 0, totalScore: 0, totalMaxScore: 0, accuracy: 0 };
    }
    const s = stats[ex.theme]!;
    s.attempts     += 1;
    s.totalScore   += ex.score;
    s.totalMaxScore += ex.maxScore;
  }

  // Derive accuracy in a second pass to avoid division-by-zero inline
  for (const theme of Object.keys(stats) as FrictionTheme[]) {
    const s = stats[theme]!;
    s.accuracy = s.totalMaxScore > 0 ? s.totalScore / s.totalMaxScore : 0;
  }

  return stats;
}

/**
 * computeExpertTags
 *
 * Returns an ExpertTagMap for every theme that has at least one attempt.
 *
 * Expert criteria (both must hold):
 *   1. attempts  ≥ MIN_ATTEMPTS_FOR_EXPERT  (currently 2)
 *   2. accuracy  ≥ MIN_ACCURACY_FOR_EXPERT  (currently 0.60)
 *
 * Tags are:
 *  • Deterministic — re-computed from raw stats on every call
 *  • Revocable — if the user's accuracy drops below 0.60 after more attempts,
 *    the tag is removed on the next computation
 */
export function computeExpertTags(themeStats: ThemeStats): ExpertTagMap {
  const tags: ExpertTagMap = {};

  for (const theme of Object.keys(themeStats) as FrictionTheme[]) {
    const s = themeStats[theme]!;
    tags[theme] = {
      isExpert: s.attempts >= MIN_ATTEMPTS_FOR_EXPERT && s.accuracy >= MIN_ACCURACY_FOR_EXPERT,
      accuracy: s.accuracy,
      attempts: s.attempts,
    };
  }

  return tags;
}

/**
 * computeCredibilityScore
 *
 * Applies the volume-weighted credibility formula.
 *
 *   Numerator   = Σ  Accuracy_i × log(1 + min(attempts_i, CAP))
 *   Denominator = Σ  log(1 + CAP)   (one VOLUME_MAX per active theme)
 *   Score       = (Numerator / Denominator) × 100, rounded to integer
 *
 * Why log()?
 *  Linear volume (attempts / max) lets a user inflate their score by grinding.
 *  log(1 + n) grows fast at the start (1→2 attempts doubles volume) but
 *  flattens quickly, rewarding the first few attempts most.
 */
export function computeCredibilityScore(themeStats: ThemeStats): number {
  const themes = Object.keys(themeStats) as FrictionTheme[];
  if (themes.length === 0) return 0;

  let numerator   = 0;
  let denominator = 0;

  for (const theme of themes) {
    const s = themeStats[theme]!;
    const cappedAttempts = Math.min(s.attempts, MAX_ATTEMPTS_PER_THEME);
    const volume = Math.log(1 + cappedAttempts);
    numerator   += s.accuracy * volume;
    denominator += VOLUME_MAX;
  }

  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

/**
 * computeCredibilityProfile
 *
 * Master function — single entry point for the Influence Page and public
 * profile builder.  Composes all sub-functions and returns the full profile.
 *
 * Always O(n) over exercises.  Safe to call on every new submission and on
 * app load.
 */
export function computeCredibilityProfile(exercises: ExerciseRecord[]): CredibilityProfile {
  if (exercises.length === 0) {
    return {
      score:          0,
      confidence:     'low',
      themes:         {},
      expertTags:     {},
      expertThemes:   [],
      totalExercises: 0,
      breakdown:      {},
      versionMix:     null,
    };
  }

  const themes     = computeThemeStats(exercises);
  const expertTags = computeExpertTags(themes);
  const score      = computeCredibilityScore(themes);

  const expertThemes = (Object.keys(expertTags) as FrictionTheme[]).filter(
    t => expertTags[t]!.isExpert,
  );

  // Build frontend-ready breakdown
  const breakdown: CredibilityProfile['breakdown'] = {};
  for (const theme of Object.keys(themes) as FrictionTheme[]) {
    const s = themes[theme]!;
    breakdown[theme] = { accuracy: s.accuracy, attempts: s.attempts };
  }

  // totalExercises = sum of deduplicated attempts across all themes
  // (deduplication happens inside computeThemeStats, so we derive from stats)
  const totalExercises = (Object.values(themes) as Array<{ attempts: number }>)
    .reduce((sum, s) => sum + s.attempts, 0);

  return {
    score,
    confidence:  confidenceBand(totalExercises),
    themes,
    expertTags,
    expertThemes,
    totalExercises,
    breakdown,
    versionMix:  collectVersionMix(exercises),
  };
}

// ── PM Graph dimension scoring ────────────────────────────────────────────────

/**
 * The six PM Graph rubric dimensions for a single Friction Case evaluation.
 *
 * Defined here (not imported from the PM Graph integration) to keep the engine
 * free of cross-module coupling.  The shape is identical to DimensionScores in
 * src/integrations/pmGraph/schema.ts — TypeScript's structural typing ensures
 * compatibility without a direct import.
 */
export interface FrictionCaseDimensionScores {
  product_judgment:   number; // overall PM judgment quality [0,1]
  specificity:        number; // concreteness of reasoning [0,1]
  tradeoff_awareness: number; // recognition of tradeoffs [0,1]
  segmentation_logic: number; // user-segment reasoning [0,1]
  strategic_empathy:  number; // understanding user perspective [0,1]
  market_inference:   number; // product/market context [0,1]
}

/** Number of dimensions used in the equal-weight average. */
export const FRICTION_CASE_DIMENSION_COUNT = 6;

/**
 * computeFrictionCaseAttemptScore
 *
 * Derives a single [0, 1] score from PM Graph dimension_scores for one
 * Friction Case attempt.
 *
 * Formula:
 *   score = (product_judgment + specificity + tradeoff_awareness +
 *            segmentation_logic + strategic_empathy + market_inference) / 6
 *
 * Why equal weights?
 *   All six dimensions are independently measured by PM Graph and represent
 *   distinct PM competencies applied to Friction Case diagnosis.  No one
 *   dimension is privileged without empirical calibration data on predictive
 *   validity.  Equal weighting is the minimum-assumption choice and produces
 *   an interpretable score: a 0.72 attempt score means "average across all
 *   six rubric dimensions is 72 %".  Weights can be updated per-theme once
 *   calibration data is available — the formula signature stays unchanged.
 *
 * The result feeds directly into computeThemeStats as the attempt's `score`
 * field (maxScore = 1), so all downstream aggregation (accuracy, expert tags,
 * credibility) uses the existing engine pipeline without modification.
 */
export function computeFrictionCaseAttemptScore(dims: FrictionCaseDimensionScores): number {
  const sum =
    dims.product_judgment +
    dims.specificity +
    dims.tradeoff_awareness +
    dims.segmentation_logic +
    dims.strategic_empathy +
    dims.market_inference;
  return sum / FRICTION_CASE_DIMENSION_COUNT;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * collectVersionMix
 *
 * Inspects the `versionKey` fields of the input exercises and returns a
 * `VersionMixInfo` summary, or null when no records carry a version key
 * (legacy InsightStore path).
 *
 * A profile is "mixed" when records from more than one scoring regime
 * (rubric_version × graph_version combination) are present.  In that case
 * the UI should show a disclosure label — scores aggregated across regimes
 * are directionally correct but not directly comparable to per-version scores.
 *
 * Called once per `computeCredibilityProfile` invocation.  O(n) over exercises.
 */
export function collectVersionMix(exercises: ExerciseRecord[]): VersionMixInfo | null {
  const keys = exercises
    .map(e => e.versionKey)
    .filter((k): k is string => k !== undefined);

  if (keys.length === 0) return null;

  const distinctVersions = [...new Set(keys)].sort();
  return {
    distinctVersions,
    isMixed: distinctVersions.length > 1,
  };
}

/**
 * Maps total exercise count to a confidence band.
 * Lower volume = higher variance = less reliable signal.
 */
export function confidenceBand(totalExercises: number): ConfidenceBand {
  if (totalExercises < 5)  return 'low';
  if (totalExercises < 15) return 'medium';
  return 'high';
}

/**
 * Anti-gaming: removes submissions where the same theme appears more than once
 * within DUPLICATE_WINDOW_MS (60 s).
 *
 * Sorted ascending by createdAt so the earliest submission in any burst is
 * always kept.
 *
 * Rationale: a legitimate user completing exercises naturally has minutes
 * between submissions; rapid-fire submissions indicate refresh-spamming.
 */
export function deduplicateSubmissions(exercises: ExerciseRecord[]): ExerciseRecord[] {
  const sorted = [...exercises].sort((a, b) => a.createdAt - b.createdAt);
  const result: ExerciseRecord[] = [];
  const lastSeenPerTheme = new Map<FrictionTheme, number>();

  for (const ex of sorted) {
    const last = lastSeenPerTheme.get(ex.theme);
    if (last !== undefined && ex.createdAt - last < DUPLICATE_WINDOW_MS) {
      // Within the duplicate window — drop silently
      continue;
    }
    result.push(ex);
    lastSeenPerTheme.set(ex.theme, ex.createdAt);
  }

  return result;
}
