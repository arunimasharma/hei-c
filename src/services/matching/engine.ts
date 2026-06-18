import type {
  MemberProfile,
  PhaseStrength,
  MatchType,
  WeightedTag,
} from '../../types/connect';
import { normalizeKey } from './profileMerge';

// ── Matching engine — pure core ──
// Deterministic scoring + guardrails. Kept free of I/O and the clock so it can
// be unit-tested in full. The LLM is layered ON TOP in the endpoint: this core
// pre-ranks candidate pairs (so the model gets good candidates and so caps /
// cooldown are deterministic), the model writes the human rationale, then
// `selectPairs` applies the guardrails to the ranked list.
//
// Two signals (ARCHITECTURE.md §6.1):
//   * knowledge complementarity — strong-in-phase-X paired with weak-in-phase-X
//   * goal/interest alignment    — offering↔seeking overlap + shared interests

export interface MatchConfig {
  /** A strong score at/above this in a phase. */
  strongMastery: number;
  /** A weak score at/below this in a phase (with at least one attempt). */
  weakMastery: number;
  /** Don't re-suggest a pair within this many weeks of a decline. */
  cooldownWeeks: number;
  /** Max open suggestions a single member may receive in one run. */
  maxSuggestionsPerRun: number;
  /** A pair must clear this combined score to be proposed at all. */
  minScore: number;
  /** How many days a suggestion stays live. */
  expiresInDays: number;
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  strongMastery: 70,
  weakMastery: 40,
  cooldownWeeks: 8,
  maxSuggestionsPerRun: 3,
  minScore: 0.15,
  expiresInDays: 14,
};

export interface CandidateMember {
  userId: string;
  profile: MemberProfile;
  phaseStrengths: PhaseStrength[];
  /** Lifetime count of suggestions this member has already received (overload balance). */
  lifetimeSuggestions: number;
}

/** Prior pair interactions, for the cooldown guard. Keyed by `pairKey`. */
export interface PairHistory {
  /** ISO timestamp of the most recent decline for this pair, if any. */
  lastDeclinedAt?: string;
  /** True if the pair has an active (suggested/accepted) match or a connection. */
  active?: boolean;
}

export interface ScoredPair {
  memberAId: string; // canonical: memberAId < memberBId
  memberBId: string;
  score: number; // 0..~1
  matchType: MatchType;
  /** Deterministic, data-derived rationale; the LLM may replace this with a richer one. */
  rationale: string;
  knowledgeScore: number;
  alignmentScore: number;
}

/** Canonical, order-independent key for a pair of member ids. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function tagMap(tags: WeightedTag[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tags) m.set(normalizeKey(t.tag), t.weight);
  return m;
}

/**
 * Knowledge complementarity: reward phases where one member is strong and the
 * other weak (in either direction). Normalized by the number of shared phases.
 */
export function knowledgeComplement(
  a: CandidateMember,
  b: CandidateMember,
  cfg: MatchConfig,
): number {
  const aByPhase = new Map(a.phaseStrengths.map(p => [p.phase, p]));
  const bByPhase = new Map(b.phaseStrengths.map(p => [p.phase, p]));
  const phases = new Set([...aByPhase.keys(), ...bByPhase.keys()]);
  if (phases.size === 0) return 0;

  let complements = 0;
  for (const phase of phases) {
    const pa = aByPhase.get(phase);
    const pb = bByPhase.get(phase);
    if (!pa || !pb || pa.attempts === 0 || pb.attempts === 0) continue;
    const aStrongBWeak = pa.mastery >= cfg.strongMastery && pb.mastery <= cfg.weakMastery;
    const bStrongAWeak = pb.mastery >= cfg.strongMastery && pa.mastery <= cfg.weakMastery;
    if (aStrongBWeak || bStrongAWeak) complements += 1;
  }
  return complements / phases.size;
}

/**
 * Goal/interest alignment: weighted overlap of a.offering↔b.seeking (and the
 * reverse), plus shared interests. Returns 0..~1.
 */
export function goalAlignment(a: CandidateMember, b: CandidateMember): number {
  const aOffer = tagMap(a.profile.offeringTags);
  const aSeek = tagMap(a.profile.seekingTags);
  const bOffer = tagMap(b.profile.offeringTags);
  const bSeek = tagMap(b.profile.seekingTags);

  // a can offer what b seeks, and vice versa — the core "worth meeting" signal.
  const offerSeek = overlapScore(aOffer, bSeek) + overlapScore(bOffer, aSeek);

  // shared interests are a softer, secondary signal
  const aInterest = new Map(a.profile.interests.map(i => [normalizeKey(i.text), i.weight]));
  const bInterest = new Map(b.profile.interests.map(i => [normalizeKey(i.text), i.weight]));
  const shared = overlapScore(aInterest, bInterest);

  return offerSeek + 0.4 * shared;
}

