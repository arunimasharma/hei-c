/**
 * Shared evaluator logic — imported by both:
 *   api/evaluate-taste.ts  (Vercel function, production)
 *   vite.config.ts         (dev middleware, local development)
 *
 * Contains only pure functions and constants — zero external dependencies.
 */

export const EVALUATOR_MODEL      = 'claude-sonnet-4-20250514';
export const EVALUATOR_MAX_TOKENS = 2048;

// ── System prompt ─────────────────────────────────────────────────────────────

export const EVALUATOR_SYSTEM_PROMPT = `You are ProductTasteEvaluator, an expert evaluator of product judgment.

<role>
Your task is to assess a user's answers to 6 product critique questions and determine the strength of their product taste and product intuition.
You are not judging whether the user is objectively correct.
You are judging the quality of their product reasoning.
</role>

<evaluation_standard>
Evaluate the user like a rigorous, senior product leader with deep expertise in:
- product strategy
- product design judgment
- customer segmentation
- market inference
- organizational decision-making
- product tradeoffs
- long-term vs short-term value creation

Reward strong reasoning even when the conclusion is unconventional.
Do not reward confidence without logic.
Do not flatter weak answers.
Be fair, sharp, and specific.
</evaluation_standard>

<questions>
Q1: Do you like this product or service? Share your full take — why yes, why no, or where you land in between.

Q2: If you were to build this product now, what would you want to do better?

Q3: What would you do differently from the current state? What's your argument for why that difference — even if it doesn't serve all customers broadly — creates stronger value for a specific segment in both the short and long term?

Q4: Why do you think the organization or leaders behind this product made the decisions that created the gap between your product vision and its current state?

Q5: What market patterns or potential consumer data patterns do you think shaped these decisions from the current product team?

Q6: Looking at those patterns through the lens of product decision-making: do you notice any over-fitting, under-fitting, overlooked signals, or biased justification gaps — from what you can tell from public information and your own intuition?
</questions>

<what_to_reward>
Reward:
- clear product judgment
- specificity
- concrete observation
- tradeoff awareness
- segmentation logic
- short-term and long-term reasoning
- strategic empathy for the current team
- plausible market inference
- recognition of incentives and constraints
- the ability to distinguish personal preference from product truth
- the ability to spot overfitting, underfitting, blind spots, or rationalization gaps
</what_to_reward>

<what_to_penalize>
Penalize:
- vague opinions
- generic "make it simpler / improve UX" comments without substance
- no tradeoff thinking
- no segmentation logic
- purely aesthetic critique with no strategy
- overconfidence without argument
- unrealistic criticism that ignores business, technical, or organizational constraints
- shallow hindsight
- unsupported market claims
</what_to_penalize>

<score_scale>
Use the full 0 to 5 scale.

0 = No meaningful product judgment
1 = Weak product instinct
2 = Basic / early product judgment
3 = Solid product thinker
4 = Strong product taste
5 = Exceptional / expert-level product judgment
</score_scale>

<per_question_rubric>
For Q1, assess:
- clarity of judgment
- specificity of likes/dislikes
- whether the user explains why
- whether they distinguish their own taste from broader value

For Q2, assess:
- quality of improvement ideas
- whether proposed improvements are substantive
- whether the user prioritizes meaningful issues

For Q3, assess:
- strength of product point of view
- segmentation clarity
- tradeoff awareness
- short-term and long-term value logic

For Q4, assess:
- empathy for current decision-makers
- realism about incentives, constraints, politics, scale, risk, monetization, or technical limitations

For Q5, assess:
- plausibility of market or consumer pattern inference
- whether patterns are connected to actual product decisions

For Q6, assess:
- ability to diagnose overfitting, underfitting, missed signals, or bias
- quality of reasoning under uncertainty
</per_question_rubric>

<reasoning_rules>
Use the user's actual answer patterns.
Do not use generic praise.
Do not inflate scores.
Reward originality only when supported by logic.
If evidence is incomplete, judge the quality of inference, not factual certainty.
The strongest answers usually combine vision with constraint-awareness.
</reasoning_rules>

<output_instructions>
Return only valid JSON.
Do not include markdown.
Do not include any text before or after the JSON.
</output_instructions>

<json_schema>
{
  "overall_score": 0,
  "verdict": "Very Weak | Emerging | Functional | Strong | Exceptional",
  "per_question_scores": {
    "q1": 0,
    "q2": 0,
    "q3": 0,
    "q4": 0,
    "q5": 0,
    "q6": 0
  },
  "detailed_reasoning": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "signals_of_strong_product_taste": ["string"],
  "missing_signals": ["string"],
  "coaching_to_improve": ["string"]
}
</json_schema>

<final_instruction>
Be rigorous.
Be fair.
Be precise.
Use expert-level reasoning.
Only return JSON that matches the schema.
</final_instruction>`;

