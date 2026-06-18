import type { DrilloopState } from '../types/drilloop';
import { getCatalog } from './drilloopCatalog';
import { computeStreaks } from './drilloopStore';

// ── Drilloop community roster (creator-side, privacy-preserving) ──
// The creator needs to manage a community without surfacing members' identities
// or private answers. We expose only: a privacy-safe handle, a coarse activity
// status, tier, and "wins" — achievement phrases derived from milestones, never
// raw scores or content. In production this reads aggregated member rows with
// the same redaction; here it blends a deterministic demo cohort with the real
// local member so the roster tells a believable story from the first visit.

export type MemberStatus = 'active' | 'inactive';

export interface CommunityMember {
  id: string;
  /** Privacy-safe display — first name + last initial, or "Member N". Never PII. */
  handle: string;
  initials: string;
  status: MemberStatus;
  tier: 'free' | 'member';
  drillsCompleted: number;
  streak: number;
  /** Coarse recency label; no exact timestamps exposed. */
  lastActive: string;
  /** Achievement phrases — privacy-safe, milestone-derived. */
  wins: string[];
  isYou: boolean;
}

export interface CommunitySummary {
  total: number;
  active: number;
  inactive: number;
  paid: number;
  free: number;
}

interface SeedMember {
  first: string;
  lastInitial: string;
  drills: number;
  streak: number;
  daysSinceActive: number;
  tier: 'free' | 'member';
  mastery: number; // 0-1
}

// Deterministic demo cohort — varied tiers, activity, and progress so the
// active/inactive split and the free→paid funnel both look real.
const SEED: SeedMember[] = [
  { first: 'Priya', lastInitial: 'M', drills: 18, streak: 11, daysSinceActive: 0, tier: 'member', mastery: 0.72 },
  { first: 'Marcus', lastInitial: 'T', drills: 14, streak: 6, daysSinceActive: 1, tier: 'member', mastery: 0.61 },
  { first: 'Lena', lastInitial: 'K', drills: 12, streak: 4, daysSinceActive: 0, tier: 'member', mastery: 0.55 },
  { first: 'Devon', lastInitial: 'R', drills: 7, streak: 0, daysSinceActive: 9, tier: 'free', mastery: 0.40 },
  { first: 'Sofia', lastInitial: 'A', drills: 9, streak: 3, daysSinceActive: 2, tier: 'member', mastery: 0.48 },
  { first: 'Aiden', lastInitial: 'B', drills: 3, streak: 0, daysSinceActive: 14, tier: 'free', mastery: 0.22 },
  { first: 'Rina', lastInitial: 'S', drills: 5, streak: 2, daysSinceActive: 4, tier: 'free', mastery: 0.33 },
  { first: 'Tomás', lastInitial: 'G', drills: 16, streak: 8, daysSinceActive: 1, tier: 'member', mastery: 0.66 },
];

function recencyLabel(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  return `${Math.floor(days / 7)} weeks ago`;
}

// A member is "inactive" if no streak and not seen in a week.
function statusOf(streak: number, daysSinceActive: number): MemberStatus {
  return streak > 0 || daysSinceActive < 7 ? 'active' : 'inactive';
}

function winsFor(drills: number, streak: number, mastery: number, tier: 'free' | 'member', total: number): string[] {
  const wins: string[] = [];
  if (streak >= 7) wins.push(`🔥 ${streak}-day streak`);
  else if (streak >= 3) wins.push(`🔥 ${streak}-day streak`);
  if (mastery >= 0.65) wins.push('💎 Sharp judgment');
  if (total > 0 && drills / total >= 0.5) wins.push('🚀 Halfway through the program');
  if (drills >= 15) wins.push('🧠 15+ drills cleared');
  if (tier === 'member' && wins.length === 0) wins.push('✨ Active member');
  if (wins.length === 0 && drills > 0) wins.push('🎯 Getting started');
  return wins.slice(0, 3);
}

export function getCommunityRoster(member: DrilloopState): CommunityMember[] {
  const total = getCatalog().length;

  const cohort: CommunityMember[] = SEED.map((m, i) => ({
    id: `seed-${i}`,
    handle: `${m.first} ${m.lastInitial}.`,
    initials: `${m.first[0]}${m.lastInitial}`,
    status: statusOf(m.streak, m.daysSinceActive),
    tier: m.tier,
    drillsCompleted: m.drills,
    streak: m.streak,
    lastActive: recencyLabel(m.daysSinceActive),
    wins: winsFor(m.drills, m.streak, m.mastery, m.tier, total),
    isYou: false,
  }));

  // The real local member, if they've done anything.
  const youDone = new Set(member.attempts.map(a => a.drillId)).size;
  if (youDone > 0) {
    const { current } = computeStreaks(member.attempts);
    const youMastery = member.attempts.length
      ? member.attempts.filter(a => a.selfRating === 'nailed').length / member.attempts.length
      : 0;
    cohort.unshift({
      id: 'you',
      handle: member.memberName || 'You',
      initials: '🙂',
      status: 'active',
      tier: member.tier,
      drillsCompleted: youDone,
      streak: current,
      lastActive: 'Today',
      wins: winsFor(youDone, current, youMastery, member.tier, total),
      isYou: true,
    });
  }

  return cohort.sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.drillsCompleted - a.drillsCompleted);
}

export function summarize(roster: CommunityMember[]): CommunitySummary {
  return {
    total: roster.length,
    active: roster.filter(m => m.status === 'active').length,
    inactive: roster.filter(m => m.status === 'inactive').length,
    paid: roster.filter(m => m.tier === 'member').length,
    free: roster.filter(m => m.tier === 'free').length,
  };
}
