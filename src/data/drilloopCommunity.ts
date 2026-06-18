// ── Drilloop community + network layer (demo data) ──
// The pitch's social product: Mirror (peer reasoning), Drill Rooms (cohorts),
// Local Chapters (in-person), Expert Collectives (multi-expert programs), and
// the reasoning-based network (matches → connections, per the
// 20260612_drilloop_core migration). All mock here so investors can click a
// living prototype; in production these read from Supabase.

import type { Drill } from '../types/drilloop';

// ── Mirror: how peers reasoned on the same drill ──
export interface PeerAnswer {
  initials: string;
  /** Persona label — never a real identity in the product (Mirror is anonymized). */
  role: string;
  score: number;
  /** A one-or-two-line excerpt of how they reasoned. */
  excerpt: string;
  /** Peer-awarded "Sharp" reactions. */
  sharp: number;
}

// A small pool of plausible peer reasoning, varied by drill so Mirror never
// looks canned. Excerpts are deliberately about *judgment*, not jargon.
const PEER_POOL: PeerAnswer[] = [
  { initials: 'RК', role: 'Senior PM, fintech', score: 88, sharp: 12, excerpt: 'I’d call it a workflow, not an agent — the control flow is fixed and the model only fills a slot. Autonomy is the cost, not the feature.' },
  { initials: 'JT', role: 'Staff Eng, infra', score: 81, sharp: 7, excerpt: 'The honest default is a workflow. I reach for an autonomous loop only when the branching is too wide to enumerate up front.' },
  { initials: 'MA', role: 'Founder, devtools', score: 74, sharp: 4, excerpt: 'I focused on debuggability: non-determinism is a tax you pay on every incident, so I’d gate autonomy behind an eval harness first.' },
  { initials: 'SP', role: 'PM, AI platform', score: 92, sharp: 18, excerpt: 'Spectrum answer: fixed → LLM-routed → tool-calling → autonomous. Most “agents” in the wild are rung two and that’s fine.' },
  { initials: 'DL', role: 'Eng Manager', score: 69, sharp: 3, excerpt: 'I’d ship the workflow, instrument it, and let the data tell me where real autonomy earns its keep.' },
  { initials: 'NV', role: 'Security lead', score: 85, sharp: 9, excerpt: 'My gate is the blast radius: the more the model decides, the more I need sandboxing and human-in-the-loop on the irreversible steps.' },
];

/** Three anonymized peer answers for a drill — deterministic by drill so it's stable. */
export function getPeerAnswers(drill: Drill): PeerAnswer[] {
  const start = (drill.order ?? 0) % PEER_POOL.length;
  return [0, 1, 2].map(i => PEER_POOL[(start + i) % PEER_POOL.length]);
}

export function cohortAnswerCount(drill: Drill): number {
  // A believable "N members answered this" count, stable per drill.
  return 40 + ((drill.order ?? 0) * 7) % 55;
}

// ── Drill Rooms: the small synchronized cohort ──
export interface RoomMember {
  initials: string;
  streak: number;
  drilledToday: boolean;
}

export interface DrillRoom {
  name: string;
  weekTheme: string;
  size: number;
  activeToday: number;
  members: RoomMember[];
}

export const DRILL_ROOM: DrillRoom = {
  name: 'Agentic AI · Cohort 7',
  weekTheme: 'Week 3 — Eval design & autonomy trade-offs',
  size: 14,
  activeToday: 9,
  members: [
    { initials: 'You', streak: 5, drilledToday: true },
    { initials: 'SP', streak: 11, drilledToday: true },
    { initials: 'RK', streak: 8, drilledToday: true },
    { initials: 'NV', streak: 6, drilledToday: false },
    { initials: 'JT', streak: 4, drilledToday: true },
    { initials: 'MA', streak: 3, drilledToday: false },
    { initials: 'DL', streak: 9, drilledToday: true },
    { initials: 'EО', streak: 2, drilledToday: true },
  ],
};

