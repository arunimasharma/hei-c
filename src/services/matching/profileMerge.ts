import type {
  MemberProfile,
  ProfileExtraction,
  WeightedTag,
  WeightedGoal,
} from '../../types/connect';
import { DEFAULT_VISIBILITY } from '../../types/connect';

// ── Profile merge + decay ──
// The highest-risk new logic: a member's structured profile must EVOLVE as they
// answer more profile drills, not be overwritten each time. Recent signals
// dominate; stale signals fade gracefully instead of lingering forever or
// vanishing on the next answer. Pure + deterministic so it can be unit-tested.
//
// Every signal carries a weight in [0,1]. On each new extraction we:
//   1. decay every existing signal:        weight *= DECAY
//   2. reinforce / insert mentioned ones:  weight = min(1, weight + INCREMENT)
//   3. prune signals that fell below FLOOR
// `now` is injected (never read from the clock) so tests are deterministic.

export interface MergeConfig {
  /** Multiplier applied to every existing signal each merge. */
  decay: number;
  /** Added to a signal's weight when it is mentioned again (or first seen). */
  increment: number;
  /** Signals below this weight after a merge are dropped. */
  floor: number;
  /** Max goals / interests retained (most-recent, highest-weight kept). */
  maxGoals: number;
  /** Max tags retained per tag bucket. */
  maxTags: number;
}

export const DEFAULT_MERGE_CONFIG: MergeConfig = {
  decay: 0.9,
  increment: 0.5,
  floor: 0.15,
  maxGoals: 8,
  maxTags: 20,
};

/** Normalize a tag/goal phrase for dedupe (case/space/punctuation-insensitive). */
export function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?]+$/g, '');
}

/** A fresh, empty profile for a member who has no profile-drill answers yet. */
export function emptyProfile(userId: string, now: string): MemberProfile {
  return {
    userId,
    goals: [],
    interests: [],
    expertiseTags: [],
    seekingTags: [],
    offeringTags: [],
    senioritySignal: null,
    summary: null,
    matchingOptIn: true, // opt-out default
    visibility: { ...DEFAULT_VISIBILITY },
    lastUpdated: now,
  };
}

/**
 * Merge a list of newly-mentioned phrases into an existing weighted list.
 * `keyOf` extracts the stored phrase; `make` builds a new entry. Generic over
 * tags ({tag,...}) and goals ({text,...}) so both buckets share one algorithm.
 */
function mergeWeighted<T extends { weight: number; lastSeen: string }>(
  existing: T[],
  mentioned: string[],
  cfg: MergeConfig,
  cap: number,
  keyOf: (item: T) => string,
  make: (phrase: string, weight: number, now: string) => T,
  now: string,
): T[] {
  // 1. decay everything that already exists
  const byKey = new Map<string, T>();
  for (const item of existing) {
    byKey.set(normalizeKey(keyOf(item)), { ...item, weight: item.weight * cfg.decay });
  }

  // 2. reinforce / insert each mentioned phrase (dedupe within the batch too)
  const seenThisBatch = new Set<string>();
  for (const raw of mentioned) {
    const phrase = raw.trim();
    if (!phrase) continue;
    const key = normalizeKey(phrase);
    if (seenThisBatch.has(key)) continue;
    seenThisBatch.add(key);

    const prior = byKey.get(key);
    if (prior) {
      byKey.set(key, { ...prior, weight: Math.min(1, prior.weight + cfg.increment), lastSeen: now });
    } else {
      byKey.set(key, make(phrase, Math.min(1, cfg.increment), now));
    }
  }

  // 3. prune below floor, then cap by weight (then recency) — strongest signals win
  return [...byKey.values()]
    .filter(item => item.weight >= cfg.floor)
    .sort((a, b) => b.weight - a.weight || b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, cap);
}

const makeTag = (tag: string, weight: number, lastSeen: string): WeightedTag => ({ tag, weight, lastSeen });
const makeGoal = (text: string, weight: number, lastSeen: string): WeightedGoal => ({ text, weight, lastSeen });

/**
 * Merge a new profile-drill extraction into a member's evolving profile.
 * Returns a new profile (never mutates the input). `now` is injected.
 */
export function mergeProfile(
  current: MemberProfile,
  extraction: ProfileExtraction,
  now: string,
  cfg: MergeConfig = DEFAULT_MERGE_CONFIG,
): MemberProfile {
  return {
    ...current,
    goals: mergeWeighted(current.goals, extraction.goals ?? [], cfg, cfg.maxGoals, g => g.text, makeGoal, now),
    interests: mergeWeighted(current.interests, extraction.interests ?? [], cfg, cfg.maxGoals, g => g.text, makeGoal, now),
    expertiseTags: mergeWeighted(current.expertiseTags, extraction.expertiseTags ?? [], cfg, cfg.maxTags, t => t.tag, makeTag, now),
    seekingTags: mergeWeighted(current.seekingTags, extraction.seekingTags ?? [], cfg, cfg.maxTags, t => t.tag, makeTag, now),
    offeringTags: mergeWeighted(current.offeringTags, extraction.offeringTags ?? [], cfg, cfg.maxTags, t => t.tag, makeTag, now),
    // Seniority is a point-in-time signal: latest non-empty wins.
    senioritySignal: extraction.senioritySignal?.trim() || current.senioritySignal,
    summary: buildSummary(current, extraction),
    lastUpdated: now,
  };
}

/** A short human-readable summary used in match-rationale prompts. */
function buildSummary(current: MemberProfile, extraction: ProfileExtraction): string {
  const topGoals = (extraction.goals ?? []).slice(0, 2);
  const offering = (extraction.offeringTags ?? []).slice(0, 3);
  const seeking = (extraction.seekingTags ?? []).slice(0, 3);
  const parts: string[] = [];
  if (topGoals.length) parts.push(`Working on: ${topGoals.join('; ')}.`);
  if (offering.length) parts.push(`Can offer: ${offering.join(', ')}.`);
  if (seeking.length) parts.push(`Seeking: ${seeking.join(', ')}.`);
  return parts.join(' ') || current.summary || '';
}
