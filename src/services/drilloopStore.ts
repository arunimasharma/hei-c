import type {
  DrilloopState,
  DrillAttempt,
  DrilloopMetrics,
  PhaseProgress,
  Shoutout,
  SelfRating,
  DrillFeedback,
  FeedbackTag,
} from '../types/drilloop';
import { DRILLS, PHASE_TITLES } from '../data/drilloopDrills';

// ── Drilloop persistence + derived metrics ──
// Fully client-side (localStorage), matching the app's pattern of persisting
// lightweight feature state locally. No auth required; the membership flow is a
// real gate over real local state so the free→paid loop can be validated.

const STORAGE_KEY = 'drilloop_state_v1';

/** How many drills a free member gets before the paywall. The loop's "demonstrate value" rung. */
export const FREE_DRILL_LIMIT = 3;

const RATING_SCORE: Record<SelfRating, number> = {
  nailed: 100,
  partial: 55,
  missed: 15,
};

function defaultState(): DrilloopState {
  return {
    tier: 'free',
    joinedAt: null,
    freeDrillsUsed: 0,
    attempts: [],
    feedback: [],
    shoutouts: [],
    memberName: 'You',
  };
}

export function loadState(): DrilloopState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<DrilloopState>;
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

export function saveState(state: DrilloopState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full / unavailable — feature degrades to in-memory for the session */
  }
}

/** Local YYYY-MM-DD (used for streak + daily logic). Caller passes the Date. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function upgradeToMember(state: DrilloopState, now: Date, name?: string): DrilloopState {
  const next: DrilloopState = {
    ...state,
    tier: 'member',
    joinedAt: state.joinedAt ?? now.toISOString(),
    memberName: name?.trim() || state.memberName,
  };
  return awardShoutouts(next, now, { joined: true });
}

/** Whether the member may start another drill given their tier + free quota. */
export function canStartDrill(state: DrilloopState): boolean {
  if (state.tier === 'member') return true;
  return state.freeDrillsUsed < FREE_DRILL_LIMIT;
}

/** Record a completed attempt; advances quota, recomputes recognition. */
export function recordAttempt(
  state: DrilloopState,
  attempt: DrillAttempt,
  now: Date,
): DrilloopState {
  // Replace any prior attempt at the same drill (members can re-drill).
  const attempts = [...state.attempts.filter(a => a.drillId !== attempt.drillId), attempt];
  const freeDrillsUsed =
    state.tier === 'free' ? state.freeDrillsUsed + 1 : state.freeDrillsUsed;
  const next: DrilloopState = { ...state, attempts, freeDrillsUsed };
  return awardShoutouts(next, now);
}

/** Capture a post-drill feedback signal, routed to the creator dashboard. */
export function recordFeedback(
  state: DrilloopState,
  drillId: string,
  tag: FeedbackTag,
  note: string,
  now: Date,
): DrilloopState {
  const entry: DrillFeedback = {
    id: `${drillId}-${now.getTime()}`,
    drillId,
    tag,
    note: note.trim(),
    at: now.toISOString(),
  };
  // One feedback per drill — latest wins.
  const feedback = [...state.feedback.filter(f => f.drillId !== drillId), entry];
  return { ...state, feedback };
}

// ── Derived metrics ──

export function computeStreaks(attempts: DrillAttempt[]): { current: number; longest: number } {
  if (attempts.length === 0) return { current: 0, longest: 0 };
  const days = [...new Set(attempts.map(a => a.day))].sort(); // ascending YYYY-MM-DD
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + 'T00:00:00');
    const cur = new Date(days[i] + 'T00:00:00');
    const gap = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    if (gap === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  // Current streak counts back from the most recent active day.
  let current = 1;
  for (let i = days.length - 1; i > 0; i--) {
    const prev = new Date(days[i - 1] + 'T00:00:00');
    const cur = new Date(days[i] + 'T00:00:00');
    const gap = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    if (gap === 1) current += 1;
    else break;
  }
  return { current, longest: Math.max(longest, current) };
}

