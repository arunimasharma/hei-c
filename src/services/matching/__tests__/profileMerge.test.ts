import { describe, it, expect } from 'vitest';
import {
  mergeProfile,
  emptyProfile,
  normalizeKey,
  DEFAULT_MERGE_CONFIG,
} from '../profileMerge';
import type { ProfileExtraction } from '../../../types/connect';

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-02-01T00:00:00.000Z';
const T2 = '2026-03-01T00:00:00.000Z';

function extraction(over: Partial<ProfileExtraction> = {}): ProfileExtraction {
  return {
    goals: [],
    interests: [],
    expertiseTags: [],
    seekingTags: [],
    offeringTags: [],
    senioritySignal: null,
    ...over,
  };
}

describe('normalizeKey', () => {
  it('lowercases, trims, collapses spaces, strips trailing punctuation', () => {
    expect(normalizeKey('  Multi-Agent   Systems. ')).toBe('multi-agent systems');
    expect(normalizeKey('RAG')).toBe('rag');
  });
});

describe('mergeProfile — first extraction', () => {
  it('inserts new signals at the increment weight', () => {
    const p = emptyProfile('u1', T0);
    const next = mergeProfile(p, extraction({ expertiseTags: ['evals', 'RAG'] }), T1);
    expect(next.expertiseTags.map(t => t.tag).sort()).toEqual(['RAG', 'evals']);
    expect(next.expertiseTags.every(t => t.weight === DEFAULT_MERGE_CONFIG.increment)).toBe(true);
    expect(next.lastUpdated).toBe(T1);
  });

  it('preserves matchingOptIn (opt-out default stays true)', () => {
    const p = emptyProfile('u1', T0);
    const next = mergeProfile(p, extraction({ goals: ['ship an agent'] }), T1);
    expect(next.matchingOptIn).toBe(true);
  });
});

describe('mergeProfile — reinforcement', () => {
  it('reinforces a repeated tag and decays an unmentioned one', () => {
    const p = emptyProfile('u1', T0);
    const a = mergeProfile(p, extraction({ expertiseTags: ['evals', 'RAG'] }), T1);
    // mention only 'evals' again; 'RAG' should decay
    const b = mergeProfile(a, extraction({ expertiseTags: ['evals'] }), T2);
    const evals = b.expertiseTags.find(t => t.tag === 'evals')!;
    const rag = b.expertiseTags.find(t => t.tag === 'RAG')!;
    // evals: 0.5 * 0.9 + 0.5 = 0.95 ; RAG: 0.5 * 0.9 = 0.45
    expect(evals.weight).toBeCloseTo(0.95, 5);
    expect(rag.weight).toBeCloseTo(0.45, 5);
    expect(evals.lastSeen).toBe(T2);
    expect(rag.lastSeen).toBe(T1); // not re-seen
  });

  it('caps weight at 1', () => {
    let p = emptyProfile('u1', T0);
    for (let i = 0; i < 10; i++) p = mergeProfile(p, extraction({ offeringTags: ['mentoring'] }), T1);
    expect(p.offeringTags[0].weight).toBeLessThanOrEqual(1);
    expect(p.offeringTags[0].weight).toBeGreaterThan(0.9);
  });
});

describe('mergeProfile — pruning', () => {
  it('drops a tag once it decays below the floor', () => {
    const cfg = { ...DEFAULT_MERGE_CONFIG, decay: 0.5, floor: 0.2 };
    let p = emptyProfile('u1', T0);
    p = mergeProfile(p, extraction({ seekingTags: ['intros'] }), T1); // weight 0.5
    // decay-only merges: 0.25, then 0.125 (< 0.2 -> pruned)
    p = mergeProfile(p, extraction({ seekingTags: ['other'] }), T2, cfg);
    expect(p.seekingTags.find(t => t.tag === 'intros')?.weight).toBeCloseTo(0.25, 5);
    p = mergeProfile(p, extraction({ seekingTags: ['other'] }), T2, cfg);
    expect(p.seekingTags.find(t => t.tag === 'intros')).toBeUndefined();
  });
});

describe('mergeProfile — dedupe & normalization', () => {
  it('treats differently-cased/spaced phrases as the same signal', () => {
    const p = emptyProfile('u1', T0);
    const next = mergeProfile(p, extraction({ expertiseTags: ['Multi-Agent Systems', 'multi-agent systems  '] }), T1);
    expect(next.expertiseTags).toHaveLength(1);
  });
});

describe('mergeProfile — caps & immutability', () => {
  it('keeps only the strongest goals up to maxGoals', () => {
    const cfg = { ...DEFAULT_MERGE_CONFIG, maxGoals: 2 };
    const p = emptyProfile('u1', T0);
    const next = mergeProfile(p, extraction({ goals: ['g1', 'g2', 'g3', 'g4'] }), T1, cfg);
    expect(next.goals).toHaveLength(2);
  });

  it('does not mutate the input profile', () => {
    const p = emptyProfile('u1', T0);
    const snapshot = JSON.stringify(p);
    mergeProfile(p, extraction({ goals: ['x'] }), T1);
    expect(JSON.stringify(p)).toBe(snapshot);
  });

  it('latest non-empty seniority wins; empty keeps prior', () => {
    let p = emptyProfile('u1', T0);
    p = mergeProfile(p, extraction({ senioritySignal: 'senior PM' }), T1);
    expect(p.senioritySignal).toBe('senior PM');
    p = mergeProfile(p, extraction({ senioritySignal: null }), T2);
    expect(p.senioritySignal).toBe('senior PM');
  });
});
