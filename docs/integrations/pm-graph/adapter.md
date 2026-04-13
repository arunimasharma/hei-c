# PM Graph — Friction Case Adapter

Server-side adapter that wraps PM Graph evaluation for Hello-EQ Friction Case
submissions. Hello-EQ never calls PM Graph directly from the browser; all PM
Graph traffic routes through this endpoint.

---

## Route

```
POST /api/pm-graph/evaluate-friction-case
```

---

## Why an adapter?

- `PM_GRAPH_SERVICE_TOKEN` is a server secret — it cannot be shipped to the client.
- The adapter owns the translation from HEQ's domain model to PM Graph's schema.
- It provides a single chokepoint for auth, timeout, retry, and graceful degradation.

---

## Request flow

```
Browser (FrictionCaseExercise)
  │  POST /api/pm-graph/evaluate-friction-case
  │  Headers: X-Session-Id, X-Request-Id (optional)
  │  Body: HEQFrictionCaseSubmission
  ▼
api/pm-graph/evaluate-friction-case.ts
  │  1. Validates method (POST only)
  │  2. Checks X-Session-Id header
  │  3. Validates + sanitises body fields
  │  4. Generates or propagates request_id
  │  5. Calls mapper → PMGraphFrictionCaseRequest
  │  6. Calls callPMGraphEvaluate(payload, requestId)
  │     │  – Sends Authorization: Bearer <PM_GRAPH_SERVICE_TOKEN>
  │     │  – Sends X-Request-Id for end-to-end correlation
  │     │  – 10 s AbortController timeout per attempt
  │     │  – Retries 5xx / network errors up to 3 times
  │     │  – Validates response via PMGraphEvaluateResponseSchema (Zod)
  │     ▼
  │  PM Graph /evaluate endpoint (server-to-server)
  │
  │  7a. Success → return { ...PMGraphEvaluateResponse, request_id }
  │  7b. Failure → return DegradedResponse (degraded: true, reason, request_id)
  ▼
Browser
```

---

## Auth approach

| Mechanism | Detail |
|---|---|
| `X-Session-Id` header | Required. Soft session identity — matches `/api/claude` pattern. Enables future per-session rate-limiting without a full auth layer. Returns `400` if absent or blank. |
| `PM_GRAPH_SERVICE_TOKEN` | Server-only. Sent as `Authorization: Bearer <token>` to PM Graph. Never returned in responses or written to logs. |

There is no user-identity check at this layer (consistent with the rest of the
project). If user-gating is needed later, add a Supabase session check here.

---

## Request body

| Field | Type | Required | Notes |
|---|---|---|---|
| `caseId` | `string` | yes | Stable friction case ID (e.g. `fc_001`) |
| `submissionId` | `string` | no | InsightStore ID; auto-generated if absent |
| `theme` | `'pricing' \| 'ux' \| 'onboarding' \| 'value' \| 'trust'` | yes | Mapped to PM Graph `surface` |
| `context` | `string` | yes | Where in the product the friction occurred |
| `narrative` | `string` | yes | PM background description |
| `rawResponse` | `string` | yes | Anonymised user quote |
| `rootIssueOptions` | `string[]` | yes | All root issue option labels |
| `rootAnswerIndex` | `number` | yes | Index of the user's root-issue selection |
| `fixOptions` | `string[]` | yes | All fix option labels |
| `fixAnswerIndex` | `number` | yes | Index of the user's fix selection |
| `reflectionText` | `string` | no | Optional open reflection (included in PM Graph answers if non-empty) |
| `productName` | `string` | no | Optional — forwarded to PM Graph if provided |
| `productContext` | `string` | no | Optional — forwarded to PM Graph if provided |

---

## Responses

### Success (HTTP 200)

```json
{
  "score": 0.82,
  "dimension_scores": {
    "product_judgment":   0.85,
    "specificity":        0.78,
    "tradeoff_awareness": 0.80,
    "segmentation_logic": 0.75,
    "strategic_empathy":  0.90,
    "market_inference":   0.83
  },
  "provenance": {
    "model": "pm-graph-v1",
    "version": "1.0.0",
    "evaluated_at": "2026-04-06T10:00:00Z"
  },
  "reasoning": "Strong diagnostic reasoning.",
  "request_id": "heq_m7y5k2_a8f3b1x"
}
```

