/**
 * BenchmarkStore
 * Writes anonymous case submissions to Supabase and reads aggregate stats.
 *
 * All writes are fire-and-forget — they never block the UI.
 * Reads return null when Supabase is unconfigured or data is too thin (< MIN_SAMPLE).
 *
 * Supabase table required:
 *   CREATE TABLE case_benchmarks (
 *     id          BIGSERIAL PRIMARY KEY,
 *     case_id     TEXT        NOT NULL,
 *     root_correct BOOLEAN    NOT NULL,
 *     fix_correct  BOOLEAN    NOT NULL,
 *     score        NUMERIC    NOT NULL,
 *     created_at   TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   -- Allow anonymous inserts and public reads:
 *   ALTER TABLE case_benchmarks ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "anon insert" ON case_benchmarks FOR INSERT WITH CHECK (true);
 *   CREATE POLICY "anon select" ON case_benchmarks FOR SELECT USING (true);
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

/** Minimum submissions before we surface live stats (avoids misleading early numbers) */
const MIN_SAMPLE = 10;

export interface CaseBenchmarkStats {
  totalSubmissions: number;
  /** % of submitters who identified the correct root issue */
  rootCorrectRate: number;
  /** % of submitters who chose the correct fix */
  fixCorrectRate: number;
  /** % of submitters who got both right (full score) */
  pmAgreementRate: number;
}

export const BenchmarkStore = {
  /**
   * Fire-and-forget — records an anonymous submission.
   * Never throws, never awaited by callers.
   */
  submit(
    caseId: string,
    rootIssueCorrect: boolean,
    fixCorrect: boolean,
    score: number,
  ): void {
    if (!isSupabaseConfigured || !supabase) return;
    supabase
      .from('case_benchmarks')
      .insert({ case_id: caseId, root_correct: rootIssueCorrect, fix_correct: fixCorrect, score })
      .then(
        () => { /* fire-and-forget */ },
        () => { /* network error — ignore */ },
      );
  },

  /**
   * Returns aggregate stats for a case.
   * Returns null if Supabase is unavailable or sample size < MIN_SAMPLE.
   */
  async getStats(caseId: string): Promise<CaseBenchmarkStats | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from('case_benchmarks')
        .select('root_correct, fix_correct')
        .eq('case_id', caseId);
      if (error || !data || data.length < MIN_SAMPLE) return null;
      const total = data.length;
      const rootCorrect = data.filter(r => r.root_correct).length;
      const fixCorrect  = data.filter(r => r.fix_correct).length;
      const bothCorrect = data.filter(r => r.root_correct && r.fix_correct).length;
      return {
        totalSubmissions: total,
        rootCorrectRate:  Math.round((rootCorrect / total) * 100),
        fixCorrectRate:   Math.round((fixCorrect  / total) * 100),
        pmAgreementRate:  Math.round((bothCorrect / total) * 100),
      };
    } catch {
      return null;
    }
  },
};