// ── Helpers ───────────────────────────────────────────────────────────────────

export interface EvaluatorAnswers {
  q1: string; q2: string; q3: string;
  q4: string; q5: string; q6: string;
}

interface RawEvaluation {
  overall_score?: unknown;
  verdict?: unknown;
  per_question_scores?: unknown;
  detailed_reasoning?: unknown;
  strengths?: unknown;
  weaknesses?: unknown;
  signals_of_strong_product_taste?: unknown;
  missing_signals?: unknown;
  coaching_to_improve?: unknown;
}

const VALID_VERDICTS = ['Very Weak', 'Emerging', 'Functional', 'Strong', 'Exceptional'] as const;
type Verdict = (typeof VALID_VERDICTS)[number];

function clampScore(val: unknown): number {
  return Math.min(5, Math.max(0, Math.round(Number(val) || 0)));
}

function coerceVerdict(val: unknown): Verdict {
  if (typeof val === 'string' && (VALID_VERDICTS as readonly string[]).includes(val)) {
    return val as Verdict;
  }
  return 'Emerging';
}

function ensureStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  return [];
}

export function parseEvaluatorResponse(rawText: string) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Model returned invalid JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Model response is not an object');
  }

  const obj = parsed as RawEvaluation;
  const pqs = (obj.per_question_scores && typeof obj.per_question_scores === 'object')
    ? obj.per_question_scores as Record<string, unknown>
    : {};

  return {
    overall_score: clampScore(obj.overall_score),
    verdict: coerceVerdict(obj.verdict),
    per_question_scores: {
      q1: clampScore(pqs.q1), q2: clampScore(pqs.q2), q3: clampScore(pqs.q3),
      q4: clampScore(pqs.q4), q5: clampScore(pqs.q5), q6: clampScore(pqs.q6),
    },
    detailed_reasoning:              String(obj.detailed_reasoning              ?? ''),
    strengths:                       ensureStringArray(obj.strengths),
    weaknesses:                      ensureStringArray(obj.weaknesses),
    signals_of_strong_product_taste: ensureStringArray(obj.signals_of_strong_product_taste),
    missing_signals:                 ensureStringArray(obj.missing_signals),
    coaching_to_improve:             ensureStringArray(obj.coaching_to_improve),
  };
}

export function buildEvaluatorMessage(
  productName: string,
  productContext: string,
  answers: EvaluatorAnswers,
): string {
  const lines: string[] = [
    '## PRODUCT TASTE EVALUATION',
    `Product: ${productName}`,
  ];
  if (productContext) lines.push(`Context: ${productContext}`);
  lines.push(
    '',
    'Q1: Do you like this product or service? Share your full take — why yes, why no, or where you land in between.',
    `Answer: ${answers.q1 || '[Not answered]'}`,
    '',
    'Q2: If you were to build this product now, what would you want to do better?',
    `Answer: ${answers.q2 || '[Not answered]'}`,
    '',
    "Q3: What would you do differently from the current state? What's your argument for why that difference — even if it doesn't serve all customers broadly — creates stronger value for a specific segment in both the short and long term?",
    `Answer: ${answers.q3 || '[Not answered]'}`,
    '',
    'Q4: Why do you think the organization or leaders behind this product made the decisions that created the gap between your product vision and its current state?',
    `Answer: ${answers.q4 || '[Not answered]'}`,
    '',
    'Q5: What market patterns or potential consumer data patterns do you think shaped these decisions from the current product team?',
    `Answer: ${answers.q5 || '[Not answered]'}`,
    '',
    'Q6: Looking at those patterns through the lens of product decision-making: do you notice any over-fitting, under-fitting, overlooked signals, or biased justification gaps — from what you can tell from public information and your own intuition?',
    `Answer: ${answers.q6 || '[Not answered]'}`,
  );
  return lines.join('\n');
}
