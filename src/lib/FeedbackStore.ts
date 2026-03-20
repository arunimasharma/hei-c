/**
 * FeedbackStore
 * Persists friction feedback submissions to localStorage.
 * Computes reputation score, level, and taste profile — all from anonymous data.
 * No PII stored. Ready to swap localStorage → Supabase when scale warrants it.
 */

const STORE_KEY = 'heq_friction_feedback';

// ── types ─────────────────────────────────────────────────────────────────────

export interface ProductContext {
  url?: string;
  product_name?: string;
  page_type?: 'pricing' | 'onboarding' | 'checkout' | 'unknown';
}

export interface FeedbackEntry {
  id: string;
  trigger: string;
  option: string;
  timestamp: number;
  pageId: string;
  sessionId: string;
  socialProofPct: number;
  pointsEarned: number;
  product_context?: ProductContext;
}

export interface ReputationSummary {
  score: number;
  level: string;
  levelEmoji: string;
  levelColor: string;
  nextLevelScore: number;
  progressPct: number;
}

export interface TasteProfile {
  totalFeedbacks: number;
  topThemeLabel: string;
  topThemeEmoji: string;
  triggerVariety: number;
  recentOptions: string[];
}

// ── option → taste theme mapping ─────────────────────────────────────────────

const OPTION_THEME: Record<string, { theme: string; emoji: string; label: string }> = {
  'Too expensive':           { theme: 'value',      emoji: '💰', label: 'Value-conscious' },
  'Not useful yet':          { theme: 'utility',    emoji: '🔧', label: 'Utility-focused' },
  'Confusing':               { theme: 'clarity',    emoji: '🧭', label: 'Clarity-seeker' },
  'Confusing UI':            { theme: 'clarity',    emoji: '🧭', label: 'Clarity-seeker' },
  'Interesting but unclear': { theme: 'clarity',    emoji: '🧭', label: 'Clarity-seeker' },
  'Not sure what to do':     { theme: 'guidance',   emoji: '🗺️', label: 'Guidance-seeker' },
  'Not sure where to start': { theme: 'guidance',   emoji: '🗺️', label: 'Guidance-seeker' },
  'Lost my flow':            { theme: 'flow',       emoji: '⚡', label: 'Flow-seeker' },
  'Too much info':           { theme: 'simplicity', emoji: '✂️', label: 'Minimalist' },
  'Too much to take in':     { theme: 'simplicity', emoji: '✂️', label: 'Minimalist' },
  'Just browsing':           { theme: 'explorer',   emoji: '🗺️', label: 'Explorer' },
  'Just exploring':          { theme: 'explorer',   emoji: '🗺️', label: 'Explorer' },
  'Looking for something':   { theme: 'discovery',  emoji: '🔍', label: 'Discovery-driven' },
  'Thinking it over':        { theme: 'deliberate', emoji: '🤔', label: 'Deliberate thinker' },
};

// ── reputation levels ─────────────────────────────────────────────────────────

const LEVELS = [
  { min: 0,  label: 'Observer',        emoji: '👁️', color: '#9CA3AF', next: 5   },
  { min: 5,  label: 'Critic',          emoji: '🔍', color: '#6B7280', next: 15  },
  { min: 15, label: 'Influencer',      emoji: '📣', color: '#4A5FC1', next: 30  },
  { min: 30, label: 'Product Analyst', emoji: '🧠', color: '#7C3AED', next: 60  },
  { min: 60, label: 'Product Lead',    emoji: '🏆', color: '#D97706', next: 1000 },
];

function computePoints(existingCount: number, socialProofPct: number): number {
  const base = existingCount === 0 ? 5 : 3;
  // Rare signal bonus: minority opinion (fewer people agree) = sharper insight
  const rareBonus = socialProofPct < 45 ? 2 : 0;
  return base + rareBonus;
}

// ── store ─────────────────────────────────────────────────────────────────────

export const FeedbackStore = {
  getAll(): FeedbackEntry[] {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    } catch {
      return [];
    }
  },

  /** Save a new feedback submission. Returns the stored entry (with id + points). */
  save(entry: Omit<FeedbackEntry, 'id' | 'pointsEarned'>): FeedbackEntry {
    const all = this.getAll();
    const pts = computePoints(all.length, entry.socialProofPct);
    const full: FeedbackEntry = {
      ...entry,
      id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
      pointsEarned: pts,
    };
    localStorage.setItem(STORE_KEY, JSON.stringify([...all, full]));
    return full;
  },

  getTotalScore(): number {
    return this.getAll().reduce((sum, e) => sum + e.pointsEarned, 0);
  },

  getReputation(): ReputationSummary {
    const score = this.getTotalScore();
    const level = [...LEVELS].reverse().find(l => score >= l.min) ?? LEVELS[0];
    const range = level.next - level.min;
    const progressPct = range > 0
      ? Math.min(100, Math.round(((score - level.min) / range) * 100))
      : 100;
    return {
      score,
      level: level.label,
      levelEmoji: level.emoji,
      levelColor: level.color,
      nextLevelScore: level.next,
      progressPct,
    };
  },

  getTasteProfile(): TasteProfile | null {
    const all = this.getAll();
    if (all.length === 0) return null;

    const themeCounts: Record<string, number> = {};
    for (const e of all) {
      const theme = OPTION_THEME[e.option]?.theme ?? 'other';
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    }

    const topThemeKey = Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0][0];
    const topMeta = Object.values(OPTION_THEME).find(v => v.theme === topThemeKey)
      ?? { emoji: '💡', label: 'Curious thinker' };

    return {
      totalFeedbacks: all.length,
      topThemeLabel: topMeta.label,
      topThemeEmoji: topMeta.emoji,
      triggerVariety: new Set(all.map(e => e.trigger)).size,
      recentOptions: all.slice(-3).map(e => e.option).reverse(),
    };
  },

  clear(): void {
    localStorage.removeItem(STORE_KEY);
  },
};