// ── Local Chapters: the cohort steps off the screen ──
export interface LocalChapter {
  city: string;
  flag: string;
  membersNearby: number;
  status: 'active' | 'forming';
  /** Human date string — demo only. */
  nextMeetup: string | null;
  venue: string | null;
  host: string | null;
  /** Members who've RSVP'd to the next session. */
  rsvps: number;
}

export const LOCAL_CHAPTERS: LocalChapter[] = [
  { city: 'San Francisco', flag: '🌉', membersNearby: 23, status: 'active', nextMeetup: 'Thu, Jun 26 · 6:30pm', venue: 'Sightglass Coffee, SoMa', host: 'Hosted by SP', rsvps: 11 },
  { city: 'London', flag: '🇬🇧', membersNearby: 17, status: 'active', nextMeetup: 'Tue, Jul 1 · 7:00pm', venue: 'The Brewdog, Shoreditch', host: 'Hosted by RK', rsvps: 8 },
  { city: 'Bengaluru', flag: '🇮🇳', membersNearby: 19, status: 'forming', nextMeetup: null, venue: null, host: null, rsvps: 0 },
  { city: 'New York', flag: '🗽', membersNearby: 14, status: 'forming', nextMeetup: null, venue: null, host: null, rsvps: 0 },
];

// ── Expert Collective: multiple experts co-teaching one program ──
export interface CollectiveExpert {
  name: string;
  avatar: string;
  specialty: string;
  followers: string;
}

export interface Collective {
  name: string;
  blurb: string;
  experts: CollectiveExpert[];
}

export const COLLECTIVE: Collective = {
  name: 'The Agentic Stack Collective',
  blurb: 'Three sub-scale experts, one flagship program. Each brings a few thousand high-trust followers; together they cover the whole domain — and fill a cohort none could fill alone.',
  experts: [
    { name: 'Arunima Sharma', avatar: '🧭', specialty: 'AI product judgment', followers: '2.3k' },
    { name: 'Devin Lin', avatar: '🛡️', specialty: 'Agent security & threat modeling', followers: '1.8k' },
    { name: 'Maya Okonkwo', avatar: '📐', specialty: 'Eval design & system architecture', followers: '2.9k' },
  ],
};

// ── Reasoning-based network: suggested connections (matches → connections) ──
export interface NetworkMatch {
  initials: string;
  headline: string;
  /** Why the engine paired you — mirrors matches.rationale + match_type. */
  rationale: string;
  matchType: 'knowledge_complement' | 'goal_aligned' | 'mixed';
  sharedChapter: string | null;
  status: 'suggested' | 'accepted';
}

export const NETWORK_MATCHES: NetworkMatch[] = [
  {
    initials: 'SP', headline: 'PM, AI platform · SF chapter',
    rationale: 'Top of your cohort on eval design — exactly the phase you’re weakest in. Complementary strengths, same city.',
    matchType: 'knowledge_complement', sharedChapter: 'San Francisco', status: 'suggested',
  },
  {
    initials: 'NV', headline: 'Security lead · forming NYC chapter',
    rationale: 'You both rated “agent autonomy gates” as your sharpest phase and both want to break into AI safety roles.',
    matchType: 'goal_aligned', sharedChapter: null, status: 'suggested',
  },
  {
    initials: 'RK', headline: 'Senior PM, fintech · London chapter',
    rationale: 'Connected after the London meetup — you’re both reviewing each other’s capstone answers.',
    matchType: 'mixed', sharedChapter: 'London', status: 'accepted',
  },
];

export const MATCH_TYPE_META: Record<NetworkMatch['matchType'], { label: string; color: string }> = {
  knowledge_complement: { label: 'Complementary strengths', color: '#0D9488' },
  goal_aligned: { label: 'Shared goal', color: '#7C3AED' },
  mixed: { label: 'Met in person', color: '#D97706' },
};
