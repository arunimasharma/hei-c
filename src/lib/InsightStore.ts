/**
 * InsightStore
 * localStorage persistence for PM insight submissions (FrictionCaseExercise scores).
 * Computes credibility score + domain expertise tags — fed into InfluencePanel.
 */

import type { FrictionTheme } from '../data/frictionCases';

const KEY = 'heq_insight_submissions';

export interface InsightSubmission {
  id: string;
  caseId: string;
  theme: FrictionTheme;
  rootIssueCorrect: boolean;
  fixCorrect: boolean;
  /** 0 | 0.5 | 1 */
  score: number;
  timestamp: string;
}

export interface InsightProfile {
  totalCases: number;
  avgAccuracy: number;       // 0–1
  credibilityScore: number;  // 0–100
  domainAccuracy: Record<FrictionTheme, { attempts: number; correct: number }>;
  /** Top domains where user accuracy ≥ 60% with at least 2 attempts */
  expertTags: FrictionTheme[];
  recentScore: number | null; // score of most recent submission (0|0.5|1)
}

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

export const InsightStore = {
  submit(entry: Omit<InsightSubmission, 'id' | 'timestamp'>): InsightSubmission {
    const submissions = load();
    const full: InsightSubmission = {
      ...entry,
      id: `is_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
        totalCases: 0,
        avgAccuracy: 0,
        credibilityScore: 0,
        domainAccuracy: {} as InsightProfile['domainAccuracy'],
        expertTags: [],
        recentScore: null,
      };
    }

    const avgAccuracy = submissions.reduce((s, e) => s + e.score, 0) / submissions.length;

    // Scale: 0 cases = 0, 1 case = up to 40pts, 5 cases = up to 80pts, 10+ = up to 100pts
    const volumeMultiplier = Math.min(1, submissions.length / 10);
    const credibilityScore = Math.round(avgAccuracy * 100 * (0.4 + 0.6 * volumeMultiplier));

    const domainAccuracy = {} as InsightProfile['domainAccuracy'];
    for (const s of submissions) {
      if (!domainAccuracy[s.theme]) domainAccuracy[s.theme] = { attempts: 0, correct: 0 };
      domainAccuracy[s.theme].attempts += 1;
      domainAccuracy[s.theme].correct += s.score >= 0.5 ? 1 : 0;
    }

    const expertTags = (Object.keys(domainAccuracy) as FrictionTheme[]).filter(t => {
      const d = domainAccuracy[t];
      return d.attempts >= 2 && d.correct / d.attempts >= 0.6;
    });

    const recentScore = submissions.at(-1)?.score ?? null;

    return { totalCases: submissions.length, avgAccuracy, credibilityScore, domainAccuracy, expertTags, recentScore };
  },

  clear() {
    localStorage.removeItem(KEY);
  },
};
