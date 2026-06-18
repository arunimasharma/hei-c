import { z } from 'zod';

// ── Server-side validation for structured Claude output ──
// Never trust raw model JSON: every Claude call that returns structured data is
// parsed through one of these. See ARCHITECTURE.md §5 / §10.

export const GradeSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
});
export type GradeOut = z.infer<typeof GradeSchema>;

export const ExtractionSchema = z.object({
  goals: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  expertiseTags: z.array(z.string()).default([]),
  seekingTags: z.array(z.string()).default([]),
  offeringTags: z.array(z.string()).default([]),
  senioritySignal: z.string().nullish(),
});
export type ExtractionOut = z.infer<typeof ExtractionSchema>;

/** One enriched rationale the matching run asks Claude to write for a pre-ranked pair. */
export const MatchRationaleSchema = z.object({
  rationales: z.array(z.object({
    pairId: z.string(),
    rationale: z.string().min(1),
    matchType: z.enum(['knowledge_complement', 'goal_aligned', 'mixed']),
    confidence: z.number().min(0).max(1),
  })).default([]),
});
export type MatchRationaleOut = z.infer<typeof MatchRationaleSchema>;
