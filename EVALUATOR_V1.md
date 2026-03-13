# Product Taste Evaluator — V1 Implementation Notes

## Overview

V1 introduces a dedicated server-side AI evaluation endpoint for the Product Taste exercise.
It uses a separate Anthropic API key so evaluator traffic is isolated from all other AI features.

---

## Files Changed

| File | Change |
|------|--------|
| `api/evaluate-taste.ts` | **New.** Vercel serverless function. Calls Anthropic with `ANTHROPIC_EVALUATOR_API_KEY`. Returns rich structured JSON. |
| `src/services/productTasteEvaluatorApi.ts` | **New.** Client-side fetch wrapper. Throws `EvaluatorNotConfiguredError` (503) so the caller can fall back gracefully. |
| `src/types/index.ts` | **Updated.** Added `TasteVerdict`, `TasteEvaluatorResult` types. Extended `TasteExercise` with optional `evaluation` field. |
| `src/pages/HomePage.tsx` | **Updated.** `handleProductChatAnalyze` now calls evaluator first; falls back to legacy basic analysis if evaluator key is missing. Rich result card added. `handleProductChatSave` persists full evaluation. |
| `.env.example` | **Updated.** Added `ANTHROPIC_EVALUATOR_API_KEY` with comments explaining the two-key pattern. |

---

## New Environment Variables

```
# Existing — do NOT remove or rename; used by all AI features
ANTHROPIC_API_KEY=sk-ant-api03-...

# New — required ONLY for evaluator V1
# If absent, /api/evaluate-taste returns 503 and the UI falls back to basic analysis.
ANTHROPIC_EVALUATOR_API_KEY=sk-ant-api03-...
```

You can use the **same** API key value for both in development. In production, using
a separate key allows independent monitoring and rate limiting.

---

## Request / Response Flow

```
User completes 6 questions in ProductChatPhase === 'questioning'
  │
  ▼
handleProductChatAnalyze(answers) in HomePage.tsx
  │
  ├─► POST /api/evaluate-taste   { productName, answers: { q1..q6 } }
  │     │
  │     ├─ Validates input (400 on bad input)
  │     ├─ Checks ANTHROPIC_EVALUATOR_API_KEY (503 if missing → client falls back)
  │     ├─ Calls https://api.anthropic.com/v1/messages
  │     │    model:       claude-sonnet-4-20250514
  │     │    temperature: 0   (stable, reproducible)
  │     │    max_tokens:  2048
  │     │    system:      ProductTasteEvaluator system prompt
  │     ├─ Parses + validates JSON response
  │     └─► 200 { overall_score, verdict, per_question_scores,
  │                detailed_reasoning, strengths, weaknesses,
  │                signals_of_strong_product_taste, missing_signals,
  │                coaching_to_improve }
  │
  ▼
productEvalResult state set → rich result card rendered
  │
  ▼
User clicks "Save to Profile"
  └─► addTasteExercise({ ...exercise, evaluation: productEvalResult })
        stored in Dexie (IndexedDB, encrypted at rest)
```

**Fallback path** (evaluator key not set):
```
POST /api/evaluate-taste → 503
  └─► callClaudeMessages(TASTE_ANALYSIS_SYSTEM_PROMPT, ...)  via /api/claude
        └─► legacy TasteAnalysisResult { summary, score, scoreComment }
              → legacy result card rendered
```

---

## How to Test Locally

### With vercel dev (recommended — runs both Vite + serverless functions):
```bash
npm install -g vercel          # if not already installed
vercel dev                     # starts on http://localhost:3000
```
Add both keys to `.env.local` (or `.env`):
```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_EVALUATOR_API_KEY=sk-ant-...
```

### Fallback path test (evaluator disabled):
```bash
# Remove or comment out ANTHROPIC_EVALUATOR_API_KEY in .env.local
vercel dev
# Complete a product taste exercise — should fall back to legacy basic analysis
```

### Quick curl test of the endpoint:
```bash
curl -X POST http://localhost:3000/api/evaluate-taste \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Notion",
    "answers": {
      "q1": "I like it but find it over-engineered for simple note-taking.",
      "q2": "Better mobile performance and a clearer information architecture.",
      "q3": "I would build a stripped-down mode for solo users vs teams.",
      "q4": "They optimized for enterprise and power users — drove LTV up.",
      "q5": "Data showed power users retained 3x better, so they doubled down.",
      "q6": "Potential underfitting for casual users who churn before seeing value."
    }
  }'
```

---

## Rollback Plan

If the evaluator needs to be disabled in production:

1. **Instant:** Remove `ANTHROPIC_EVALUATOR_API_KEY` from Vercel environment variables.
   The endpoint returns 503, the UI silently falls back to legacy basic analysis.
   No code change or redeploy required.

2. **Full disable:** Remove the import of `callEvaluateTaste` in `HomePage.tsx` and
   revert `handleProductChatAnalyze` to the legacy-only path. One small diff.

---

## What Remains for V2

- **Signals + missing signals display**: `signals_of_strong_product_taste` and `missing_signals` are stored but not yet rendered in the result card.
- **Historical comparison**: Show score trajectory across multiple exercises on the Insights page.
- **Evaluator model config**: Move `EVALUATOR_MODEL` to an env var so it can be updated without a code change.
- **Rate limiting**: Add per-session rate limiting on `/api/evaluate-taste` (same pattern as `/api/claude`).
- **Evaluator key rotation**: Document Vercel secret rotation procedure.
- **Streaming**: Stream the evaluation response for better perceived performance on slow connections.
