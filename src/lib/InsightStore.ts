/**
 * InsightStore
 *
 * localStorage persistence for PM insight submissions (FrictionCaseExercise scores).
 * Delegates all credibility computation to credibilityEngine.ts — this module
 * is responsible only for persistence and data mapping.
 */

import type { FrictionTheme } from '../data/frictionCases';
import {
  computeCredibilityProfile,
  type ExerciseRecord,
  type ConfidenceBand,
  type ExpertTagMap,
  type ThemeStats,
} from './credibilityEngine';

const KEY = 'heq_insight_submissions';

// ── Stored shape ──────────────────────────────────────────────────────────────

export interface InsightSubmission {
  id: string;
  caseId: string;
  theme: FrictionTheme;
  rootIssueCorrect: boolean;
  fixCorrect: boolean;
  /** 0 | 0.5 | 1  (0.5 per correct answer) */
  score: number;
  /**
   * Maximum achievable score for this exercise.
   * Optional for backward compatibility — defaults to 1.0 (all friction cases).
   */
  maxScore?: number;
  timestamp: string;
}

// ── Profile shape (consumed by InfluencePanel + publicProfile) ────────────────

export interface InsightProfile {
  totalCases: number;
  /** Overall average accuracy 0–1 across all exercises. */
  avgAccuracy: number;
  /** Credibility score 0–100 (volume-weighted, log-normalised). */
  credibilityScore: number;
  /**
   * Per-theme accuracy + attempt counts.
   * Shape aligned with ThemeStats from credibilityEngine.
   */
  domainAccuracy: ThemeStats;
  /**
   * Full expert tag map — includes isExpert flag + accuracy + attempts per
   * theme.  Use expertTags (array) for simple display, this for rich UI.
   */
  expertTagMap: ExpertTagMap;
  /** Convenience array of themes where isExpert === true. */
  expertTags: FrictionTheme[];
  /** Reliability of the credibility score given current exercise volume. */
  confidence: ConfidenceBand;
  /**
   * Frontend-ready breakdown: { [theme]: { accuracy, attempts } }
   * Matches the public profile payload contract.
   */
  breakdown: Partial<Record<FrictionTheme, { accuracy: number; attempts: number }>>;
  /** Score of the most recent submission (0 | 0.5 | 1), or null if empty. */
  recentScore: number | null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function load(): InsightSubmission[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as InsightSubmission[];
  } catch {
    return [];
  }
}

function save(submissions: InsightSubmission[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(submissions));
  } catch { /* storage full — skip */ }
}

/**
 * Maps an InsightSubmission to the ExerciseRecord shape expected by the engine.
 * Provides backward-compatible defaults for submissions stored before maxScore
 * was added to the schema (all friction cases have maxScore = 1).
 */
function toExerciseRecord(s: InsightSubmission): ExerciseRecord {
  return {
    id:        s.id,
    theme:     s.theme,
    score:     s.score,
    maxScore:  s.maxScore ?? 1,
    createdAt: new Date(s.timestamp).getTime(),
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const InsightStore = {
  submit(entry: Omit<InsightSubmission, 'id' | 'timestamp'>): InsightSubmission {
    const submissions = load();
    const full: InsightSubmission = {
      ...entry,
      // Ensure maxScore is always persisted — default to 1 for friction cases
      maxScore: entry.maxScore ?? 1,
      id:        `is_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    save([...submissions, full]);
    return full;
  },

  getAll(): InsightSubmission[] {
    return load();
  },

  getProfile(): InsightProfile {
    const submissions = load();

    if (submissions.length === 0) {
      return {
        totalCases:    0,
        avgAccuracy:   0,
        credibilityScore: 0,
        domainAccuracy: {},
        expertTagMap:  {},
        expertTags:    [],
        confidence:    'low',
        breakdown:     {},
        recentScore:   null,
      };
    }

    const records = submissions.map(toExerciseRecord);
    const profile = computeCredibilityProfile(records);

    // Compute overall avgAccuracy across all exercises (unweighted by theme)
    const totalScore    = submissions.reduce((sum, s) => sum + s.score, 0);
    const totalMaxScore = submissions.reduce((sum, s) => sum + (s.maxScore ?? 1), 0);
    const avgAccuracy   = totalMaxScore > 0 ? totalScore / totalMaxScore : 0;

    const recentScore = submissions.at(-1)?.score ?? null;

    return {
      totalCases:      submissions.length,
      avgAccuracy,
      credibilityScore: profile.score,
      domainAccuracy:  profile.themes,
      expertTagMap:    profile.expertTags,
      expertTags:      profile.expertThemes,
      confidence:      profile.confidence,
      breakdown:       profile.breakdown,
      recentScore,
    };
  },

  clear() {
    localStorage.removeItem(KEY);
  },
};
