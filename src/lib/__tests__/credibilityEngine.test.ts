/**
 * credibilityEngine.test.ts
 *
 * Unit tests for the deterministic credibility computation layer.
 *
 * Test coverage:
 *  1. computeThemeStats — aggregation + deduplication
 *  2. computeExpertTags — threshold logic + revocability
 *  3. computeCredibilityScore — volume weighting + normalization
 *  4. computeCredibilityProfile — master function + edge cases
 *  5. deduplicateSubmissions — anti-gaming window
 *  6. confidenceBand — volume bands
 *
 * Spec-derived test cases:
 *  - Single high score → NOT expert (< 2 attempts)
 *  - Two medium scores → becomes expert (accuracy ≥ 0.6, attempts ≥ 2)
 *  - Many attempts → higher credibility (volume rewards)
 *  - Mixed domain performance (some expert, some not)
 *  - Regression: user drops below 60% → tag revoked
 */

import { describe, it, expect } from 'vitest';
import {
  computeThemeStats,
  computeExpertTags,
  computeCredibilityScore,
  computeCredibilityProfile,
  deduplicateSubmissions,
  confidenceBand,
  MAX_ATTEMPTS_PER_THEME,
  MIN_ACCURACY_FOR_EXPERT,
  MIN_ATTEMPTS_FOR_EXPERT,
  type ExerciseRecord,
} from '../credibilityEngine';

// ── Test data builders ─────────────────────────────────────────────────────────

let _id = 0;
function makeExercise(
  theme: ExerciseRecord['theme'],
  score: number,
  maxScore = 1,
  createdAt?: number,
): ExerciseRecord {
  _id++;
  return {
    id:        `ex_${_id}`,
    theme,
    score,
    maxScore,
    createdAt: createdAt ?? _id * 120_000, // 2 min apart by default — safely outside duplicate window
  };
}

// ── 1. computeThemeStats ──────────────────────────────────────────────────────

describe('computeThemeStats', () => {
  it('returns empty object for empty input', () => {
    expect(computeThemeStats([])).toEqual({});
  });

  it('aggregates attempts, totalScore, totalMaxScore and accuracy per theme', () => {
    const exs: ExerciseRecord[] = [
      makeExercise('pricing', 1),    // 1/1
      makeExercise('pricing', 0.5),  // 0.5/1
      makeExercise('ux', 0),         // 0/1
    ];
    const stats = computeThemeStats(exs);

    expect(stats.pricing?.attempts).toBe(2);
    expect(stats.pricing?.totalScore).toBeCloseTo(1.5);
    expect(stats.pricing?.totalMaxScore).toBe(2);
    expect(stats.pricing?.accuracy).toBeCloseTo(0.75);

    expect(stats.ux?.attempts).toBe(1);
    expect(stats.ux?.accuracy).toBe(0);
  });

  it('computes accuracy as totalScore / totalMaxScore (point-based, not attempt-count-based)', () => {
    // Two attempts: one correct (1.0) and one half-correct (0.5) with maxScore 1 each
    // accuracy = (1 + 0.5) / (1 + 1) = 0.75  (NOT 1/2 correct answers = 0.5)
    const exs = [makeExercise('onboarding', 1), makeExercise('onboarding', 0.5)];
    const stats = computeThemeStats(exs);
    expect(stats.onboarding?.accuracy).toBeCloseTo(0.75);
  });

  it('handles a single exercise correctly', () => {
    const exs = [makeExercise('trust', 0.5)];
    const stats = computeThemeStats(exs);
    expect(stats.trust?.attempts).toBe(1);
    expect(stats.trust?.accuracy).toBeCloseTo(0.5);
  });

  it('ignores themes with zero exercises (no phantom keys)', () => {
    const exs = [makeExercise('value', 1)];
    const stats = computeThemeStats(exs);
    expect(Object.keys(stats)).toEqual(['value']);
  });
});

// ── 2. computeExpertTags ──────────────────────────────────────────────────────

