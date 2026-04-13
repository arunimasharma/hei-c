/**
 * provenanceDisplay.test.ts
 *
 * Unit tests for the UI-facing provenance helpers that expose evaluation
 * version context in exercise history, Insights, and Influence views.
 *
 * Three suites:
 *
 *   1. formatEvalProvenanceLabel — provenance present
 *      Verifies labels produced for fully-populated, partially-populated,
 *      and edge-case provenance fields.
 *
 *   2. formatEvalProvenanceLabel — legacy records (provenance absent)
 *      Verifies null is returned when both rubric_version and graph_version
 *      are absent, so callers degrade gracefully without rendering a label.
 *
 *   3. Mixed-version history display
 *      Verifies groupByVersion() bucketing and that distinctVersions from
 *      the credibility engine correctly identifies mixed vs. uniform histories.
 */

import { describe, it, expect } from 'vitest';
import {
  formatEvalProvenanceLabel,
  groupByVersion,
  type PMGraphEvaluationRecord,
} from '../EvaluationStore';
import { collectVersionMix, type ExerciseRecord } from '../../../lib/credibilityEngine';

// Cast helper: lets us test runtime scenarios where provenance fields may be
// absent / null (legacy records serialised before strict typing), even though
// the TypeScript interface marks them as non-nullable strings.
function asRecord(partial: unknown): PMGraphEvaluationRecord {
  return partial as PMGraphEvaluationRecord;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DIMENSION_SCORES = {
  product_judgment:   0.80,
  specificity:        0.75,
  tradeoff_awareness: 0.78,
  segmentation_logic: 0.72,
  strategic_empathy:  0.85,
  market_inference:   0.79,
};

function makeRecord(overrides: Partial<PMGraphEvaluationRecord> = {}): PMGraphEvaluationRecord {
  return {
    id:                     'eval_sub_test_001',
    member_id:              null,
    hello_eq_exercise_id:   'fc_001',
    hello_eq_submission_id: 'test_001',
    exercise_type:          'friction_case',
    overall_score:          0.80,
    dimension_scores:       DIMENSION_SCORES,
    feedback:               null,
    top_missed_insights:    null,
    competing_stances:      null,
    contested:              null,
    benchmark_surface:      'pricing_page',
    graph_case_id:          null,
    cluster_ids_used:       null,
    rubric_version:         '2.1.0',
    graph_version:          'pm-graph-v2',
    evaluated_at:           '2026-04-07T12:00:00Z',
    weights_used:           null,
    rubric_profile:         null,
    curation_version:       null,
    scoring_engine_version: null,
    expert_tag_signals:     null,
    credibility_event:      null,
    created_at:             '2026-04-07T12:00:00Z',
    sync_status:            'pending',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1 — formatEvalProvenanceLabel: provenance present
// ─────────────────────────────────────────────────────────────────────────────

describe('formatEvalProvenanceLabel — provenance present', () => {
  it('returns a label containing both rubric and graph version', () => {
    const label = formatEvalProvenanceLabel(makeRecord());
    expect(label).toBe('PM Benchmark v2.1.0 / pm-graph-v2');
  });

  it('includes rubric_version prefixed with v', () => {
    const label = formatEvalProvenanceLabel(asRecord({ ...makeRecord(), rubric_version: '3.0.0', graph_version: null }));
    expect(label).toBe('PM Benchmark v3.0.0');
  });

  it('includes graph_version alone when rubric_version is absent', () => {
    const label = formatEvalProvenanceLabel(asRecord({ ...makeRecord(), rubric_version: null, graph_version: 'pm-graph-v3' }));
    expect(label).toBe('PM Benchmark pm-graph-v3');
  });

  it('handles a v1 record correctly', () => {
    const label = formatEvalProvenanceLabel(
      makeRecord({ rubric_version: '1.0.0', graph_version: 'pm-graph-v1' }),
    );
    expect(label).toBe('PM Benchmark v1.0.0 / pm-graph-v1');
  });

  it('handles pre-release semver in rubric_version', () => {
    const label = formatEvalProvenanceLabel(
      makeRecord({ rubric_version: '2.2.0-beta.1', graph_version: 'pm-graph-v2' }),
    );
    expect(label).toContain('v2.2.0-beta.1');
  });

  it('always starts with "PM Benchmark"', () => {
    const label = formatEvalProvenanceLabel(makeRecord());
    expect(label).toMatch(/^PM Benchmark /);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 — formatEvalProvenanceLabel: legacy records (provenance absent)
// ─────────────────────────────────────────────────────────────────────────────

describe('formatEvalProvenanceLabel — legacy records (provenance absent)', () => {
  it('returns null when both rubric_version and graph_version are null', () => {
    const label = formatEvalProvenanceLabel(
      asRecord({ ...makeRecord(), rubric_version: null, graph_version: null }),
    );
    expect(label).toBeNull();
  });

  it('returns null when both fields are empty strings', () => {
    const label = formatEvalProvenanceLabel(
      asRecord({ ...makeRecord(), rubric_version: '', graph_version: '' }),
    );
    expect(label).toBeNull();
  });

  it('returns null when both fields are undefined', () => {
    const label = formatEvalProvenanceLabel(
      asRecord({ ...makeRecord(), rubric_version: undefined, graph_version: undefined }),
    );
    expect(label).toBeNull();
  });

  it('does NOT return null when only rubric_version is present', () => {
    // Partial provenance should still render — do not silently drop it.
    const label = formatEvalProvenanceLabel(
      asRecord({ ...makeRecord(), rubric_version: '1.0.0', graph_version: null }),
    );
    expect(label).not.toBeNull();
  });

  it('does NOT return null when only graph_version is present', () => {
    const label = formatEvalProvenanceLabel(
      asRecord({ ...makeRecord(), rubric_version: null, graph_version: 'pm-graph-v1' }),
    );
    expect(label).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 — mixed-version history display
// ─────────────────────────────────────────────────────────────────────────────

describe('mixed-version history display', () => {
  const v1Record = makeRecord({
    id:                     'eval_sub_v1',
    hello_eq_submission_id: 'sub_v1',
    rubric_version:         '1.0.0',
    graph_version:          'pm-graph-v1',
  });
  const v2RecordA = makeRecord({
    id:                     'eval_sub_v2a',
    hello_eq_exercise_id:   'fc_002',
    hello_eq_submission_id: 'sub_v2a',
    rubric_version:         '2.1.0',
    graph_version:          'pm-graph-v2',
  });
  const v2RecordB = makeRecord({
    id:                     'eval_sub_v2b',
    hello_eq_exercise_id:   'fc_003',
    hello_eq_submission_id: 'sub_v2b',
    rubric_version:         '2.1.0',
    graph_version:          'pm-graph-v2',
  });
  const legacyRecord = asRecord({
    ...makeRecord(),
    id:                     'eval_sub_legacy',
    hello_eq_submission_id: 'sub_legacy',
    rubric_version:         null,
    graph_version:          null,
  });

  describe('groupByVersion', () => {
    it('places same-version records in the same bucket', () => {
      const groups = groupByVersion([v2RecordA, v2RecordB]);
      expect(groups.size).toBe(1);
      expect(groups.get('2.1.0::pm-graph-v2')).toHaveLength(2);
    });

    it('separates records of different versions into different buckets', () => {
      const groups = groupByVersion([v1Record, v2RecordA, v2RecordB]);
      expect(groups.size).toBe(2);
      expect(groups.get('1.0.0::pm-graph-v1')).toHaveLength(1);
      expect(groups.get('2.1.0::pm-graph-v2')).toHaveLength(2);
    });

    it('keys legacy records (null::null) into their own bucket', () => {
      const groups = groupByVersion([legacyRecord, v2RecordA]);
      expect(groups.size).toBe(2);
      expect(groups.has('null::null')).toBe(true);
    });
  });

  describe('collectVersionMix — uniform history', () => {
    it('reports isMixed=false when all records share the same version', () => {
      // Convert to ExerciseRecord shape the credibility engine expects
      const exercises: ExerciseRecord[] = [v2RecordA, v2RecordB].map(r => ({
        id:         r.hello_eq_submission_id,
        caseId:     r.hello_eq_exercise_id,
        theme:      'pricing' as const,
        score:      r.overall_score,
        maxScore:   1,
        createdAt:  Date.now(),
        versionKey: `${r.rubric_version}::${r.graph_version}`,
      }));
      const mix = collectVersionMix(exercises);
      expect(mix).not.toBeNull();
      expect(mix!.isMixed).toBe(false);
      expect(mix!.distinctVersions).toHaveLength(1);
      expect(mix!.distinctVersions[0]).toBe('2.1.0::pm-graph-v2');
    });

    it('returns null when no records carry a version key', () => {
      // Records without versionKey are treated as legacy — no mix info.
      const exercises: ExerciseRecord[] = [v2RecordA].map(r => ({
        id:        r.hello_eq_submission_id,
        caseId:    r.hello_eq_exercise_id,
        theme:     'pricing' as const,
        score:     r.overall_score,
        maxScore:  1,
        createdAt: Date.now(),
        // versionKey intentionally omitted
      }));
      const mix = collectVersionMix(exercises);
      expect(mix).toBeNull();
    });
  });

  describe('collectVersionMix — mixed history', () => {
    it('reports isMixed=true when records span two rubric versions', () => {
      const exercises: ExerciseRecord[] = [v1Record, v2RecordA].map(r => ({
        id:         r.hello_eq_submission_id,
        caseId:     r.hello_eq_exercise_id,
        theme:      'pricing' as const,
        score:      r.overall_score,
        maxScore:   1,
        createdAt:  Date.now(),
        versionKey: `${r.rubric_version}::${r.graph_version}`,
      }));
      const mix = collectVersionMix(exercises);
      expect(mix).not.toBeNull();
      expect(mix!.isMixed).toBe(true);
      expect(mix!.distinctVersions).toHaveLength(2);
    });

    it('distinctVersions lists all distinct versions seen in the history', () => {
      const exercises: ExerciseRecord[] = [v1Record, v2RecordA, v2RecordB].map(r => ({
        id:         r.hello_eq_submission_id,
        caseId:     r.hello_eq_exercise_id,
        theme:      'pricing' as const,
        score:      r.overall_score,
        maxScore:   1,
        createdAt:  Date.now(),
        versionKey: `${r.rubric_version}::${r.graph_version}`,
      }));
      const mix = collectVersionMix(exercises);
      expect(mix).not.toBeNull();
      expect(mix!.distinctVersions).toContain('1.0.0::pm-graph-v1');
      expect(mix!.distinctVersions).toContain('2.1.0::pm-graph-v2');
    });

    it('does not double-count records with the same version', () => {
      const exercises: ExerciseRecord[] = [v2RecordA, v2RecordA, v2RecordB].map(r => ({
        id:         r.hello_eq_submission_id,
        caseId:     r.hello_eq_exercise_id,
        theme:      'pricing' as const,
        score:      r.overall_score,
        maxScore:   1,
        createdAt:  Date.now(),
        versionKey: `${r.rubric_version}::${r.graph_version}`,
      }));
      const mix = collectVersionMix(exercises);
      expect(mix).not.toBeNull();
      expect(mix!.distinctVersions).toHaveLength(1);
    });

    it('formatEvalProvenanceLabel produces distinct labels for distinct versions', () => {
      const labelV1 = formatEvalProvenanceLabel(v1Record);
      const labelV2 = formatEvalProvenanceLabel(v2RecordA);
      expect(labelV1).not.toEqual(labelV2);
      expect(labelV1).toBe('PM Benchmark v1.0.0 / pm-graph-v1');
      expect(labelV2).toBe('PM Benchmark v2.1.0 / pm-graph-v2');
    });
  });
});
