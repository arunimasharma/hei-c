/**
 * EvaluationStore
 *
 * Local-first persistence for PM Graph-backed exercise evaluations.
 *
 * Storage model:
 *   Dexie IndexedDB table `exercise_evaluations` (added in schema v3).
 *   All evaluation fields are AES-GCM encrypted via encryptionService —
 *   matching the pattern used by every other user-facing table in the app.
 *   The `hello_eq_exercise_id` field is stored in plaintext as a Dexie index
 *   so evaluations for a specific case can be retrieved without a full scan.
 *
 * Idempotency guarantee:
 *   The record `id` is derived deterministically from `hello_eq_submission_id`
 *   using the prefix `eval_sub_`. This means calling save() multiple times for
 *   the same submission (e.g. after a retry) always upserts the same Dexie row.
 *   No duplicate evaluation records can accumulate for a single submission.
 *
 * Immutability guarantee:
 *   Once a record with a valid overall_score is persisted, save() will NOT
 *   overwrite it.  Retries for the same submission are silently short-circuited
 *   and the original frozen record is returned unchanged.  Only a submission
 *   that has never succeeded (no existing row, or a row with an invalid score)
 *   will be written.  This preserves the exact rubric/graph versions that
 *   produced the historical score.
 *
 * Persistence guarantee:
 *   save() resolves only after the row is written to IndexedDB. UI callers
 *   should await save() before marking a submission complete, then fire
 *   sync() without awaiting it to avoid blocking the UI on network.
 *
 * What is NOT done here:
 *   - Credibility or expert-tag computation (see credibilityEngine.ts).
 *   - UI state updates (caller responsibility).
 *   - Supabase sync (call syncEvaluation from supabaseSync.ts separately,
 *     fire-and-forget, after save() resolves).
 */

import { db, dbPutEvaluation, dbGet, dbGetAll, dbGetEvaluationsByExercise } from '../../services/db';
import type { PMGraphEvaluateResponse, DimensionScores } from './schema';

// ── Stored record shape ───────────────────────────────────────────────────────

/**
 * The full evaluation record stored in `exercise_evaluations`.
 *
 * Fields are grouped by origin:
 *   - Identity fields: who submitted, which exercise, which submission event.
 *   - Core scores: overall + per-dimension from PM Graph.
 *   - Extended signals: optional richer fields PM Graph may return.
 *   - Provenance: model / rubric version + evaluated_at timestamp.
 *   - Metadata: local created_at, sync_status for remote sync tracking.
 *
 * Immutability contract:
 *   All provenance fields (rubric_version, graph_version, evaluated_at,
 *   cluster_ids_used, weights_used, rubric_profile, curation_version,
 *   scoring_engine_version) are frozen at write time.  EvaluationStore.save()
 *   refuses to overwrite a record that already has a valid overall_score.
 */
export interface PMGraphEvaluationRecord {
  /**
   * Stable evaluation ID — derived from `hello_eq_submission_id` as
   * `eval_sub_<submissionId>`. Using a deterministic ID ensures that retries
   * on the same submission upsert the existing row rather than creating
   * a duplicate.
   */
  id: string;

  // ── Identity ────────────────────────────────────────────────────────────────

  /**
   * User/member ID from the application session.
   * Null when the route is called without authenticated user context
   * (current state — HEQ does not gate the adapter on user identity).
   */
  member_id: string | null;

  /** FrictionCase.id — stable case identifier (e.g. 'fc_001'). */
  hello_eq_exercise_id: string;

  /**
   * InsightStore submission ID — the stable identity for this evaluation.
   * Also determines the record's `id` (see above).
   */
  hello_eq_submission_id: string;

  /** Always 'friction_case' for evaluations produced by this adapter. */
  exercise_type: 'friction_case';

  // ── Core scores ─────────────────────────────────────────────────────────────

  /** Overall score in [0, 1] returned by PM Graph. */
  overall_score: number;

  /** Per-dimension scores — all six rubric dimensions, each in [0, 1]. */
  dimension_scores: DimensionScores;