### Degraded mode (HTTP 200, PM Graph unavailable)

When PM Graph cannot be reached or returns an invalid response, the route
returns **HTTP 200** with `degraded: true` so the frontend never throws.
The frontend must check `degraded` before reading evaluation fields.

```json
{
  "degraded": true,
  "reason": "pm_graph_unavailable",
  "score": null,
  "dimension_scores": null,
  "provenance": null,
  "reasoning": null,
  "request_id": "heq_m7y5k2_a8f3b1x"
}
```

`reason` values and their meaning:

| Value | Meaning | Action |
|---|---|---|
| `pm_graph_unavailable` | Network error, timeout, or 5xx after 3 retries. Also fires when env vars are unset. | Transient — safe to show a "try again" message. |
| `pm_graph_auth_error` | `PM_GRAPH_SERVICE_TOKEN` rejected (401/403). | Configuration problem — alert ops. Not retried. |
| `pm_graph_validation_error` | 4xx from PM Graph — request payload rejected. | Likely a mapper bug or schema drift. Not retried. |
| `pm_graph_unexpected_response` | 2xx but response failed Zod validation. | Schema drift on PM Graph side. Not retried. |

### Client errors (non-200)

| Status | Cause |
|---|---|
| `400` | Missing/invalid body field, or missing `X-Session-Id` header |
| `405` | Non-POST method |

---

## Timeout and retry behaviour

| Condition | Behaviour |
|---|---|
| Network error (fetch throws) | Retry up to 3 times with 300 ms × attempt linear backoff |
| Per-attempt timeout (10 s) | AbortController fires; treated as network error; retried |
| HTTP 5xx | Retry up to 3 times |
| HTTP 401/403 | No retry → `pm_graph_auth_error` |
| HTTP 4xx (non-auth) | No retry → `pm_graph_validation_error` |
| Schema validation failure (2xx) | No retry → `pm_graph_unexpected_response` |

---

## Structured logging

All log lines are JSON-serialised for log drain ingestion.

### pm_graph_request_start
Emitted at the start of every call (after validation passes).
```json
{ "event": "pm_graph_request_start", "timestamp": "...", "request_id": "...", "case_id": "fc_001", "theme": "pricing", "session_id": "..." }
```

### pm_graph_request_success
Emitted when PM Graph returns a valid evaluation.
```json
{ "event": "pm_graph_request_success", "timestamp": "...", "request_id": "...", "case_id": "fc_001", "score": 0.82, "latency_ms": 312 }
```

### pm_graph_request_failure
Emitted on any degraded outcome.
```json
{ "event": "pm_graph_request_failure", "timestamp": "...", "request_id": "...", "case_id": "fc_001", "reason": "pm_graph_unavailable", "error": "PM Graph returned HTTP 503", "latency_ms": 9800 }
```

**Secrets policy**: `PM_GRAPH_SERVICE_TOKEN` is never written to logs (not the
value, not a prefix, not its length). `session_id` is a soft identifier — not
a secret in this project's auth model.

---

## Request correlation

Every request is assigned a `request_id`:
- If the caller includes `X-Request-Id`, it is propagated as-is.
- Otherwise a `heq_<base36timestamp>_<random>` ID is generated.

The `request_id` is:
- Forwarded to PM Graph as an `X-Request-Id` header (enables end-to-end tracing).
- Included in every log line.
- Included in every response (success and degraded).

---

## PM Graph request shape (after mapping)

```json
{
  "exercise_type": "friction_case",
  "answers": {
    "root_issue":         "<label of selected root issue option>",
    "fix_recommendation": "<label of selected fix option>",
    "reflection":         "<reflection text — omitted if blank>"
  },
  "surface":                 "pricing_page",
  "scenario_text":           "Context: ...\nUser signal: \"...\"\nBackground: ...",
  "hello_eq_exercise_id":    "fc_001",
  "hello_eq_submission_id":  "is_1712345678_abc",
  "difficulty":              "intermediate",
  "seniority":               "mid"
}
```

