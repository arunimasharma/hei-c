# PM Graph — Display Pages Integration

This document explains which Hello-EQ pages consume PM Graph-backed data,
what each page shows, how the data flows from IndexedDB to the UI, and the
known limitations before Taste Exercise and PM Interview are integrated.

---

## Scope: Friction Case only

All PM Graph-backed display logic is currently gated on **Friction Case evaluations**.
Taste Exercise and PM Interview do not yet write to `EvaluationStore`; they fall back
to their existing InsightStore / BenchmarkStore paths throughout.

A PM Graph-backed view is only shown when:
```typescript
const isPMBacked = !pmLoading && pmProfile !== null && pmProfile.totalExercises > 0;
```
If `isPMBacked` is false the page renders its existing non-PM content unchanged.

---

## Data flow

```
EvaluationStore (IndexedDB, encrypted)
  │
  ├─► usePMGraphEvaluations()           — loads all records + pre-computes aggregates
  │     records, dimensionAverages, rankedDimensions,
  │     topMissedInsights, contestedRatio, surfaceStats
  │
  └─► useFrictionCredibility()          — loads all records + runs credibility engine
        pmProfile (CredibilityProfile | null), pmEvalCount, loading
```

Both hooks are cancellable on unmount. If `EvaluationStore` throws, all fields
stay null/empty — no page crash.

---

## InsightsPage (`src/pages/InsightsPage.tsx`)

### What it shows

| Section | Source field | Condition |
|---------|-------------|-----------|
| Credibility score stat card | `pmProfile.score` (0–100) | `isPMBacked` — replaces InsightStore score |
| "PM Graph" badge on credibility label | — | `isPMBacked` |
| **PM Graph Dimension Breakdown** card | `dimensionAverages`, `rankedDimensions` | `pmRecords.length > 0 && dimensionAverages !== null` |
| Ranked dimension bars (top=green, bottom=red, rest=purple) | `rankedDimensions` | same |
| Top missed insights (up to 3) | `topMissedInsights` | same, and `topMissedInsights.length > 0` |
| Subtle empty-state hint | — | `insight.totalCases > 0` but no PM records yet |

### What does not change

- Theme Performance card (InsightStore)
- Insight Patterns card (InsightStore)
- All other stat cards (streak, totalCases, accuracy, etc.)

---

## SignalsPage (`src/pages/SignalsPage.tsx`)

### What it shows

A single **PM Dimension Profile** card is added to the page when
`pmRecords.length > 0`. It contains four sub-sections:

| Sub-section | Source field | Notes |
|-------------|-------------|-------|
| Benchmark surfaces by PM score | `surfaceStats` (SurfaceStat[]) | Bars, sorted by `avgScore` desc; "Strongest" badge on first |
| Reasoning dimensions | `rankedDimensions` | "Strongest" badge on first, "Weakest" badge on last |
| Patterns in missed insights | `topMissedInsights` | Yellow highlight cards; up to 5 |
| Contested engagement ratio | `contestedRatio` | Purple summary box; hidden if `contestedRatio === null` |

### What does not change

- Existing Signals page content (InsightStore / BenchmarkStore)

---

## InfluencePanel (`src/components/feedback/InfluencePanel.tsx`)

### What it shows when `isPMBacked`

| Field | PM-backed value | Fallback value |
|-------|----------------|----------------|
| Credibility score | `pmProfile.score` | `insight.credibilityScore` |
| Expert tags | `pmProfile.expertThemes` | `insight.expertTags` |
| Confidence band | `pmProfile.confidence` | `insight.confidence` |
| Source count label | `pmEvalCount` + "PM Graph evaluations" | `insight.totalCases` + "cases" |
| Score label | "PM dimension score" | "Accuracy vs. benchmark scenarios" |
| Credibility badge | "PM Graph" badge | — |
| Strongest domain | top PM theme by accuracy | hidden |
| Expert tag tooltip | explains dimension scoring | generic explanation |

All values fall back to InsightStore values when `isPMBacked` is false, so
the panel is never empty.

---

## Aggregate functions (`src/integrations/pmGraph/pmGraphAggregates.ts`)

Pure functions over `PMGraphEvaluationRecord[]`, consumed by `usePMGraphEvaluations`.

