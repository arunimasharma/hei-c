# Evaluation Provenance

Explains where PM Graph evaluation provenance is exposed in the HEQ UI and how support and debugging teams can interpret it.

---

## What is evaluation provenance?

Every time a Friction Case is evaluated by PM Graph, the evaluation record stores the exact rubric and model versions used:

| Field | Meaning | Example |
|---|---|---|
| `rubric_version` | Semantic version of the PM Graph rubric | `2.1.0` |
| `graph_version` | Model identifier of the PM Graph service | `pm-graph-v2` |
| `evaluated_at` | UTC timestamp when PM Graph produced the result | `2026-04-07T12:34:56Z` |
| `scoring_engine_version` | PM Graph service release version | `se-4.2.1` |
| `curation_version` | Version of the PM Graph training dataset | `curate-2026-q1` |
| `weights_used` | Per-dimension weight coefficients used at scoring time | `{ product_judgment: 0.2, … }` |
| `rubric_profile` | Full rubric configuration snapshot | `{ rubric_id: 'rp_friction_v2', … }` |

These fields are **frozen at write time** — the immutability guard in `EvaluationStore.save()` refuses to overwrite a record that already has a valid `overall_score`.

---

## Where provenance is shown in the UI

### 1. Friction Case — done phase

After PM Graph completes, the success strip shows:

```
✓ PM Graph evaluation complete
72 / 100 overall PM score
<feedback text>
PM Benchmark v2.1.0 / pm-graph-v2        ← provenance footnote
```

The footnote is rendered only when `rubric_version` or `graph_version` is present.  
**Legacy records** (pre-provenance) show the score and feedback without the footnote — no error state is surfaced.

### 2. Friction Case browse — score badge tooltip

Each case card shows a purple `PM 72` badge when a prior evaluation exists.  
**Hovering the badge** displays the provenance label as a browser tooltip (`title` attribute):

```
PM Benchmark v2.1.0 / pm-graph-v2
```

This is available on desktop (pointer) devices only.

### 3. Insights page — PM Dimension Breakdown card

The dimension breakdown card shows which rubric version(s) produced the displayed averages:

- **Single version**: `PM Benchmark v2.1.0 / pm-graph-v2` appears as a small footnote below the chart.
- **Mixed versions**: An amber footnote reads:  
  `Mixed rubric versions — scores aggregated across 2 rubric builds (1.0.0::pm-graph-v1, 2.1.0::pm-graph-v2).`  
  This warns that averages span incomparable scoring regimes (see policy note below).

### 4. Insights page — Exercise Log rows

Each Friction Case row in the Exercise Log shows the provenance label (when a PM Graph evaluation exists for that case) as a small line below the root/fix indicators:

```
🏷 Pricing   ✓ Root · ✓ Fix
PM Benchmark v2.1.0 / pm-graph-v2
```

Rows without a PM Graph evaluation show only the MCQ accuracy — no label, no error state.

### 5. Influence page — Insight Credibility card

Below the "Based on X PM Graph evaluations · Y confidence" line:

- **Single version**: `PM Benchmark v2.1.0 / pm-graph-v2` rendered as a small grey label.
- **Mixed versions**: The existing amber `mixed rubrics` pill (tooltip lists all versions seen) is shown instead. The single-version label is suppressed to avoid duplication.

---

## Mixed-version policy

When a user's history spans evaluations scored under different rubric/graph versions, scores are **aggregated across versions** and a disclosure label is shown. This was chosen over version-splitting (Policy A — see `project_mixed_version_policy.md`) to preserve historical continuity while surfacing the caveat visually.

---

## How to use provenance for debugging

### Check which version scored a specific evaluation

```ts
import { selectProvenance } from 'src/integrations/pmGraph/EvaluationStore';

const prov = selectProvenance(record);
// prov.rubric_version, prov.graph_version, prov.evaluated_at, …
```

### Group evaluations by version

```ts
import { groupByVersion } from 'src/integrations/pmGraph/EvaluationStore';

const byVersion = groupByVersion(allRecords);
byVersion.forEach((records, key) => {
  console.log(key, records.length);
  // key format: "<rubric_version>::<graph_version>"
});
```

### Get a display-ready label

```ts
import { formatEvalProvenanceLabel } from 'src/integrations/pmGraph/EvaluationStore';

const label = formatEvalProvenanceLabel(record);
// "PM Benchmark v2.1.0 / pm-graph-v2"  — or null for legacy records
```

### Detect mixed-version histories

```ts
import { collectVersionMix } from 'src/lib/credibilityEngine';

const mix = collectVersionMix(exerciseRecords); // null = no versioned records
if (mix?.isMixed) {
  console.log('Mixed rubric builds:', mix.distinctVersions);
}
```

---

## Support playbook

| Symptom | Where to look | What to check |
|---|---|---|
| Score looks wrong for a given case | Exercise Log row provenance label | Was it scored under an older rubric version? |
| Credibility score changed unexpectedly | Influence page — mixed rubrics pill | Did a re-evaluation happen under a new rubric? |
| "PM Benchmark v…" label absent for a row | Expected for legacy records pre-dating provenance | No action needed — graceful degradation |
| Dimension averages spanning different rubric builds | Insights PM Breakdown amber footnote | This is expected; show the user the mixed-rubric disclosure |

---

## Data location

- **Local (client)**: `IndexedDB` → `exercise_evaluations` table, `blob` column (AES-GCM encrypted). Provenance fields are part of the `PMGraphEvaluationRecord` blob.
- **Remote (Supabase)**: `exercise_evaluations` table — same record synced via `syncEvaluation()` in `src/services/supabaseSync.ts`.
- **Key files**:
  - `src/integrations/pmGraph/EvaluationStore.ts` — record shape, `formatEvalProvenanceLabel`, `selectProvenance`, `groupByVersion`
  - `src/lib/credibilityEngine.ts` — `collectVersionMix`, `VersionMixInfo`
  - `src/integrations/pmGraph/__tests__/provenanceDisplay.test.ts` — unit tests for all display helpers
  - `src/integrations/pmGraph/__tests__/evaluationProvenance.test.ts` — storage-layer immutability tests
