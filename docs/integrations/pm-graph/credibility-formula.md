# PM Graph Friction Case — Credibility Formula

This document describes how Hello-EQ computes credibility scores and expert tags
from PM Graph-backed Friction Case evaluation records.

---

## Context

Hello-EQ previously computed Friction Case credibility using coarse MCQ correctness
signals (0 | 0.5 | 1 per submission, stored in InsightStore/localStorage).

Since PM Graph now returns six rubric dimension scores per evaluation, the credibility
pipeline has been upgraded to consume richer signal.  The upgrade is additive:

- InsightStore / coarse correctness path remains unchanged.
- When PM Graph evaluation records exist in EvaluationStore (IndexedDB), the
  InfluencePanel uses the PM Graph-backed profile instead.
- If EvaluationStore is unavailable or has no records, the panel degrades
  silently to the InsightStore path.

---

## Data path

```
EvaluationStore.getAll()                         (Dexie IndexedDB, async)
  │  returns PMGraphEvaluationRecord[]
  ▼
computePMGraphFrictionCredibility(records)        (pmGraphCredibility.ts)
  │
  ├─ pmGraphRecordToExerciseRecord(record)        — per record
  │     ├─ check dimension_scores present         — null → exclude
  │     ├─ SURFACE_TO_THEME[benchmark_surface]   — unknown → exclude
  │     └─ score = computeFrictionCaseAttemptScore(dimension_scores)
  │
  └─ computeCredibilityProfile(exerciseRecords)   (credibilityEngine.ts, unchanged)
        ├─ deduplicateSubmissions()
        ├─ computeThemeStats()
        ├─ computeExpertTags()
        └─ computeCredibilityScore()
```

All engine functions (`credibilityEngine.ts`) are unchanged and remain pure.
`pmGraphCredibility.ts` is a thin adapter that maps PM Graph records into the
`ExerciseRecord` shape the engine already accepts.

---

## Step 1 — per-attempt score from dimension_scores

Each PM Graph evaluation returns six rubric dimension scores, each in [0, 1].

### Dimensions

| Dimension | What it measures |
|---|---|
| `product_judgment` | Overall quality of the PM's product reasoning |
| `specificity` | Concreteness and precision of the argument |
| `tradeoff_awareness` | Recognition of competing constraints and trade-offs |
| `segmentation_logic` | Reasoning about which user segment is affected |
| `strategic_empathy` | Understanding the user's perspective and motivation |
| `market_inference` | Product/market context applied to the scenario |

### Formula

```
attempt_score = (product_judgment + specificity + tradeoff_awareness
               + segmentation_logic + strategic_empathy + market_inference) / 6
```

**Why equal weights?**

All six dimensions are independently measured by PM Graph and represent distinct PM
competencies applied to Friction Case diagnosis.  No one dimension is privileged
without empirical calibration data on predictive validity.

Equal weighting is the minimum-assumption choice and produces an interpretable
result: an attempt score of 0.72 means "the average across all six rubric dimensions
is 72%".  Weights can be updated per-theme once calibration data is available — the
function signature stays unchanged (`computeFrictionCaseAttemptScore` in
`credibilityEngine.ts`).

**Result range:** [0, 1]

---

## Step 2 — per-theme accuracy

The attempt score (`maxScore = 1`) feeds into the existing engine's
`computeThemeStats()` function, which aggregates across all attempts in a theme:

```
theme_accuracy = Σ attempt_scores / Σ maxScores
              = Σ attempt_scores / n_attempts
```

This is **point-based**, not attempt-count-based.  A half-correct attempt
contributes proportionally rather than being counted as a binary win/loss.

**Anti-gaming:** submissions for the same theme within 60 seconds of each other
are deduplicated before aggregation (earliest kept).

**Surface → theme mapping:**

| benchmark_surface | FrictionTheme |
|---|---|
| `pricing_page` | `pricing` |
| `product_ux` | `ux` |
| `onboarding_flow` | `onboarding` |
| `value_proposition` | `value` |
| `trust_and_safety` | `trust` |

Records with an unknown surface (future proofing) or null `dimension_scores`
(degraded evaluations) are silently excluded.  They do not contribute to attempt
counts or accuracy.

---

## Step 3 — credibility score (0–100)

```
Volume_i   = log(1 + min(attempts_i, 10))
Volume_max = log(1 + 10)  ≈ 2.398

Score = (Σ accuracy_i × Volume_i) / (Σ Volume_max) × 100
```

Where the sum is over all themes with at least one attempt.

### Properties

| Property | Value | Explanation |
|---|---|---|
| Volume cap per theme | 10 attempts | Attempts beyond 10 add no extra weight — prevents grinding |
| Volume function | log(1 + n) | Flattens quickly; first few attempts count most |
| Single perfect attempt | ~29/100 | Low volume drag prevents lucky guesses inflating score |
| 10 perfect attempts, 1 theme | 100/100 | Volume cap fully satisfied |
| Low-accuracy theme | Pulls score down | Honest signal: new theme with few attempts lowers score |

### Numeric examples

