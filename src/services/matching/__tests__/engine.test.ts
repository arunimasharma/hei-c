import { describe, it, expect } from 'vitest';
import {
  scorePair,
  knowledgeComplement,
  goalAlignment,
  scoreAllPairs,
  selectPairs,
  runMatching,
  pairKey,
  DEFAULT_MATCH_CONFIG,
  type CandidateMember,
  type PairHistory,
  type ScoredPair,
} from '../engine';
import { emptyProfile } from '../profileMerge';
import type { PhaseStrength, WeightedTag } from '../../../types/connect';

const NOW = Date.parse('2026-06-12T00:00:00.000Z');
const cfg = DEFAULT_MATCH_CONFIG;

function tag(t: string, weight = 0.8): WeightedTag {
  return { tag: t, weight, lastSeen: '2026-06-01T00:00:00.000Z' };
}

function phase(p: number, mastery: number, attempts = 3): PhaseStrength {
  return { userId: 'x', phase: p, attempts, avgScore: mastery, mastery };
}

function member(
  userId: string,
  over: {
    offering?: WeightedTag[];
    seeking?: WeightedTag[];
    interests?: { text: string; weight: number; lastSeen: string }[];
    phases?: PhaseStrength[];
    optIn?: boolean;
    lifetime?: number;
  } = {},
): CandidateMember {
  const profile = emptyProfile(userId, '2026-06-01T00:00:00.000Z');
  profile.offeringTags = over.offering ?? [];
  profile.seekingTags = over.seeking ?? [];
  profile.interests = over.interests ?? [];
  if (over.optIn === false) profile.matchingOptIn = false;
  return {
    userId,
    profile,
    phaseStrengths: over.phases ?? [],
    lifetimeSuggestions: over.lifetime ?? 0,
  };
}

describe('pairKey', () => {
  it('is order-independent', () => {
    expect(pairKey('b', 'a')).toBe(pairKey('a', 'b'));
    expect(pairKey('a', 'b')).toBe('a::b');
  });
});

describe('knowledgeComplement', () => {
  it('rewards strong-vs-weak in a shared phase', () => {
    const a = member('a', { phases: [phase(2, 90)] });
    const b = member('b', { phases: [phase(2, 20)] });
    expect(knowledgeComplement(a, b, cfg)).toBeGreaterThan(0);
  });

  it('is zero when both are strong (no complementarity)', () => {
    const a = member('a', { phases: [phase(2, 90)] });
    const b = member('b', { phases: [phase(2, 85)] });
    expect(knowledgeComplement(a, b, cfg)).toBe(0);
  });

  it('ignores phases with no attempts', () => {
    const a = member('a', { phases: [phase(2, 90, 0)] });
    const b = member('b', { phases: [phase(2, 10, 0)] });
    expect(knowledgeComplement(a, b, cfg)).toBe(0);
  });
});

describe('goalAlignment', () => {
  it('rewards offering↔seeking overlap in both directions', () => {
    const a = member('a', { offering: [tag('evals')], seeking: [tag('fundraising')] });
    const b = member('b', { offering: [tag('fundraising')], seeking: [tag('evals')] });
    expect(goalAlignment(a, b)).toBeGreaterThan(0);
  });

  it('is zero with no tag overlap', () => {
    const a = member('a', { offering: [tag('evals')] });
    const b = member('b', { seeking: [tag('design')] });
    expect(goalAlignment(a, b)).toBe(0);
  });
});

describe('scorePair — match type classification', () => {
  it('labels goal_aligned when only alignment present', () => {
    const a = member('a', { offering: [tag('evals')] });
    const b = member('b', { seeking: [tag('evals')] });
    expect(scorePair(a, b, cfg).matchType).toBe('goal_aligned');
  });

  it('labels knowledge_complement when only knowledge present', () => {
    const a = member('a', { phases: [phase(2, 90)] });
    const b = member('b', { phases: [phase(2, 10)] });
    expect(scorePair(a, b, cfg).matchType).toBe('knowledge_complement');
  });

  it('labels mixed when both present', () => {
    const a = member('a', { phases: [phase(2, 90)], offering: [tag('evals')] });
    const b = member('b', { phases: [phase(2, 10)], seeking: [tag('evals')] });
    expect(scorePair(a, b, cfg).matchType).toBe('mixed');
  });

  it('emits canonical a<b ordering regardless of input order', () => {
    const a = member('zeta', { offering: [tag('x')] });
    const b = member('alpha', { seeking: [tag('x')] });
    const sp = scorePair(a, b, cfg);
    expect(sp.memberAId).toBe('alpha');
    expect(sp.memberBId).toBe('zeta');
  });
});