  // ── Feedback / coaching ─────────────────────────────────────────────────────

  /**
   * Free-text coaching feedback from PM Graph (maps to `reasoning` in the
   * response schema). Null when PM Graph does not return a reasoning field.
   */
  feedback: string | null;

  // ── Extended signal fields (optional — populated when PM Graph returns them) ─

  /**
   * Insight gaps the evaluator identified — top concepts the user missed.
   * Null until PM Graph begins returning this field.
   */
  top_missed_insights: string[] | null;

  /**
   * Alternative valid stances PM Graph identified for this scenario.
   * Null until PM Graph begins returning this field.
   */
  competing_stances: string[] | null;

  /**
   * True if PM Graph considers the scenario genuinely contested.
   * Null until PM Graph begins returning this field.
   */
  contested: boolean | null;

  /**
   * Surface derived from the HEQ friction theme (e.g. 'pricing_page').
   * Stored from the mapper output — not from the PM Graph response.
   */
  benchmark_surface: string;

  /**
   * PM Graph's own stable case identifier, if returned.
   * Enables cross-run comparison on the PM Graph side.
   */
  graph_case_id: string | null;

  /**
   * IDs of the PM Graph knowledge clusters used to evaluate this response.
   * Null until PM Graph begins returning this field.
   */
  cluster_ids_used: string[] | null;

  // ── Provenance (frozen at write time — immutable once successfully saved) ───

  /**
   * Semantic version of the PM Graph rubric used (maps to provenance.version).
   * Enables future re-evaluation if the rubric changes.
   */
  rubric_version: string;

  /**
   * Model identifier from provenance (maps to provenance.model).
   * Enables filtering evaluations by model version.
   */
  graph_version: string;

  /**
   * ISO 8601 UTC timestamp when PM Graph produced this evaluation
   * (maps to provenance.evaluated_at).
   *
   * This is the canonical scoring timestamp.  `created_at` holds the same
   * value for new records; both are kept for backward compatibility with
   * records written before `evaluated_at` was an explicit field.
   */
  evaluated_at: string;

  /**
   * Per-dimension weight coefficients used during scoring, if returned.
   * Keys are rubric dimension names; values are the numeric weights applied.
   * Null when PM Graph does not include this field.
   */
  weights_used: Record<string, number> | null;

  /**
   * Full rubric configuration snapshot active at scoring time, if returned.
   * Shape is intentionally open — allows the spec to evolve without schema
   * changes here.  Null when PM Graph does not include this field.
   */
  rubric_profile: Record<string, unknown> | null;

  /**
   * Version of the PM Graph curation dataset at scoring time, if returned.
   * Enables exact reproducibility audits when the training corpus changes.
   * Null when PM Graph does not include this field.
   */
  curation_version: string | null;

  /**
   * Version of the PM Graph scoring engine binary / service release,
   * if returned.  Distinct from rubric_version — covers infrastructure.
   * Null when PM Graph does not include this field.
   */
  scoring_engine_version: string | null;

  // ── Future credibility integration ──────────────────────────────────────────

  /**
   * Per-dimension expert tag signals from PM Graph.
   * Shape is intentionally open — PM Graph may evolve this field.
   * Null until PM Graph begins returning this field.
   */
  expert_tag_signals: Record<string, unknown> | null;

  /**
   * Structured credibility event descriptor reserved for future integration
   * with the HEQ credibility engine. Shape is intentionally open.
   * Null until PM Graph begins returning this field.
   */
  credibility_event: Record<string, unknown> | null;

  // ── Metadata ────────────────────────────────────────────────────────────────

  /**
   * ISO 8601 UTC timestamp when PM Graph produced this evaluation.
   * Mirrors `evaluated_at`; kept for backward compatibility with records
   * written before `evaluated_at` was an explicit named field.
   */
  created_at: string;

  /**
   * Local-first sync status for Supabase replication.
   *   'pending' — written locally, not yet synced.
   *   'synced'  — confirmed written to Supabase.
   *   'error'   — sync attempted but failed; will be retried.
   */
  sync_status: 'pending' | 'synced' | 'error';
}

