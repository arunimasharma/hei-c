# Mixed-Version Evaluation Handling

This document describes how Hello-EQ handles a user history that contains
evaluations produced under different `rubric_version` or `graph_version` values.

---

## Background

Every PM Graph evaluation record stores two provenance fields, frozen at write time:

| Field | Source | Meaning |
|---|---|---|
| `rubric_version` | `provenance.version` | Semantic version of the PM Graph scoring rubric |
| `graph_version` | `provenance.model` | Identifier of the PM Graph model used |

Once a record is written via `EvaluationStore.save()`, these fields are immutable.
A retry for the same submission returns the original frozen record — the rubric
and graph version of the first successful evaluation are always preserved.

As Hello-EQ upgrades the PM Graph rubric or model over time, a user who evaluated
exercises before and after the upgrade will accumulate records from multiple scoring
regimes in their local `exercise_evaluations` IndexedDB table.

---

## Policy — Aggregate with Labelling (Policy A)

**Hello-EQ aggregates credibility, expert tags, and confidence bands across all
rubric and graph versions.  Mixed-version histories are labelled, not fragmented.**

### Rationale

| Option | Consequence |
|---|---|
| A — Aggregate + label ✓ | No credibility gap for users with older records; honest disclosure via UI label |
| B — Aggregate only within version family | Users who pre-date a rubric upgrade see low credibility until they re-attempt in new regime |
| C — Per-version subviews only | Confusing multi-tab UI; most users have too few records per version for meaningful per-version scores |

Policy A is chosen because:
1. The credibility formula normalises scores to [0, 100] and uses a volume-weighted
   log function — small rubric-induced score differences wash out across multiple attempts.
2. Old evaluations were already correct signals under the rubric that produced them;
   excluding them would punish users for longevity.
3. The disclosure label is sufficient to set expectations: users can see that their
   history spans multiple rubric versions without having their data silently discarded.

---

## Implementation

### Version key format

Each `PMGraphEvaluationRecord` is projected to an `ExerciseRecord` by
`pmGraphRecordToExerciseRecord` (in `pmGraphCredibility.ts`).  The projected record
carries a `versionKey` field:

```
versionKey = `${rubric_version}::${graph_version}`
```

Examples:
- `'1.0.0::pm-graph-v1'`
- `'2.1.0::pm-graph-v2'`

This format mirrors the key used by `groupByVersion()` in `EvaluationStore.ts`.

### VersionMixInfo on CredibilityProfile

`computeCredibilityProfile()` (in `credibilityEngine.ts`) inspects the `versionKey`
fields of all input exercises and returns a `VersionMixInfo` object:

```typescript
interface VersionMixInfo {
  distinctVersions: string[];  // sorted list of distinct versionKey values
  isMixed: boolean;            // true when distinctVersions.length > 1
}
```

This field is attached to `CredibilityProfile.versionMix`.  It is:
- `null` when no records carry a `versionKey` (legacy InsightStore path).
- A `VersionMixInfo` when at least one PM Graph record contributed.

### Engine is unchanged

`computeThemeStats`, `computeExpertTags`, and `computeCredibilityScore` are pure
functions that operate on `ExerciseRecord[]` with no version awareness.  They are
not modified.  Mixed-version detection is a metadata overlay — it does not alter
the score.

---

## Are scores directly comparable across versions?

**Directionally yes; precisely no.**

| Scenario | Comparability |
|---|---|
| Two records under the same `rubric_version` + `graph_version` | Fully comparable |
| Two records under different `rubric_version` but same `graph_version` | Directionally comparable; rubric changes may shift individual dimension scores |
| Two records under different `graph_version` | Directionally comparable; model-level changes affect calibration |
| Comparing a PM Graph score to an InsightStore MCQ score | Not comparable — different measurement instrument entirely |

The credibility score aggregates them all under the assumption that the difference
between rubric versions is smaller than the noise introduced by a single low-volume
attempt.  This assumption holds in practice but may need revisiting if a future
rubric version fundamentally redefines one or more dimensions.