### Theme → surface mapping

| HEQ theme | PM Graph surface |
|---|---|
| `pricing` | `pricing_page` |
| `ux` | `product_ux` |
| `onboarding` | `onboarding_flow` |
| `value` | `value_proposition` |
| `trust` | `trust_and_safety` |

---

## Environment variables

| Variable | Description |
|---|---|
| `PM_GRAPH_BASE_URL` | Base URL of the PM Graph service. The adapter appends `/evaluate`. No trailing slash. Example: `https://api.pm-graph.internal` |
| `PM_GRAPH_SERVICE_TOKEN` | Bearer token for server-to-server auth. **Never expose to the browser.** |

Both are documented in [`.env.example`](../../../.env.example).
If either is absent, the endpoint returns a degraded response with reason
`pm_graph_unavailable` — no exception is thrown to the caller.

---

## Known assumptions and defaults

| Field | Default | Rationale |
|---|---|---|
| `difficulty` | `intermediate` | Friction cases are MCQ — mid-complexity. Update if HEQ adds per-case difficulty. |
| `seniority` | `mid` | HEQ's primary audience is mid-level PMs (2–5 yrs). Update if HEQ adds user seniority to the profile. |
| `hello_eq_submission_id` | `auto_<caseId>_<timestamp>` | Generated when `submissionId` is absent from the payload (e.g. before InsightStore persists). |
| Request timeout | `10 000 ms` per attempt | Exported as `REQUEST_TIMEOUT_MS` from `client.ts` for visibility. |
| Max retries | `3` | 5xx and network errors only. 4xx and auth failures are not retried. |

---

## Local persistence

Evaluations are stored client-side in encrypted IndexedDB via Dexie,
matching the same pattern used by every other user-facing table in the app.
The route returns the evaluation; the calling code (future UI wiring)
persists it. Route and persistence are kept completely separate.

### Storage path

```
Browser receives evaluation from /api/pm-graph/evaluate-friction-case
  │
  ├─ if result.degraded === true → skip (no partial evaluations stored)
  │
  └─ EvaluationStore.save({ evaluation, hello_eq_exercise_id, ... })
       │  → encrypts all score/signal fields (AES-GCM via encryptionService)
       │  → writes EvaluationRow to Dexie exercise_evaluations table
       │  → hello_eq_exercise_id stored as plaintext Dexie index
       │  → sync_status = 'pending'
       │  → returns PMGraphEvaluationRecord
       │
       └─ syncEvaluation(record).catch(console.warn)   ← fire-and-forget
            │  → upserts to Supabase exercise_evaluations table
            └─ on success: EvaluationStore.markSynced(record.id)
               on failure: EvaluationStore.markSyncError(record.id)
```

### PMGraphEvaluationRecord shape

```typescript
{
  // Identity
  id:                     string;          // 'eval_sub_<hello_eq_submission_id>'
  member_id:              string | null;   // user ID if authenticated; null otherwise
  hello_eq_exercise_id:   string;          // FrictionCase.id — plaintext Dexie index
  hello_eq_submission_id: string;          // InsightStore submission ID
  exercise_type:          'friction_case';

  // Core scores
  overall_score:    number;               // 0–1
  dimension_scores: DimensionScores;      // all six rubric dimensions

  // Feedback
  feedback: string | null;                // maps to PM Graph `reasoning`

  // Extended signals (null until PM Graph returns them)
  top_missed_insights: string[] | null;
  competing_stances:   string[] | null;
  contested:           boolean | null;
  graph_case_id:       string | null;     // PM Graph's stable case identifier
  cluster_ids_used:    string[] | null;   // knowledge cluster IDs used for scoring
  expert_tag_signals:  Record<string, unknown> | null;
  credibility_event:   Record<string, unknown> | null;

  // Context
  benchmark_surface: string;              // derived from HEQ theme, e.g. 'pricing_page'

  // Provenance — all fields below are frozen at write time (immutable)
  rubric_version:         string;                        // provenance.version
  graph_version:          string;                        // provenance.model
  evaluated_at:           string;                        // provenance.evaluated_at (ISO 8601 UTC)
  weights_used:           Record<string, number> | null; // per-dimension weights at scoring time
  rubric_profile:         Record<string, unknown> | null;// rubric config snapshot
  curation_version:       string | null;                 // curation dataset version
  scoring_engine_version: string | null;                 // scoring engine version

  // Backward-compat alias (mirrors evaluated_at for older readers)
  created_at: string;

  // Sync
  sync_status: 'pending' | 'synced' | 'error';
}
```