// ── Input type for save() ─────────────────────────────────────────────────────

/**
 * Arguments required to create a PMGraphEvaluationRecord.
 * Callers supply identity context (exercise/submission IDs, surface, member_id)
 * alongside the raw PM Graph response.
 */
export interface SaveEvaluationInput {
  /** PM Graph response (success, not degraded). */
  evaluation: PMGraphEvaluateResponse;
  /** FrictionCase.id. */
  hello_eq_exercise_id: string;
  /** InsightStore submission ID — determines the record's stable id. */
  hello_eq_submission_id: string;
  /** Surface derived from the HEQ friction theme (from the mapper). */
  benchmark_surface: string;
  /**
   * User ID from the application session, if available.
   * Pass null when the user is not authenticated.
   */
  member_id: string | null;
}

// ── Provenance read type ──────────────────────────────────────────────────────

/**
 * The subset of PMGraphEvaluationRecord that represents scoring provenance.
 * Returned by `selectProvenance()` for consumers that only need version context.
 */
export interface EvaluationProvenance {
  rubric_version:         string;
  graph_version:          string;
  evaluated_at:           string;
  cluster_ids_used:       string[] | null;
  graph_case_id:          string | null;
  weights_used:           Record<string, number> | null;
  rubric_profile:         Record<string, unknown> | null;
  curation_version:       string | null;
  scoring_engine_version: string | null;
}

// ── Pure record constructor (exported for testing) ────────────────────────────

/**
 * Builds a PMGraphEvaluationRecord from a SaveEvaluationInput without
 * touching IndexedDB. Used in tests to verify field mapping and provenance
 * preservation without requiring a browser environment.
 *
 * The record `id` is `eval_sub_<hello_eq_submission_id>` — deterministic and
 * stable across retries for the same submission.
 */
export function buildEvaluationRecord(input: SaveEvaluationInput): PMGraphEvaluationRecord {
  const { evaluation, hello_eq_exercise_id, hello_eq_submission_id, benchmark_surface, member_id } = input;

  const evaluatedAt = evaluation.provenance.evaluated_at;

  return {
    // Deterministic id: same submission always produces the same key.
    id: `eval_sub_${hello_eq_submission_id}`,

    member_id,
    hello_eq_exercise_id,
    hello_eq_submission_id,
    exercise_type: 'friction_case',

    overall_score:    evaluation.score,
    dimension_scores: evaluation.dimension_scores,

    feedback:            evaluation.reasoning             ?? null,
    top_missed_insights: evaluation.top_missed_insights   ?? null,
    competing_stances:   evaluation.competing_stances     ?? null,
    contested:           evaluation.contested              ?? null,

    benchmark_surface,
    graph_case_id:    evaluation.graph_case_id    ?? null,
    cluster_ids_used: evaluation.cluster_ids_used ?? null,

    // Provenance — frozen at scoring time.
    rubric_version:         evaluation.provenance.version,
    graph_version:          evaluation.provenance.model,
    evaluated_at:           evaluatedAt,
    weights_used:           evaluation.weights_used           ?? null,
    rubric_profile:         evaluation.rubric_profile         ?? null,
    curation_version:       evaluation.curation_version       ?? null,
    scoring_engine_version: evaluation.scoring_engine_version ?? null,

    expert_tag_signals: evaluation.expert_tag_signals ?? null,
    credibility_event:  evaluation.credibility_event  ?? null,

    // evaluated_at from provenance becomes the canonical created_at timestamp.
    // Both fields are kept so old readers that reference created_at still work.
    created_at:  evaluatedAt,
    sync_status: 'pending',
  };
}

// ── Provenance read helpers (pure — no IndexedDB access) ─────────────────────

/**
 * Extracts the full provenance snapshot from a stored evaluation record.
 *
 * Use this in exercise history, credibility computation, and page-level
 * selectors when only version context is needed rather than the full record.
 *
 * Example (Insights page, distinguishing scores by rubric version):
 *
 *   const prov = selectProvenance(record);
 *   console.log(prov.rubric_version, prov.evaluated_at);
 */