| Function | Input | Output | Null safety |
|----------|-------|--------|-------------|
| `computeDimensionAverages` | records | `DimensionAverages \| null` | Returns null when no records have `dimension_scores` |
| `rankDimensions` | averages | `RankedDimension[]` | Returns `[]` when averages is null |
| `aggregateMissedInsights` | records, limit=5 | `string[]` | Skips null `top_missed_insights`; case-insensitive dedup |
| `computeContestedRatio` | records | `number \| null` | Only boolean `contested` values counted; null excluded from denominator |
| `computeSurfaceStats` | records | `SurfaceStat[]` | Unknown surfaces excluded; null `dimension_scores` excluded from avgScore |

---

## Known limitations

### 1. Friction Case only
Taste Exercise and PM Interview have not been wired to `EvaluationStore`.
Until they are, their existing InsightStore/BenchmarkStore paths remain
unchanged. PM Graph display logic is always behind `isPMBacked`, so no user
sees a broken state from missing data.

### 2. Equal-weight dimension heuristic
`computeFrictionCaseAttemptScore` averages all six dimensions with equal
weight. This is a deliberate first-pass heuristic; calibration against
benchmark distributions should happen after ~50 evaluated submissions.

### 3. Credibility threshold calibration
The 60 % accuracy threshold for expert-tag eligibility was chosen to mirror
the MCQ correctness threshold. Dimension-averaged scores tend to cluster more
tightly than binary MCQ results, so the effective selectivity may differ.
Revisit after real data accumulates.

### 4. `member_id` is always null
`FrictionCaseExercise` passes `memberId: null` to `EvaluationStore.save()`.
Per-user scoping of credibility and expert tags requires wiring the
authenticated Supabase session ID here, then filtering `EvaluationStore.getAll()`
by `member_id` before computing aggregates.

### 5. `expert_tag_signals` / `credibility_event` are always null
PM Graph does not yet return these fields. They are stored as null in
`PMGraphEvaluationRecord`. The display pages do not currently render them;
they are reserved for a future pass once PM Graph exposes them.

### 6. `getAll()` decrypts every row
`usePMGraphEvaluations` and `useFrictionCredibility` both call
`EvaluationStore.getAll()`, which decrypts every `exercise_evaluations` row.
This is acceptable at low row counts but will need to change (e.g. pagination
or `getByExerciseId` per-case lazy loading) once a user has hundreds of entries.

### 7. MCQ and PM Graph paths are not mixed
The InsightStore submission path (MCQ correctness) and the EvaluationStore
path (PM Graph dimension scores) are kept completely separate. Aggregate
functions never mix InsightStore records with `PMGraphEvaluationRecord`s.

---

## Test coverage

Tests live in `src/integrations/pmGraph/__tests__/` and run with `npm test`.

### pmGraphAggregates.test.ts (22 cases)

| Area | Cases |
|------|-------|
| `computeDimensionAverages` — null on empty, null-dim exclusion, arithmetic mean, all-null, zero scores, bounded [0,1] | 6 |
| `rankDimensions` — null input → [], sorted desc, all 6 present | 3 |
| `aggregateMissedInsights` — empty returns [], case-insensitive dedup, limit param, null skipped | 4 |
| `computeContestedRatio` — null when no booleans, all-true=1.0, all-false=0.0, null excluded from denominator | 4 |
| `computeSurfaceStats` — empty input, grouping/sorting, unknown surface excluded, null dims don't affect avgScore | 4 |
| Combined: all optional fields null → no crash for all five functions | 1 |

---

## What remains before full production use

1. **Wire Taste Exercise and PM Interview** to `EvaluationStore` using the same
   `runFrictionCaseEvaluation` / `EvaluationStore.save()` pattern once their
   adapters exist.

2. **Wire `member_id`** — pass authenticated user ID from Supabase session to
   `EvaluationStore.save()` so per-user credibility is possible.

3. **Provision Supabase table** — run the DDL in `adapter.md` so
   `syncEvaluation()` can write remotely. Until then, rows accumulate locally
   with `sync_status: 'pending'`.

4. **Calibrate thresholds** — revisit the 60 % expert-tag threshold and
   dimension weights after ~50 real evaluated submissions.