#### Provenance fields — origin and purpose

| Field | Source in PM Graph response | Purpose |
|---|---|---|
| `rubric_version` | `provenance.version` | Identifies the rubric spec used to score the submission |
| `graph_version` | `provenance.model` | Identifies the PM Graph model binary |
| `evaluated_at` | `provenance.evaluated_at` | Canonical ISO 8601 UTC timestamp of scoring |
| `cluster_ids_used` | `cluster_ids_used` | Knowledge clusters consulted — enables reproducibility audits |
| `graph_case_id` | `graph_case_id` | PM Graph's own case handle — cross-run comparison |
| `weights_used` | `weights_used` _(optional)_ | Exact per-dimension weights — allows exact score reproduction |
| `rubric_profile` | `rubric_profile` _(optional)_ | Full rubric config snapshot at scoring time |
| `curation_version` | `curation_version` _(optional)_ | Training corpus version — anchors the evaluation to a data snapshot |
| `scoring_engine_version` | `scoring_engine_version` _(optional)_ | Infrastructure version — distinct from rubric version |

`weights_used`, `rubric_profile`, `curation_version`, and `scoring_engine_version` are stored as
`null` when PM Graph does not include them in the response. No schema change is needed when PM Graph
begins returning them — the fields are already present on `PMGraphEvaluationRecord`.

### IndexedDB schema (Dexie v3)

```
exercise_evaluations: 'id, updatedAt, hello_eq_exercise_id'
```

- `id` — primary key
- `updatedAt` — enables sorting by recency without decryption
- `hello_eq_exercise_id` — plaintext index; enables `getByExerciseId()` without full-table scan

### Reading evaluations

```typescript
import { EvaluationStore } from '@/integrations/pmGraph/EvaluationStore';

// All evaluations for a specific friction case, newest first
const evals = await EvaluationStore.getByExerciseId('fc_001');

// Single evaluation by ID
const ev = await EvaluationStore.getById('eval_abc123_xyz');

// All evaluations (use sparingly — decrypts every row)
const all = await EvaluationStore.getAll();
```

### Supabase table DDL

```sql
CREATE TABLE exercise_evaluations (
  id                      TEXT        PRIMARY KEY,
  member_id               TEXT,
  hello_eq_exercise_id    TEXT        NOT NULL,
  hello_eq_submission_id  TEXT        NOT NULL,
  exercise_type           TEXT        NOT NULL DEFAULT 'friction_case',
  overall_score           NUMERIC     NOT NULL CHECK (overall_score BETWEEN 0 AND 1),
  dimension_scores        JSONB       NOT NULL,
  feedback                TEXT,
  top_missed_insights     TEXT[],
  competing_stances       TEXT[],
  contested               BOOLEAN,
  benchmark_surface       TEXT        NOT NULL,
  graph_case_id           TEXT,
  cluster_ids_used        TEXT[],
  rubric_version          TEXT        NOT NULL,
  graph_version           TEXT        NOT NULL,
  expert_tag_signals      JSONB,
  credibility_event       JSONB,
  created_at              TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_exercise_evaluations_member   ON exercise_evaluations (member_id);
CREATE INDEX idx_exercise_evaluations_exercise ON exercise_evaluations (hello_eq_exercise_id);
CREATE INDEX idx_exercise_evaluations_surface  ON exercise_evaluations (benchmark_surface);
```

### Supabase table — extended DDL for provenance fields

The additional columns required for the new provenance fields:

```sql
ALTER TABLE exercise_evaluations
  ADD COLUMN IF NOT EXISTS evaluated_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS weights_used           JSONB,
  ADD COLUMN IF NOT EXISTS rubric_profile         JSONB,
  ADD COLUMN IF NOT EXISTS curation_version       TEXT,
  ADD COLUMN IF NOT EXISTS scoring_engine_version TEXT;
```