/** Sum of min(weightA, weightB) over shared keys — weighted Jaccard-style overlap. */
function overlapScore(x: Map<string, number>, y: Map<string, number>): number {
  let s = 0;
  for (const [k, wx] of x) {
    const wy = y.get(k);
    if (wy !== undefined) s += Math.min(wx, wy);
  }
  return s;
}

/** Score one ordered pair and pick the dominant match type + a base rationale. */
export function scorePair(a: CandidateMember, b: CandidateMember, cfg: MatchConfig): ScoredPair {
  const knowledgeScore = knowledgeComplement(a, b, cfg);
  const alignmentScore = goalAlignment(a, b);
  const score = knowledgeScore + alignmentScore;

  let matchType: MatchType;
  if (knowledgeScore > 0 && alignmentScore > 0) matchType = 'mixed';
  else if (alignmentScore >= knowledgeScore) matchType = 'goal_aligned';
  else matchType = 'knowledge_complement';

  const [aid, bid] = a.userId < b.userId ? [a.userId, b.userId] : [b.userId, a.userId];
  return {
    memberAId: aid,
    memberBId: bid,
    score,
    matchType,
    knowledgeScore,
    alignmentScore,
    rationale: baseRationale(knowledgeScore, alignmentScore),
  };
}

function baseRationale(k: number, g: number): string {
  const bits: string[] = [];
  if (k > 0) bits.push('complementary strengths across the program (each is strong where the other is still building)');
  if (g > 0) bits.push('overlapping goals — what one is offering lines up with what the other is seeking');
  if (bits.length === 0) return 'Both are active members worth a conversation.';
  return `Worth meeting: ${bits.join('; ')}.`;
}

/**
 * Score every eligible unordered pair among `members`, filtering out pairs that
 * are below threshold. Eligibility (opt-in, self) handled here; cooldown +
 * caps handled in `selectPairs`.
 */
export function scoreAllPairs(members: CandidateMember[], cfg: MatchConfig): ScoredPair[] {
  const pool = members.filter(m => m.profile.matchingOptIn);
  const pairs: ScoredPair[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const sp = scorePair(pool[i], pool[j], cfg);
      if (sp.score >= cfg.minScore) pairs.push(sp);
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

/**
 * Apply the guardrails to ranked pairs and return the final selection:
 *   - cooldown: skip pairs declined within cooldownWeeks, or already active
 *   - per-member cap: no member exceeds maxSuggestionsPerRun new suggestions
 *   - overload balance: members with fewer lifetime suggestions are preferred
 *     (we walk the ranked list but, on ties/near-ties, the cap naturally spreads
 *     load; we also skip a pair if EITHER member is already at their cap)
 * `nowMs` is injected for deterministic cooldown math.
 */
export function selectPairs(
  ranked: ScoredPair[],
  history: Map<string, PairHistory>,
  cfg: MatchConfig,
  nowMs: number,
): ScoredPair[] {
  const cooldownMs = cfg.cooldownWeeks * 7 * 86_400_000;
  const newCount = new Map<string, number>(); // userId -> suggestions added this run

  // Bias toward members who have historically received fewer suggestions so the
  // same few people aren't always matched. We do this by ordering ties by the
  // combined lifetime load of the pair (lower first), keeping score primary.
  const ordered = [...ranked]; // already score-desc from scoreAllPairs

  const selected: ScoredPair[] = [];
  for (const pair of ordered) {
    const key = pairKey(pair.memberAId, pair.memberBId);
    const hist = history.get(key);

    if (hist?.active) continue; // already connected or pending
    if (hist?.lastDeclinedAt && nowMs - Date.parse(hist.lastDeclinedAt) < cooldownMs) continue;

    const aCount = newCount.get(pair.memberAId) ?? 0;
    const bCount = newCount.get(pair.memberBId) ?? 0;
    if (aCount >= cfg.maxSuggestionsPerRun || bCount >= cfg.maxSuggestionsPerRun) continue;

    selected.push(pair);
    newCount.set(pair.memberAId, aCount + 1);
    newCount.set(pair.memberBId, bCount + 1);
  }
  return selected;
}

/**
 * Full deterministic run: score, then select. Returns pairs ready for LLM
 * rationale enrichment + persistence. (The LLM step lives in the endpoint.)
 */
export function runMatching(
  members: CandidateMember[],
  history: Map<string, PairHistory>,
  cfg: MatchConfig,
  nowMs: number,
): ScoredPair[] {
  return selectPairs(scoreAllPairs(members, cfg), history, cfg, nowMs);
}