export function selectProvenance(record: PMGraphEvaluationRecord): EvaluationProvenance {
  return {
    rubric_version:         record.rubric_version,
    graph_version:          record.graph_version,
    evaluated_at:           record.evaluated_at,
    cluster_ids_used:       record.cluster_ids_used,
    graph_case_id:          record.graph_case_id,
    weights_used:           record.weights_used,
    rubric_profile:         record.rubric_profile,
    curation_version:       record.curation_version,
    scoring_engine_version: record.scoring_engine_version,
  };
}

/**
 * Returns true when the record carries a valid successful evaluation score.
 *
 * Used by the immutability guard in save() and by callers that need to
 * distinguish successfully-scored records from partial/degraded ones.
 *
 * A record is considered successful when overall_score is a finite number
 * in [0, 1] — matching the constraint on the Zod response schema.
 */
export function isSuccessfulEvaluation(record: PMGraphEvaluationRecord): boolean {
  return (
    typeof record.overall_score === 'number' &&
    Number.isFinite(record.overall_score) &&
    record.overall_score >= 0 &&
    record.overall_score <= 1
  );
}

/**
 * Groups a list of evaluation records by their combined rubric + graph version.
 *
 * The key format is `<rubric_version>::<graph_version>` — stable and human-
 * readable.  Records scored under different rubric or graph versions are
 * placed in separate buckets, enabling UI comparisons and historical diffs.
 *
 * Example (Signals page, showing score trend across rubric versions):
 *
 *   const byVersion = groupByVersion(pmRecords);
 *   byVersion.forEach((records, key) => { ... });
 */