`evaluated_at` holds the canonical scoring timestamp (same value as `created_at`
for all new records).  For legacy rows written before this column was added,
`created_at` is authoritative.

---

### Immutability rule

**A successfully-scored evaluation record is permanently frozen.**

`EvaluationStore.save()` reads the existing row before writing.  If the row
already has a `overall_score` that is a finite number in [0, 1] the write is
skipped and the original frozen record is returned unchanged.  This ensures:

1. The exact `rubric_version`, `graph_version`, `evaluated_at`, and all other
   provenance fields from the original scoring run are never silently replaced.
2. Credibility scores, expert tags, Insights, and Signals computed from a
   stored evaluation remain stable even if PM Graph releases a new model or
   rubric version.
3. A user's historical score trajectory is an accurate audit trail — not a
   rolling average over whatever model was most recently deployed.

**What is NOT frozen:**
- `sync_status` — updated by `markSynced()` / `markSyncError()` without
  triggering the guard.  Only the evaluation data is immutable, not
  replication metadata.

---

### Retry semantics

| Scenario | Behaviour |
|---|---|
| First save for a submission (no existing row) | Write proceeds normally. |
| Retry after a failed `EvaluationStore.save()` call | Write proceeds — no prior successful row exists. |
| Retry after a successful save (e.g. network hiccup causing a second `evaluate()` call) | Write is blocked by the immutability guard; the original frozen record is returned. |
| `markSynced()` / `markSyncError()` after a frozen record | Allowed — only `sync_status` changes, not score/provenance data. |

The guard operates at the `EvaluationStore` layer.  The UI retry path
(`usePMGraphEvaluation.retry()`) is safe to call multiple times — at most one
write can reach IndexedDB per submission.

---

### Historical stability

Evaluations from different rubric or model versions coexist in the same
`exercise_evaluations` table.  Consumers can distinguish them using:

```typescript
import { groupByVersion, selectProvenance } from '@/integrations/pmGraph/EvaluationStore';

// Group all stored records by rubric_version :: graph_version.
const byVersion = groupByVersion(records);
// → Map { '1.0.0::pm-graph-v1' → [...], '2.1.0::pm-graph-v2' → [...] }

// Extract provenance from a single record.
const prov = selectProvenance(record);
// → { rubric_version, graph_version, evaluated_at, cluster_ids_used, ... }
```

Credibility scores, Insights, and Signals must account for potential rubric
drift when aggregating across multiple versions.  A safe default is to compute
metrics within each version bucket separately and surface the most recent
version's bucket as the primary signal.

---

### Legacy records (written before provenance fields were added)

Records stored before `evaluated_at`, `weights_used`, `rubric_profile`,
`curation_version`, and `scoring_engine_version` were introduced will have:

- `evaluated_at` — absent on the stored object (`undefined` at runtime).
  Use `record.evaluated_at ?? record.created_at` as a safe fallback.
- `weights_used`, `rubric_profile`, `curation_version`, `scoring_engine_version` —
  absent on the stored object (`undefined` at runtime); treat as `null`.
- `rubric_version` and `graph_version` — present (added in the initial
  EvaluationStore implementation).

Legacy records are **never** silently recomputed — the immutability guard
applies equally to old and new rows.

---

### Sync usage pattern (future UI wiring)

```typescript
import { EvaluationStore } from '@/integrations/pmGraph/EvaluationStore';
import { syncEvaluation } from '@/services/supabaseSync';

// After receiving a non-degraded response from the adapter:
if (!result.degraded) {
  const record = await EvaluationStore.save({
    evaluation:             result,
    hello_eq_exercise_id:   activeCase.id,
    hello_eq_submission_id: submission.id,
    benchmark_surface:      THEME_TO_SURFACE[activeCase.theme],
    member_id:              userId ?? null,
  });

  // Fire-and-forget — does not block the UI
  syncEvaluation(record)
    .then(() => EvaluationStore.markSynced(record.id))
    .catch(() => EvaluationStore.markSyncError(record.id));
}
```

---

## Modules