| Scenario | Score |
|---|---|
| 1 attempt, 100% accuracy, 1 theme | 29 |
| 2 attempts, 100% accuracy, 1 theme | 46 |
| 4 attempts, 75% accuracy, 1 theme | 48 |
| 10 attempts, 100% accuracy, 1 theme | 100 |
| 10 attempts, 75% accuracy, 1 theme | 75 |
| 4 pricing @ 100% + 3 ux @ 0% | ~27 (ux zero-accuracy drag) |

---

## Step 4 — expert tag eligibility

Expert tags are computed per theme from the aggregated `ThemeStat`:

```
isExpert = (attempts ≥ 2) AND (accuracy ≥ 0.60)
```

### Properties

| Property | Detail |
|---|---|
| Minimum attempts | 2 — prevents a single lucky high score from granting a tag |
| Minimum accuracy | 0.60 — represents "consistently above average" in that theme |
| Revocable | Yes — if more low-scoring evaluations drop accuracy below 0.60, the tag is removed on next compute |
| Deterministic | Re-computed from raw records every call; no cached state |

### Identity key

The deduplication window operates on `hello_eq_submission_id`, which maps 1-to-1
to `ExerciseRecord.id`.  Retrying the same submission (same submission ID, new
PM Graph call) produces the same Dexie row via `EvaluationStore.save()` and thus
the same engine input — no duplicate attempts accumulate.

---

## Fallback behaviour

| Condition | UI behaviour |
|---|---|
| No PM Graph evaluations in EvaluationStore | Falls back to InsightStore coarse-correctness credibility |
| EvaluationStore throws / unavailable | Same fallback, no error surfaced |
| Some records have null dimension_scores | Those records excluded; remaining records used |
| All records have null dimension_scores | Zero-state profile; panel falls back to InsightStore |
| PM Graph-backed profile has totalExercises = 0 | Treated as "no PM data"; falls back to InsightStore |

---

## Confidence band

| Band | Total deduplicated evaluations | Meaning |
|---|---|---|
| `low` | < 5 | Provisional — high variance |
| `medium` | 5–14 | Emerging signal |
| `high` | ≥ 15 | Stable, reliable |

---

## Modules involved

| File | Role |
|---|---|
| `src/lib/credibilityEngine.ts` | Core engine — all pure functions, unchanged |
| `src/integrations/pmGraph/pmGraphCredibility.ts` | Bridge — maps PM Graph records to ExerciseRecords |
| `src/integrations/pmGraph/useFrictionCredibility.ts` | React hook — loads records, computes profile |
| `src/components/feedback/InfluencePanel.tsx` | Consumes hook; prefers PM Graph profile when available |

---

## Mixed-version histories

When a user has evaluations from multiple rubric or graph versions, the engine
aggregates them all under **Policy A — aggregate with labelling**:

- All records are included in the score, regardless of which `rubric_version` or
  `graph_version` produced them.
- Each `ExerciseRecord` projected from a `PMGraphEvaluationRecord` carries a
  `versionKey` field (`'<rubric_version>::<graph_version>'`).
- `computeCredibilityProfile` inspects these keys and populates
  `CredibilityProfile.versionMix`:

  ```typescript
  versionMix: {
    distinctVersions: string[];  // sorted unique version keys
    isMixed: boolean;            // true when more than one regime is present
  } | null                       // null for legacy InsightStore records
  ```

- When `isMixed === true`, `InfluencePanel` shows a `mixed rubrics` badge next to
  the `PM Graph` label.  Hovering reveals which versions are in scope.

**Are scores comparable across versions?** Directionally yes, precisely no.
The volume-weighted log formula normalises scores to [0, 100], which absorbs
small rubric-induced shifts.  Precise per-version comparisons are not guaranteed.

Full policy rationale, data path, and future considerations:
[docs/integrations/pm-graph/mixed-version-handling.md](./mixed-version-handling.md)

---

## Remaining assumptions before UI rollout

1. **Equal weights are a temporary heuristic.** Once PM Graph has sufficient
   calibration data on which dimensions predict real-world PM impact in each theme,
   per-theme dimension weights can replace the equal-weight average.  The
   `computeFrictionCaseAttemptScore` function signature is stable — only its
   body needs updating.

2. **`member_id` is null** in current evaluations — credibility is per-device, not
   per-user.  Once HEQ gates the adapter on user identity, `member_id` will be
   available for cross-device aggregation.

3. **No Supabase sync of computed profiles.** `computePMGraphFrictionCredibility`
   runs purely client-side from IndexedDB.  The credibility score itself is not
   synced — only raw evaluation records are (via `syncEvaluation`).

4. **Coarse MCQ correctness and PM Graph scores are not mixed.** InfluencePanel
   uses one source at a time.  If PM Graph evaluations exist, they take priority
   over InsightStore records for the credibility display.  The two paths are
   not averaged together — that would mix incommensurable scales.

5. **The 60% expert-tag threshold is inherited** from the original InsightStore
   path and is applied to the new dimension-averaged score.  This may need
   calibration — a 60% dimension average is a different standard than 60% MCQ
   correctness.  Review after first 50+ evaluated submissions.