export function groupByVersion(
  records: PMGraphEvaluationRecord[],
): Map<string, PMGraphEvaluationRecord[]> {
  const groups = new Map<string, PMGraphEvaluationRecord[]>();
  for (const record of records) {
    const key = `${record.rubric_version}::${record.graph_version}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(record);
    groups.set(key, bucket);
  }
  return groups;
}

/**
 * Returns a human-readable provenance label for a given evaluation record,
 * suitable for rendering in exercise history, Insights, and Influence views.
 *
 * Returns null when both rubric_version and graph_version are absent — this
 * is the expected state for legacy records that pre-date provenance tracking.
 * Callers should degrade gracefully (render nothing) when null is returned.
 *
 * Examples:
 *   "PM Benchmark v2.1.0 / pm-graph-v2"
 *   "PM Benchmark v1.0.0"   (graph_version absent)
 *   null                    (legacy record — no provenance stored)
 */
export function formatEvalProvenanceLabel(record: PMGraphEvaluationRecord): string | null {
  const { rubric_version, graph_version } = record;
  if (!rubric_version && !graph_version) return null;
  const parts: string[] = [];
  if (rubric_version) parts.push(`v${rubric_version}`);
  if (graph_version)  parts.push(graph_version);
  return `PM Benchmark ${parts.join(' / ')}`;
}

/**
 * Formats a `<rubric_version>::<graph_version>` version-key string into the
 * same human-readable label produced by `formatEvalProvenanceLabel`.
 *
 * Used by views that hold a `VersionMixInfo` (e.g. InfluencePanel via
 * `CredibilityProfile.versionMix`) but do not have access to the raw
 * `PMGraphEvaluationRecord`.
 *
 * Returns null when the key is absent or both components are missing /
 * "undefined" (a serialised `undefined` that can appear in legacy version keys
 * built before strict provenance tracking).
 *
 * Example:
 *   formatVersionKeyLabel('2.1.0::pm-graph-v2') → 'PM Benchmark v2.1.0 / pm-graph-v2'
 *   formatVersionKeyLabel('1.0.0::undefined')   → 'PM Benchmark v1.0.0'
 *   formatVersionKeyLabel(undefined)             → null
 */
export function formatVersionKeyLabel(versionKey: string | undefined): string | null {
  if (!versionKey) return null;
  const [rubricVersion, graphVersion] = versionKey.split('::');
  const parts: string[] = [];
  if (rubricVersion && rubricVersion !== 'undefined') parts.push(`v${rubricVersion}`);
  if (graphVersion  && graphVersion  !== 'undefined') parts.push(graphVersion);
  return parts.length > 0 ? `PM Benchmark ${parts.join(' / ')}` : null;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const EvaluationStore = {

  /**
   * Persist a PM Graph evaluation result to IndexedDB immediately.
   *
   * Idempotent: the record id is `eval_sub_<hello_eq_submission_id>`, so
   * calling save() for the same submission multiple times (e.g. after a retry)
   * always upserts the same Dexie row — no duplicate records accumulate.
   *
   * Immutable: if a record with a valid overall_score already exists for this
   * submission, save() returns that frozen record unchanged without writing to
   * IndexedDB.  Only a first-time save (or a retry after a previous failed
   * attempt) will write.  This preserves the exact provenance snapshot
   * (rubric_version, graph_version, evaluated_at, etc.) from the original
   * successful evaluation.
   *
   * Returns the stored record (existing if already successful, new otherwise).
   * Throws if IndexedDB is unavailable.
   *
   * After this resolves, callers should fire syncEvaluation(record)
   * from supabaseSync.ts without awaiting it to avoid blocking the UI.
   */
  async save(input: SaveEvaluationInput): Promise<PMGraphEvaluationRecord> {
    const record = buildEvaluationRecord(input);

    // ── Immutability guard ────────────────────────────────────────────────────
    // If a previously successful evaluation exists for this submission, return
    // it unchanged.  Only overwrite if no prior record exists or the prior
    // record does not carry a valid score (indicating a prior failed attempt
    // that somehow reached the store).
    const existing = await dbGet<PMGraphEvaluationRecord>(
      db.exercise_evaluations,
      record.id,
    );
    if (existing !== null && isSuccessfulEvaluation(existing)) {
      return existing;
    }

    await dbPutEvaluation(
      db.exercise_evaluations,
      record.id,
      record.hello_eq_exercise_id,
      record,
    );

    return record;
  },

  /**
   * Retrieve a single evaluation by its record ID.
   * To look up by submission ID: use `getById('eval_sub_' + submissionId)`.
   * Returns null if not found.
   */
  async getById(id: string): Promise<PMGraphEvaluationRecord | null> {
    return dbGet<PMGraphEvaluationRecord>(db.exercise_evaluations, id);
  },

  /**
   * Retrieve all evaluations for a specific friction case, newest first.
   * Uses the plaintext hello_eq_exercise_id index — no full-table scan.
   */
  async getByExerciseId(exerciseId: string): Promise<PMGraphEvaluationRecord[]> {
    return dbGetEvaluationsByExercise<PMGraphEvaluationRecord>(
      db.exercise_evaluations,
      exerciseId,
    );
  },

  /**
   * Retrieve all stored evaluations, newest first.
   * For large collections prefer getByExerciseId to avoid decrypting everything.
   */
  async getAll(): Promise<PMGraphEvaluationRecord[]> {
    return dbGetAll<PMGraphEvaluationRecord>(db.exercise_evaluations);
  },

  /**
   * Mark an evaluation as successfully synced to Supabase.
   * Called by the sync layer after a confirmed remote write.
   */
  async markSynced(id: string): Promise<void> {
    const record = await dbGet<PMGraphEvaluationRecord>(db.exercise_evaluations, id);
    if (!record) return;
    await dbPutEvaluation(
      db.exercise_evaluations,
      id,
      record.hello_eq_exercise_id,
      { ...record, sync_status: 'synced' },
    );
  },

  /**
   * Mark an evaluation as failed to sync.
   * Called by the sync layer after a confirmed remote write failure.
   */
  async markSyncError(id: string): Promise<void> {
    const record = await dbGet<PMGraphEvaluationRecord>(db.exercise_evaluations, id);
    if (!record) return;
    await dbPutEvaluation(
      db.exercise_evaluations,
      id,
      record.hello_eq_exercise_id,
      { ...record, sync_status: 'error' },
    );
  },
};