| File | Role |
|---|---|
| [`src/integrations/pmGraph/schema.ts`](../../../src/integrations/pmGraph/schema.ts) | Shared Zod contract — request + response schemas, extended optional fields |
| [`src/integrations/pmGraph/errors.ts`](../../../src/integrations/pmGraph/errors.ts) | Typed error classes |
| [`src/integrations/pmGraph/client.ts`](../../../src/integrations/pmGraph/client.ts) | Server-side HTTP client (timeout, retry, schema validation) |
| [`src/integrations/pmGraph/mapper.ts`](../../../src/integrations/pmGraph/mapper.ts) | HEQ submission → PM Graph request |
| [`src/integrations/pmGraph/EvaluationStore.ts`](../../../src/integrations/pmGraph/EvaluationStore.ts) | Client-side local persistence (Dexie + encrypted) |
| [`src/services/db.ts`](../../../src/services/db.ts) | Dexie schema — v3 adds `exercise_evaluations` |
| [`src/services/supabaseSync.ts`](../../../src/services/supabaseSync.ts) | `syncEvaluation()` — fire-and-forget Supabase sync |
| [`api/pm-graph/evaluate-friction-case.ts`](../../../api/pm-graph/evaluate-friction-case.ts) | Vercel serverless route |

---

## Test coverage

Tests live in `src/integrations/pmGraph/__tests__/` and run with `npm test`.

### EvaluationStore.save.test.ts (persistence-layer, mocked db)

| Area | Cases |
|---|---|
| Successful save — calls dbPutEvaluation with correct id, exerciseId, record | 6 |
| Retry upsert — same submission id → same record id on all calls | 3 |
| No duplicates — n saves for same submission produce n calls with the same key | 1 |
| Provenance fields survive save — graph_version, rubric_version, created_at verified in persisted record | 4 |
| markSynced — reads record, re-puts with sync_status: 'synced'; no-op when absent | 2 |
| markSyncError — re-puts with sync_status: 'error'; no-op when absent | 2 |
| Degraded-body runtime guard — documents that degraded data cannot produce a valid evaluation record | 1 |

### evaluationProvenance.test.ts (provenance stability, mocked db)

| Area | Cases |
|---|---|
| **Version fields stored** — evaluated_at, rubric_version, graph_version, cluster_ids_used, graph_case_id, weights_used, rubric_profile, curation_version, scoring_engine_version all persisted; null when absent | 16 |
| **Immutability guard** — save() returns frozen record when successful eval exists; dbPutEvaluation not called; original provenance preserved across a version-changing retry; write allowed on first save; write allowed when prior score is NaN; isSuccessfulEvaluation boundary conditions | 8 |
| **Historical stability** — v1 and v2 records carry distinct provenance; selectProvenance extracts correct v1 and v2 snapshots; absent optional fields are null | 5 |
| **UI selectors** — groupByVersion: correct bucket count, correct keys, correct membership, empty input, single record; selectProvenance: includes only provenance fields (no score/feedback); cross-exercise grouping | 8 |

### mapper.test.ts (27 cases)

| Area | Cases |
|---|---|
| `exercise_type` always `friction_case` | 1 |
| Theme → surface for all 5 themes | 5 |
| `answers` encoding (root_issue, fix_recommendation keys) | 3 |
| `reflection` included / omitted / whitespace | 3 |
| `product_name` / `product_context` present / absent | 4 |
| `hello_eq_submission_id` passthrough and auto-generation | 2 |
| `scenario_text` composition | 1 |
| Defaults (difficulty, seniority, hello_eq_exercise_id) | 3 |
| Option label out-of-range fallback | 2 |

### client.test.ts (22 cases)

| Area | Cases |
|---|---|
| Missing env vars (base URL, token) | 2 |
| Successful 2xx — parse, URL construction, trailing slash | 3 |
| Auth failure 401/403 — no retry | 2 |
| 4xx non-auth — no retry | 2 |
| 5xx retry — success on later attempt, exhausted | 2 |
| Network error retry — success on later attempt, exhausted | 2 |
| AbortError (timeout) → PMGraphUnavailableError with message | 1 |
| Invalid 2xx shape (missing score, extra key, missing provenance) | 3 |
| Non-JSON 2xx body | 1 |
| X-Request-Id forwarded / not forwarded | 2 |

