/**
 * PM Graph shared contract — runtime validation schemas.
 *
 * All data crossing the boundary to/from the PM Graph evaluation service
 * must be parsed through these schemas before use.
 */

import { z } from 'zod';

// ── Supported values ───────────────────────────────────────────────────────────

export const SUPPORTED_EXERCISE_TYPES = [
  'product_taste',
  'friction_case',
  'pm_interview',
] as const;

/**
 * The fixed set of rubric dimensions PM Graph returns scores for.
 * dimension_scores in a response must contain exactly these keys — no more,
 * no fewer.
 */
export const RUBRIC_DIMENSIONS = [
  'product_judgment',
  'specificity',
  'tradeoff_awareness',
  'segmentation_logic',
  'strategic_empathy',
  'market_inference',
] as const;

// ── Request schema ─────────────────────────────────────────────────────────────

/**
 * Payload sent to PM Graph's /evaluate endpoint.
 *
 * Mutual exclusivity rule: exactly one of `answer_text` or `answers` must be
 * present.
 *   - Use `answer_text` for single free-form responses (e.g. pm_interview).
 *   - Use `answers` for multi-part exercises (e.g. product_taste q1–q6).
 */
export const PMGraphEvaluateRequestSchema = z
  .object({
    exercise_type: z.enum(SUPPORTED_EXERCISE_TYPES),
    /** Single free-form answer — mutually exclusive with `answers`. */
    answer_text: z.string().min(1).optional(),
    /** Key/value answer map — mutually exclusive with `answer_text`. */
    answers: z.record(z.string().min(1), z.string()).optional(),
  })
  .refine(
    (data) => {
      const hasText = data.answer_text !== undefined;
      const hasMap = data.answers !== undefined;
      return hasText !== hasMap; // XOR: exactly one must be set
    },
    {
      message:
        'Exactly one of answer_text or answers must be provided — not both, not neither.',
      path: ['answer_text'],
    },
  );

// ── Provenance schema ──────────────────────────────────────────────────────────

/**
 * Provenance is required on every successful response.
 * It records which model produced the evaluation and when, enabling
 * auditability and reproducibility.
 */
const provenanceSchema = z.object({
  /** Identifier of the model that produced this evaluation. */
  model: z.string().min(1),
  /** Semantic version of the PM Graph evaluator (e.g. "1.0.0"). */
  version: z.string().min(1),
  /** ISO 8601 UTC timestamp of when the evaluation was produced. */
  evaluated_at: z.string().datetime({ offset: true }),
});

// ── Dimension scores schema ────────────────────────────────────────────────────

/**
 * All six rubric dimensions must be present — no extra keys allowed.
 * Each score is a normalised float in [0, 1].
 */
const dimensionScoresSchema = z
  .object({
    product_judgment:   z.number().min(0).max(1),
    specificity:        z.number().min(0).max(1),
    tradeoff_awareness: z.number().min(0).max(1),
    segmentation_logic: z.number().min(0).max(1),
    strategic_empathy:  z.number().min(0).max(1),
    market_inference:   z.number().min(0).max(1),
  })
  .strict(); // rejects any key not listed above

// ── Response schema ────────────────────────────────────────────────────────────

/**
 * Payload received from PM Graph's /evaluate endpoint on a successful (2xx)
 * response.
 *
 * Core fields (score, dimension_scores, provenance) are required.
 * Extended fields are optional — they represent richer signal that PM Graph
 * may return as the service matures. All extended fields are stored in
 * EvaluationStore when present.
 *
 * Validation enforces:
 *  - overall score in [0, 1]
 *  - dimension_scores with exactly the six supported rubric dimensions
 *  - provenance block present with model, version, and evaluated_at
 */
export const PMGraphEvaluateResponseSchema = z.object({
  /** Normalised overall score in [0, 1]. */
  score: z.number().min(0).max(1),

  /** Per-dimension scores — keys must exactly match RUBRIC_DIMENSIONS. */
  dimension_scores: dimensionScoresSchema,

  /** Required on every successful response — records model and timestamp. */
  provenance: provenanceSchema,

  /** Optional free-text reasoning returned by the evaluator. */
  reasoning: z.string().optional(),

  // ── Extended fields (optional — may be absent in early PM Graph versions) ──

  /**
   * PM Graph's own stable case identifier.
   * Enables deduplication and cross-run comparison on the PM Graph side.
   */
  graph_case_id: z.string().optional(),

  /**
   * Insight gaps the evaluator identified — top concepts the user missed.
   * May be used for future coaching features.
   */
  top_missed_insights: z.array(z.string()).optional(),

  /**
   * Alternative valid stances PM Graph identified for this scenario.
   * Signals that multiple correct answers exist.
   */
  competing_stances: z.array(z.string()).optional(),

  /**
   * True if PM Graph considers the scenario genuinely contested
   * (i.e. reasonable PMs disagree on the answer).
   */
  contested: z.boolean().optional(),

  /**
   * IDs of the PM Graph knowledge clusters used to evaluate this response.
   * Enables reproducibility and audit.
   */
  cluster_ids_used: z.array(z.string()).optional(),

  /**
   * Per-dimension signals relevant to expert tag computation.
   * Shape is intentionally open — PM Graph may evolve this field.
   */
  expert_tag_signals: z.record(z.string(), z.unknown()).optional(),

  /**
   * Structured credibility event descriptor.
   * Reserved for future integration with the HEQ credibility engine.
   * Shape is intentionally open — PM Graph may evolve this field.
   */
  credibility_event: z.record(z.string(), z.unknown()).optional(),

  // ── Extended provenance fields (optional — returned when PM Graph supports them) ──

  /**
   * Per-dimension weight coefficients used during scoring.
   * Keys are rubric dimension names; values are the numeric weights applied.
   * Enables exact score reproduction if the weighting scheme changes.
   */
  weights_used: z.record(z.string(), z.number()).optional(),

  /**
   * Rubric configuration profile active at scoring time.
   * Shape is intentionally open — records the full rubric spec snapshot.
   */
  rubric_profile: z.record(z.string(), z.unknown()).optional(),

  /**
   * Version identifier of the curation dataset used by PM Graph.
   * Allows historical evaluations to be re-anchored to the exact training data.
   */
  curation_version: z.string().optional(),

  /**
   * Version identifier of the scoring engine binary / service release.
   * Distinct from rubric_version — the engine version covers infrastructure.
   */
  scoring_engine_version: z.string().optional(),
});

// ── Inferred TypeScript types ──────────────────────────────────────────────────

export type SupportedExerciseType = (typeof SUPPORTED_EXERCISE_TYPES)[number];
export type RubricDimension       = (typeof RUBRIC_DIMENSIONS)[number];
export type PMGraphEvaluateRequest  = z.infer<typeof PMGraphEvaluateRequestSchema>;
export type PMGraphEvaluateResponse = z.infer<typeof PMGraphEvaluateResponseSchema>;

/** Inferred type for the six rubric dimension scores. */
export type DimensionScores = PMGraphEvaluateResponse['dimension_scores'];