export function computeMetrics(state: DrilloopState): DrilloopMetrics {
  const { attempts } = state;
  const totalDrills = DRILLS.length;
  const completedDrills = new Set(attempts.map(a => a.drillId)).size;
  const completionRate = totalDrills ? completedDrills / totalDrills : 0;

  const { current, longest } = computeStreaks(attempts);

  const masteryRate = attempts.length
    ? attempts.filter(a => a.selfRating === 'nailed').length / attempts.length
    : 0;

  // Improvement: avg score of the second half of attempts minus the first half.
  const ordered = [...attempts].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
  );
  const score = (a: DrillAttempt) => a.aiScore ?? RATING_SCORE[a.selfRating];
  let improvement = 0;
  if (ordered.length >= 4) {
    const mid = Math.floor(ordered.length / 2);
    const firstAvg = avg(ordered.slice(0, mid).map(score));
    const secondAvg = avg(ordered.slice(mid).map(score));
    improvement = Math.round(secondAvg - firstAvg);
  }

  const daysActive = new Set(attempts.map(a => a.day)).size;

  // Per-phase mastery.
  const phases = [...new Set(DRILLS.map(d => d.phase))].sort((a, b) => a - b);
  const phaseProgress: PhaseProgress[] = phases.map(phase => {
    const phaseDrills = DRILLS.filter(d => d.phase === phase);
    const phaseAttempts = attempts.filter(a => a.phase === phase);
    const done = new Set(phaseAttempts.map(a => a.drillId)).size;
    const mastery = phaseAttempts.length ? Math.round(avg(phaseAttempts.map(score))) : 0;
    return {
      phase,
      phaseTitle: PHASE_TITLES[phase],
      total: phaseDrills.length,
      completed: done,
      mastery,
    };
  });

  return {
    totalDrills,
    completedDrills,
    completionRate,
    currentStreak: current,
    longestStreak: longest,
    masteryRate,
    improvement,
    daysActive,
    phaseProgress,
  };
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

// ── Recognition (the loop's status/community reward) ──

const SHOUTOUT_RULES: {
  id: string;
  emoji: string;
  label: string;
  detail: string;
  earned: (s: DrilloopState, m: DrilloopMetrics) => boolean;
}[] = [
  {
    id: 'first-drill',
    emoji: '🎯',
    label: 'First Rep',
    detail: 'Completed your first drill',
    earned: (s) => s.attempts.length >= 1,
  },
  {
    id: 'streak-3',
    emoji: '🔥',
    label: '3-Day Streak',
    detail: 'Drilled three days running',
    earned: (_s, m) => m.currentStreak >= 3 || m.longestStreak >= 3,
  },
  {
    id: 'streak-7',
    emoji: '⚡',
    label: 'Week of Reps',
    detail: 'Seven-day drill streak',
    earned: (_s, m) => m.longestStreak >= 7,
  },
  {
    id: 'phase-master',
    emoji: '🧠',
    label: 'Phase Master',
    detail: 'Cleared every drill in a phase',
    earned: (_s, m) => m.phaseProgress.some(p => p.total > 0 && p.completed === p.total),
  },
  {
    id: 'half-program',
    emoji: '🚀',
    label: 'Halfway There',
    detail: 'Completed half the program',
    earned: (_s, m) => m.completionRate >= 0.5,
  },
  {
    id: 'sharp-judgment',
    emoji: '💎',
    label: 'Sharp Judgment',
    detail: 'Nailed 8+ drills cold',
    earned: (s) => s.attempts.filter(a => a.selfRating === 'nailed').length >= 8,
  },
  {
    id: 'capstone',
    emoji: '🏆',
    label: 'Defensible',
    detail: 'Finished the full program',
    earned: (_s, m) => m.completionRate >= 1,
  },
];

/** Adds any newly-earned shoutouts. `opts.joined` marks the membership shoutout. */
export function awardShoutouts(
  state: DrilloopState,
  now: Date,
  opts: { joined?: boolean } = {},
): DrilloopState {
  const metrics = computeMetrics(state);
  const have = new Set(state.shoutouts.map(s => s.id));
  const fresh: Shoutout[] = [];

  if (opts.joined && !have.has('member')) {
    fresh.push({
      id: 'member',
      emoji: '✨',
      label: 'Founding Member',
      detail: 'Joined the Drilloop membership',
      earnedAt: now.toISOString(),
    });
  }

  for (const rule of SHOUTOUT_RULES) {
    if (!have.has(rule.id) && rule.earned(state, metrics)) {
      fresh.push({
        id: rule.id,
        emoji: rule.emoji,
        label: rule.label,
        detail: rule.detail,
        earnedAt: now.toISOString(),
      });
    }
  }

  if (fresh.length === 0) return state;
  return { ...state, shoutouts: [...state.shoutouts, ...fresh] };
}

export function resetState(): DrilloopState {
  const fresh = defaultState();
  saveState(fresh);
  return fresh;
}
