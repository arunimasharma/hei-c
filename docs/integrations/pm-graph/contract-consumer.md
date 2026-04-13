# PM Graph — Contract Consumer Guide

This document describes how the hei-c application consumes the PM Graph evaluation service.

---

## Supported exercise types

| Value | Description |
|---|---|
| `product_taste` | Six-question product critique exercise (multi-answer) |
| `friction_case` | Friction / pain-point diagnosis scenario (single or multi-answer) |
| `pm_interview` | Open-ended PM interview question (single free-form answer) |

---

## Request shape

```ts
{
  exercise_type: SupportedExerciseType;
  answer_text?: string;   // mutually exclusive with answers
  answers?: Record<string, string>; // mutually exclusive with answer_text
}
```

---

## Response shape (success)

```ts
{
  score: number;                        // [0, 1]
  dimension_scores: DimensionScores;   // all six dimensions required
  provenance: Provenance;              // required on every success
  reasoning?: string;
}
```

---

## Runtime Validation Rules

All data received from PM Graph **must be validated** using the Zod schemas exported from
[`src/integrations/pmGraph/schema.ts`](../../../src/integrations/pmGraph/schema.ts)
before any downstream code reads it.

### Request rules

1. **`exercise_type` enum** — must be one of `product_taste`, `friction_case`, or `pm_interview`.
   Any other value is rejected at the boundary.

2. **`answer_text` / `answers` mutual exclusivity** — exactly one of these fields must be
   present. Sending both, or neither, is a validation error. Use `answer_text` for
   single free-form responses and `answers` for multi-part keyed responses.

### Response rules

3. **Score bounds** — `score` must be a number in `[0, 1]`. Values outside this range
   (e.g. raw 0–5 scores) are rejected; the caller must not normalise after the fact.

4. **Provenance required** — every successful response must include a `provenance` block
   with three fields:
   - `model` — non-empty string identifying the evaluation model
   - `version` — semantic version string of the PM Graph evaluator
   - `evaluated_at` — ISO 8601 UTC timestamp (e.g. `2026-04-05T12:00:00Z`)

   A response that omits or partially fills `provenance` is treated as invalid
   regardless of HTTP status.

5. **Dimension scores — exact key match** — `dimension_scores` must contain **exactly**
   the following six keys, each with a value in `[0, 1]`. Extra keys are rejected;
   missing keys are rejected.

   | Key | What it measures |
   |---|---|
   | `product_judgment` | Clarity and conviction of product opinion |
   | `specificity` | Concrete observations vs. vague generalities |
   | `tradeoff_awareness` | Recognition of competing constraints and priorities |
   | `segmentation_logic` | Customer segmentation clarity and rigour |
   | `strategic_empathy` | Empathy for the current team's decisions and constraints |
   | `market_inference` | Plausibility of market or consumer-pattern reasoning |

### Parsing example

```ts
import {
  PMGraphEvaluateRequestSchema,
  PMGraphEvaluateResponseSchema,
} from '@/integrations/pmGraph/schema';

// Validate outbound request
const request = PMGraphEvaluateRequestSchema.parse({
  exercise_type: 'product_taste',
  answers: { q1: '...', q2: '...' },
});

// Validate inbound response — throws ZodError on contract violation
const response = PMGraphEvaluateResponseSchema.parse(await res.json());
```

---

## Error handling

`PMGraphEvaluateResponseSchema.parse()` throws a `ZodError` on any violation.
Callers should catch this and surface it as a contract-breach error distinct from
a network or HTTP error, so violations are observable in monitoring.