describe('computeExpertTags', () => {
  it('returns no expert tags when themeStats is empty', () => {
    expect(computeExpertTags({})).toEqual({});
  });

  it('SPEC: single high-score attempt → NOT expert (below MIN_ATTEMPTS)', () => {
    const stats = computeThemeStats([makeExercise('pricing', 1)]);
    const tags  = computeExpertTags(stats);
    expect(tags.pricing?.isExpert).toBe(false);
    expect(tags.pricing?.attempts).toBe(1);
  });

  it('SPEC: two attempts both scoring 0.5 (accuracy 0.5) → NOT expert (below 60%)', () => {
    const exs  = [makeExercise('ux', 0.5), makeExercise('ux', 0.5)];
    const tags = computeExpertTags(computeThemeStats(exs));
    expect(tags.ux?.isExpert).toBe(false);
    expect(tags.ux?.accuracy).toBeCloseTo(0.5);
  });

  it('SPEC: two medium scores (accuracy ≥ 0.6) → becomes expert', () => {
    // 0.5 + 1.0 = 1.5 / 2.0 = 0.75 accuracy ≥ 0.6 ✓ and attempts = 2 ≥ 2 ✓
    const exs  = [makeExercise('onboarding', 0.5), makeExercise('onboarding', 1)];
    const tags = computeExpertTags(computeThemeStats(exs));
    expect(tags.onboarding?.isExpert).toBe(true);
  });

  it('marks as expert at exactly the thresholds (boundary)', () => {
    // Exactly 0.60 accuracy over exactly 2 attempts
    // score = 0.6 each on maxScore 1: totalScore = 1.2, accuracy = 0.6
    const exs = [
      makeExercise('trust', 0.6),
      makeExercise('trust', 0.6),
    ];
    const tags = computeExpertTags(computeThemeStats(exs));
    expect(tags.trust?.isExpert).toBe(true);
  });

  it('SPEC: regression — user drops below 60% after more attempts → tag revoked', () => {
    // Initially: 2 attempts, accuracy = 0.75 → expert
    const initial = [makeExercise('pricing', 0.5), makeExercise('pricing', 1)];
    expect(computeExpertTags(computeThemeStats(initial)).pricing?.isExpert).toBe(true);

    // Now add 4 more attempts all scoring 0 → accuracy drops
    // (0.5 + 1 + 0 + 0 + 0 + 0) / 6 = 1.5 / 6 = 0.25 — below 60%
    const regressed = [
      ...initial,
      makeExercise('pricing', 0),
      makeExercise('pricing', 0),
      makeExercise('pricing', 0),
      makeExercise('pricing', 0),
    ];
    expect(computeExpertTags(computeThemeStats(regressed)).pricing?.isExpert).toBe(false);
  });

  it('includes accuracy and attempts in every tag entry', () => {
    const exs  = [makeExercise('value', 1), makeExercise('value', 1)];
    const tags = computeExpertTags(computeThemeStats(exs));
    expect(tags.value?.accuracy).toBeCloseTo(1);
    expect(tags.value?.attempts).toBe(2);
    expect(tags.value?.isExpert).toBe(true);
  });
});

// ── 3. computeCredibilityScore ────────────────────────────────────────────────