### route.test.ts (38 cases, integration-style with mocked client)

| Area | Cases |
|---|---|
| Method guard (GET/PUT/DELETE/PATCH → 405) | 4 |
| Session header missing / blank → 400 | 2 |
| Input validation (7 required fields and bounds checks) | 7 |
| Success path — response shape and request_id | 2 |
| Degraded responses for all 4 error types | 8 |
| Degraded responses include request_id | 4 |
| X-Request-Id propagated from header | 2 |
| request_id auto-generated (prefix, uniqueness) | 2 |
| Secrets not in response body (token, base URL) | 2 |

---

## What remains before end-to-end use

1. **Set Vercel env vars** — add `PM_GRAPH_BASE_URL` and `PM_GRAPH_SERVICE_TOKEN`
   to Vercel project settings (Production + Preview).

2. **Create the Supabase table** — run the DDL in the "Supabase table DDL" section above.

3. ~~**Wire the frontend**~~ — **Done.** `FrictionCaseExercise` calls `evaluate()` in
   `handleSave()` immediately after `InsightStore.submit()`. The evaluation is
   non-blocking; the UI advances to `done` while PM Graph runs in the background.
   `EvaluationStore.save()` is called on success; `syncEvaluation()` is
   fire-and-forget. The browse view loads prior evaluations from `EvaluationStore`
   and surfaces the overall PM score on each card.

4. **User identity gating** — if scores should be per-user (not anonymous), add
   a Supabase session check to the route using `SUPABASE_SERVICE_ROLE_KEY`.
   Pass the resulting `userId` to `EvaluationStore.save()` as `member_id`.

5. **Credibility engine integration** — once evaluations are accumulating, wire
   `expert_tag_signals` and `credibility_event` into `computeCredibilityProfile()`
   in `credibilityEngine.ts`. EvaluationStore is ready; the engine is not yet wired.

6. **Rate limiting** — add per-session limits (matching `/api/claude`) once the
   endpoint is under production load.

7. **Observability** — wire Vercel Log Drains to a drain target (e.g. Logtail).
   Alert on elevated `pm_graph_auth_error` or `pm_graph_unavailable` rates.
   The `pm_graph_auth_error` reason always indicates a configuration problem.

---

## Current Friction Case PM Graph Flow

This section describes the end-to-end flow as it stands today, including the
local-first persistence layer and the constraints that apply before credibility
and expert-tag integration are complete.

### Submit-first, evaluate-later

The UI never blocks on the PM Graph call:

```
User submits answer
  │
  ├─► InsightStore.submit()      — localStorage write, synchronous result
  ├─► BenchmarkStore.submit()    — fire-and-forget Supabase write (anonymous stats)
  └─► evaluate()                 — sets evalStatus = 'evaluating', then:
        │
        ├─► POST /api/pm-graph/evaluate-friction-case
        │     └─► callPMGraphEvaluate() with retry (up to 3 attempts)
        │
        ├─ on success ──► EvaluationStore.save()      — IndexedDB write (encrypted)
        │                 └─► syncEvaluation()         — fire-and-forget Supabase upsert
        │                     └─► EvaluationStore.markSynced() / markSyncError()
        │
        └─ on failure ──► evalStatus = 'evaluation_failed'   (retryable via retry())
```

The `InsightStore` result (score, correctness) is always available immediately.
The PM Graph result (`evalRecord`) is layered on top once the adapter responds.

### Retry semantics

- **UI retry** (`retry()` in `usePMGraphEvaluation`): replays the last `evaluate()`
  call. Safe to call multiple times — the record ID is deterministic
  (`eval_sub_<hello_eq_submission_id>`), so every retry upserts the same Dexie row.
  No duplicate `exercise_evaluations` rows can accumulate for a single submission.

- **Adapter retry** (`callPMGraphEvaluate`): up to 3 attempts with 300ms × n linear
  backoff for 5xx and network errors. 4xx errors (including auth failures) do not retry.