---

## What the user sees when versions differ

When `CredibilityProfile.versionMix.isMixed === true`, the **InfluencePanel** shows
a `mixed rubrics` badge next to the `PM Graph` label in the Insight Credibility card.

```
PM dimension score  [PM Graph] [mixed rubrics]              73/100
```

Hovering the badge shows a tooltip with the exact version keys:

> Scored under 2 rubric versions: 1.0.0::pm-graph-v1, 2.1.0::pm-graph-v2.
> Scores are aggregated but may not be directly comparable across versions.

The score, expert tags, and confidence band are computed and displayed normally.
No data is hidden or excluded.

---

## Data path with version tracking

```
EvaluationStore.getAll()                      (Dexie IndexedDB, async)
  │  returns PMGraphEvaluationRecord[]
  │  each record has frozen rubric_version + graph_version
  ▼
computePMGraphFrictionCredibility(records)     (pmGraphCredibility.ts)
  │
  ├─ pmGraphRecordToExerciseRecord(record)     — per record
  │     ├─ check dimension_scores present      — null → exclude
  │     ├─ SURFACE_TO_THEME[benchmark_surface] — unknown → exclude
  │     ├─ score = computeFrictionCaseAttemptScore(dimension_scores)
  │     └─ versionKey = `${rubric_version}::${graph_version}`   ← NEW
  │
  └─ computeCredibilityProfile(exerciseRecords)  (credibilityEngine.ts)
        ├─ deduplicateSubmissions()
        ├─ computeThemeStats()
        ├─ computeExpertTags()
        ├─ computeCredibilityScore()
        └─ collectVersionMix()                               ← NEW
              → CredibilityProfile.versionMix
```

---

## Modules changed

| File | Change |
|---|---|
| `src/lib/credibilityEngine.ts` | Added `versionKey?` to `ExerciseRecord`; added `VersionMixInfo` type; added `versionMix` to `CredibilityProfile`; added `collectVersionMix()` helper |
| `src/integrations/pmGraph/pmGraphCredibility.ts` | `pmGraphRecordToExerciseRecord` now sets `versionKey` |
| `src/components/feedback/InfluencePanel.tsx` | Shows `mixed rubrics` badge when `versionMix.isMixed` is true |
| `src/integrations/pmGraph/__tests__/mixedVersionCredibility.test.ts` | New test file — 10 test suites covering the full policy |

---

## Test coverage

`src/integrations/pmGraph/__tests__/mixedVersionCredibility.test.ts` covers:

| ID | Scenario |
|---|---|
| T1 | Two records with different `rubric_version` |
| T2 | Two records with different `graph_version` |
| T3 | Mixed history still renders trend (versionMix populated) |
| T4 | Expert-tag computation is explainable (accuracy + attempts surfaced) |
| T5 | Single-version history produces `isMixed === false` |
| T6 | Legacy records without `versionKey` produce `versionMix === null` |
| T7 | Mixed-version scoring is deterministic |
| T8 | `distinctVersions` are always sorted |
| T9 | Expert tags are per-theme; all versions contribute |
| T10 | Three distinct regimes produce three entries in `distinctVersions` |

---

## Future considerations

1. **Re-evaluation option**: If a future rubric version is incompatible enough to
   warrant re-evaluation, Hello-EQ could expose a "re-score" button that discards
   old records (after explicit user consent).  Policy A would still apply during
   the transition.

2. **Per-version subviews**: If user volumes grow large enough that per-version
   credibility is meaningful, `groupByVersion()` (already in `EvaluationStore.ts`)
   can be used to expose optional per-version tabs in the Insights page without
   touching the credibility engine.

3. **Calibration across versions**: Once ≥50 submissions exist per rubric version,
   compare the population distribution of scores.  If mean scores shift by more
   than ±10 percentage points between versions, a per-version normalisation
   correction factor should be added to `computeFrictionCaseAttemptScore`.