describe('computeCredibilityScore', () => {
  it('returns 0 for empty stats', () => {
    expect(computeCredibilityScore({})).toBe(0);
  });

  it('returns 0 for a theme with 0 accuracy and 1 attempt', () => {
    const stats = computeThemeStats([makeExercise('ux', 0)]);
    expect(computeCredibilityScore(stats)).toBe(0);
  });

  it('SPEC: single high score → low credibility (volume drag)', () => {
    // 1 attempt at perfect accuracy in 1 theme
    // Volume_i   = log(1 + 1) = log(2) ≈ 0.693
    // Volume_max = log(1 + 10) = log(11) ≈ 2.398
    // Score = (1.0 × 0.693) / 2.398 × 100 ≈ 28.9 → 29
    const stats = computeThemeStats([makeExercise('pricing', 1)]);
    const score = computeCredibilityScore(stats);
    expect(score).toBe(29);   // deterministic
    expect(score).toBeLessThan(40); // well below max
  });

  it('SPEC: many attempts → higher credibility (volume rewards)', () => {
    // 4 attempts all at 0.68 accuracy
    const exs = Array.from({ length: 4 }, () => makeExercise('pricing', 0.68));
    const score4 = computeCredibilityScore(computeThemeStats(exs));

    const exs10 = Array.from({ length: 10 }, () => makeExercise('pricing', 0.68));
    const score10 = computeCredibilityScore(computeThemeStats(exs10));

    expect(score10).toBeGreaterThan(score4);
  });

  it('caps volume at MAX_ATTEMPTS_PER_THEME (11th attempt adds no extra weight)', () => {
    const exs10 = Array.from({ length: MAX_ATTEMPTS_PER_THEME }, () =>
      makeExercise('ux', 1),
    );
    const exs11 = [...exs10, makeExercise('ux', 1)];

    expect(computeCredibilityScore(computeThemeStats(exs10))).toBe(
      computeCredibilityScore(computeThemeStats(exs11)),
    );
  });

  it('perfect accuracy + max attempts in one theme → 100', () => {
    const exs = Array.from({ length: MAX_ATTEMPTS_PER_THEME }, () =>
      makeExercise('pricing', 1),
    );
    expect(computeCredibilityScore(computeThemeStats(exs))).toBe(100);
  });

  it('perfect accuracy + max attempts across all 5 themes → 100', () => {
    const themes: ExerciseRecord['theme'][] = ['pricing', 'ux', 'onboarding', 'trust', 'value'];
    const exs = themes.flatMap(t =>
      Array.from({ length: MAX_ATTEMPTS_PER_THEME }, () => makeExercise(t, 1)),
    );
    expect(computeCredibilityScore(computeThemeStats(exs))).toBe(100);
  });

  it('SPEC: mixed domain — high accuracy one theme, low another', () => {
    const pricing = Array.from({ length: 4 }, () => makeExercise('pricing', 1));
    const ux      = Array.from({ length: 3 }, () => makeExercise('ux', 0));
    const score   = computeCredibilityScore(computeThemeStats([...pricing, ...ux]));
    // Score is pulled down significantly by the zero-accuracy ux theme
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(50);
  });

  it('score is always an integer 0–100', () => {
    for (let i = 1; i <= 10; i++) {
      const exs   = Array.from({ length: i }, (_, j) =>
        makeExercise('value', (j % 2 === 0 ? 1 : 0.5)),
      );
      const score = computeCredibilityScore(computeThemeStats(exs));
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

// ── 4. computeCredibilityProfile (master function) ────────────────────────────

describe('computeCredibilityProfile', () => {
  it('returns zero-state profile for empty exercises', () => {
    const p = computeCredibilityProfile([]);
    expect(p.score).toBe(0);
    expect(p.confidence).toBe('low');
    expect(p.expertThemes).toEqual([]);
    expect(p.totalExercises).toBe(0);
    expect(p.breakdown).toEqual({});
  });

  it('SPEC output contract — includes all required fields', () => {
    const exs = [makeExercise('pricing', 1), makeExercise('pricing', 0.5)];
    const p   = computeCredibilityProfile(exs);

    expect(typeof p.score).toBe('number');
    expect(p.themes).toBeDefined();
    expect(p.expertTags).toBeDefined();
    expect(p.expertThemes).toBeInstanceOf(Array);
    expect(p.breakdown).toBeDefined();
    expect(p.breakdown.pricing).toMatchObject({ accuracy: expect.any(Number), attempts: 2 });
  });

  it('expertThemes only contains themes where isExpert === true', () => {
    const exs = [
      // pricing: 4 attempts, accuracy 0.75 → expert
      ...Array.from({ length: 4 }, () => makeExercise('pricing', 0.75)),
      // ux: 3 attempts, accuracy 0.33 → NOT expert
      ...Array.from({ length: 3 }, () => makeExercise('ux', 0.33)),
    ];
    const p = computeCredibilityProfile(exs);
    expect(p.expertThemes).toContain('pricing');
    expect(p.expertThemes).not.toContain('ux');
  });

  it('totalExercises reflects deduplicated count', () => {
    const ts = Date.now();
    // 3 exercises: first two for pricing are within 60s window → second is deduped
    const exs: ExerciseRecord[] = [
      { id: 'a', theme: 'pricing', score: 1, maxScore: 1, createdAt: ts },
      { id: 'b', theme: 'pricing', score: 1, maxScore: 1, createdAt: ts + 10_000 }, // < 60s
      { id: 'c', theme: 'ux',      score: 1, maxScore: 1, createdAt: ts + 70_000 }, // new theme, OK
    ];
    const p = computeCredibilityProfile(exs);
    // 'b' dropped → 2 exercises counted
    expect(p.totalExercises).toBe(2);
  });

  it('confidence is low for < 5 exercises', () => {
    const exs = [makeExercise('pricing', 1)];
    expect(computeCredibilityProfile(exs).confidence).toBe('low');
  });

  it('confidence is medium for 5–14 exercises', () => {
    const exs = Array.from({ length: 7 }, () => makeExercise('pricing', 1));
    expect(computeCredibilityProfile(exs).confidence).toBe('medium');
  });

  it('confidence is high for ≥ 15 exercises', () => {
    const exs = Array.from({ length: 15 }, () => makeExercise('pricing', 1));
    expect(computeCredibilityProfile(exs).confidence).toBe('high');
  });
});

// ── 5. deduplicateSubmissions ─────────────────────────────────────────────────

describe('deduplicateSubmissions', () => {
  it('returns all exercises when none are within the duplicate window', () => {
    const exs: ExerciseRecord[] = [
      { id: '1', theme: 'pricing', score: 1, maxScore: 1, createdAt: 0 },
      { id: '2', theme: 'pricing', score: 1, maxScore: 1, createdAt: 60_001 }, // just outside window
    ];
    expect(deduplicateSubmissions(exs)).toHaveLength(2);
  });

  it('drops the second submission when same theme appears within 60 s', () => {
    const ts = Date.now();
    const exs: ExerciseRecord[] = [
      { id: '1', theme: 'pricing', score: 1, maxScore: 1, createdAt: ts },
      { id: '2', theme: 'pricing', score: 1, maxScore: 1, createdAt: ts + 30_000 }, // 30s later
    ];
    const result = deduplicateSubmissions(exs);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1'); // earliest kept
  });

  it('does NOT drop submissions of different themes within the window', () => {
    const ts = Date.now();
    const exs: ExerciseRecord[] = [
      { id: '1', theme: 'pricing', score: 1, maxScore: 1, createdAt: ts },
      { id: '2', theme: 'ux',      score: 1, maxScore: 1, createdAt: ts + 5_000 }, // different theme
    ];
    expect(deduplicateSubmissions(exs)).toHaveLength(2);
  });

  it('allows the same theme again after the window has passed', () => {
    const ts = Date.now();
    const exs: ExerciseRecord[] = [
      { id: '1', theme: 'pricing', score: 1, maxScore: 1, createdAt: ts },
      { id: '2', theme: 'pricing', score: 1, maxScore: 1, createdAt: ts + 61_000 }, // > 60s
    ];
    expect(deduplicateSubmissions(exs)).toHaveLength(2);
  });

  it('handles empty array', () => {
    expect(deduplicateSubmissions([])).toEqual([]);
  });
});

// ── 6. confidenceBand ─────────────────────────────────────────────────────────

describe('confidenceBand', () => {
  it('returns low for 0 exercises', ()  => expect(confidenceBand(0)).toBe('low'));
  it('returns low for 4 exercises', ()  => expect(confidenceBand(4)).toBe('low'));
  it('returns medium for 5 exercises',  () => expect(confidenceBand(5)).toBe('medium'));
  it('returns medium for 14 exercises', () => expect(confidenceBand(14)).toBe('medium'));
  it('returns high for 15 exercises',   () => expect(confidenceBand(15)).toBe('high'));
  it('returns high for 100 exercises',  () => expect(confidenceBand(100)).toBe('high'));
});

// ── 7. Constants sanity check ─────────────────────────────────────────────────

describe('constants', () => {
  it('MIN_ATTEMPTS_FOR_EXPERT is 2', () => {
    expect(MIN_ATTEMPTS_FOR_EXPERT).toBe(2);
  });

  it('MIN_ACCURACY_FOR_EXPERT is 0.60', () => {
    expect(MIN_ACCURACY_FOR_EXPERT).toBeCloseTo(0.6);
  });

  it('MAX_ATTEMPTS_PER_THEME is 10', () => {
    expect(MAX_ATTEMPTS_PER_THEME).toBe(10);
  });
});