- **Degraded mode**: when PM Graph returns `degraded: true`, the route returns a
  structured degraded response. `runFrictionCaseEvaluation` detects this and returns
  `{ ok: false, reason: 'degraded' }`. `EvaluationStore.save()` is never called —
  no degraded rows are written to `exercise_evaluations`.

### What is persisted locally

On a successful (non-degraded) adapter response, `EvaluationStore.save()` writes a
`PMGraphEvaluationRecord` to the `exercise_evaluations` IndexedDB table:

| Field group      | Fields stored |
|------------------|---------------|
| Identity         | `id` (deterministic), `member_id`, `hello_eq_exercise_id`, `hello_eq_submission_id`, `exercise_type` |
| Core scores      | `overall_score`, `dimension_scores` |
| Feedback         | `feedback` (from `reasoning`) |
| Extended signals | `top_missed_insights`, `competing_stances`, `contested`, `graph_case_id`, `cluster_ids_used` |
| Provenance (frozen) | `rubric_version` ← `provenance.version`, `graph_version` ← `provenance.model`, `evaluated_at` ← `provenance.evaluated_at`, `weights_used` (null if absent), `rubric_profile` (null if absent), `curation_version` (null if absent), `scoring_engine_version` (null if absent) |
| Future credibility | `expert_tag_signals`, `credibility_event` (null until PM Graph returns them) |
| Compat alias     | `created_at` — mirrors `evaluated_at`; kept for older readers |
| Sync metadata    | `sync_status` (`pending` → `synced` / `error`) |

All fields are AES-GCM encrypted at rest. `hello_eq_exercise_id` is additionally
stored as a plaintext Dexie index so evaluations for a case can be retrieved without
a full table scan.

### History read path

`FrictionCaseExercise` loads all stored evaluations from `EvaluationStore` on
mount and indexes them by `hello_eq_exercise_id`.  The browse card for each case
shows a **PM score badge** (e.g. `PM 82`) derived from `evalRecord.overall_score`
when a prior evaluation exists.  All dimension scores and provenance fields are
available on the in-memory `evalHistory` object for any consumer that needs them:

```typescript
// In FrictionCaseExercise (evalHistory state):
const prevEval = evalHistory[c.id]; // PMGraphEvaluationRecord | undefined

// Dimension scores available:
prevEval?.dimension_scores.product_judgment
prevEval?.dimension_scores.specificity
// ... all six rubric dimensions

// Provenance available (frozen — never overwritten after first successful save):
prevEval?.rubric_version          // e.g. '2.1.0'
prevEval?.graph_version           // e.g. 'pm-graph-v2'
prevEval?.evaluated_at            // ISO 8601 UTC — canonical scoring timestamp
prevEval?.cluster_ids_used        // string[] | null
prevEval?.weights_used            // Record<string, number> | null
prevEval?.rubric_profile          // Record<string, unknown> | null
prevEval?.curation_version        // string | null
prevEval?.scoring_engine_version  // string | null

// Convenience helpers (from EvaluationStore):
import { selectProvenance, groupByVersion } from '@/integrations/pmGraph/EvaluationStore';
const prov   = selectProvenance(prevEval);      // EvaluationProvenance object
const groups = groupByVersion(allEvals);        // Map<'rubric::graph', records[]>
```

`evalHistory` is also updated in the same session when a new evaluation completes
(`evalStatus === 'evaluated'`), so the browse badge appears immediately without
needing a remount.

### What remains before credibility / expert-tag integration

1. `expert_tag_signals` and `credibility_event` are stored as `null` until PM Graph
   begins returning them. No schema change is needed — the fields are already in
   `PMGraphEvaluationRecord`.

2. `EvaluationStore.getByExerciseId()` is the targeted read path for a single case's
   evaluation history. The credibility engine will call this to derive a score
   trajectory per case.

3. `member_id` is currently always `null` because `FrictionCaseExercise` passes
   `memberId: null`. Wire in the authenticated user ID once HEQ gates the adapter
   on user identity.

4. The Supabase `exercise_evaluations` table must be provisioned (DDL in the
   _Supabase sync_ section above) before `syncEvaluation()` can write remotely.
   Until then, rows accumulate locally with `sync_status: 'pending'`.