describe('scoreAllPairs', () => {
  it('excludes opted-out members', () => {
    const a = member('a', { offering: [tag('x')] });
    const b = member('b', { seeking: [tag('x')], optIn: false });
    expect(scoreAllPairs([a, b], cfg)).toHaveLength(0);
  });

  it('drops pairs below minScore and sorts desc', () => {
    const strong = [
      member('a', { phases: [phase(2, 90)], offering: [tag('x')] }),
      member('b', { phases: [phase(2, 10)], seeking: [tag('x')] }),
    ];
    const weak = [member('c'), member('d')];
    const pairs = scoreAllPairs([...strong, ...weak], cfg);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    // top pair is the strong a/b pairing
    expect(new Set([pairs[0].memberAId, pairs[0].memberBId])).toEqual(new Set(['a', 'b']));
    for (let i = 1; i < pairs.length; i++) expect(pairs[i - 1].score).toBeGreaterThanOrEqual(pairs[i].score);
  });
});

describe('selectPairs — guardrails', () => {
  const mk = (a: string, b: string, score: number): ScoredPair => ({
    memberAId: a < b ? a : b,
    memberBId: a < b ? b : a,
    score,
    matchType: 'goal_aligned',
    rationale: '',
    knowledgeScore: 0,
    alignmentScore: score,
  });

  it('respects per-member cap', () => {
    const c = { ...cfg, maxSuggestionsPerRun: 1 };
    const ranked = [mk('a', 'b', 0.9), mk('a', 'c', 0.8), mk('b', 'c', 0.7)];
    const selected = selectPairs(ranked, new Map(), c, NOW);
    // a appears once (cap 1), so a-c is dropped; b-c selected since b still has room? b used in a-b -> b at cap -> b-c dropped too
    const counts: Record<string, number> = {};
    for (const p of selected) { counts[p.memberAId] = (counts[p.memberAId] ?? 0) + 1; counts[p.memberBId] = (counts[p.memberBId] ?? 0) + 1; }
    expect(Object.values(counts).every(n => n <= 1)).toBe(true);
  });

  it('skips a pair in cooldown after a recent decline', () => {
    const history = new Map<string, PairHistory>([
      [pairKey('a', 'b'), { lastDeclinedAt: new Date(NOW - 1 * 7 * 86_400_000).toISOString() }],
    ]);
    const selected = selectPairs([mk('a', 'b', 0.9)], history, cfg, NOW);
    expect(selected).toHaveLength(0);
  });

  it('re-allows a pair once cooldown has elapsed', () => {
    const history = new Map<string, PairHistory>([
      [pairKey('a', 'b'), { lastDeclinedAt: new Date(NOW - 9 * 7 * 86_400_000).toISOString() }],
    ]);
    const selected = selectPairs([mk('a', 'b', 0.9)], history, cfg, NOW);
    expect(selected).toHaveLength(1);
  });

  it('skips pairs that are already active', () => {
    const history = new Map<string, PairHistory>([[pairKey('a', 'b'), { active: true }]]);
    expect(selectPairs([mk('a', 'b', 0.9)], history, cfg, NOW)).toHaveLength(0);
  });
});

describe('runMatching — end to end (deterministic)', () => {
  it('produces guardrail-respecting selections from candidate members', () => {
    const members = [
      member('a', { phases: [phase(2, 95)], offering: [tag('evals')] }),
      member('b', { phases: [phase(2, 5)], seeking: [tag('evals')] }),
      member('c', { offering: [tag('design')] }),
      member('d', { seeking: [tag('design')] }),
    ];
    const selected = runMatching(members, new Map(), cfg, NOW);
    expect(selected.length).toBeGreaterThanOrEqual(1);
    // canonical ordering holds for every selected pair
    for (const p of selected) expect(p.memberAId < p.memberBId).toBe(true);
  });
});
