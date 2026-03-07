import type { TasteExerciseAnswer } from '../types';

export const TASTE_QUESTIONS = [
  "Do you like this product or service? Share your full take — why yes, why no, or where you land in between.",
  "If you were to build this product now, what would you want to do better?",
  "What would you do differently from the current state? What's your argument for why that difference — even if it doesn't serve all customers broadly — creates stronger value for a specific segment in both the short and long term?",
  "Why do you think the organization or leaders behind this product made the decisions that created the gap between your product vision and its current state?",
  "What market patterns or potential consumer data patterns do you think shaped these decisions from the current product team?",
  "Looking at those patterns through the lens of product decision-making: do you notice any over-fitting, under-fitting, overlooked signals, or biased justification gaps — from what you can tell from public information and your own intuition?",
];

export const TASTE_ANALYSIS_SYSTEM_PROMPT = `You are a product strategy analyst and product taste calibration coach. A user has completed a Product Taste Exercise analyzing a product or service.

Your job is to evaluate their answers and return a structured JSON analysis.

SCORING CRITERIA (0–5):
- 0: Placeholder, gibberish, incoherent, or clearly low-effort filler text (e.g. "idk", "test", "asdf", single words, or answers that don't engage with the question at all)
- 1: Surface-level, entirely generic observations with no specific reasoning or product knowledge
- 2: Some specificity but shallow — observations that anyone could make without thinking deeply
- 3: Decent analysis with clear personal perspective, though reasoning could be sharper or more grounded
- 4: Thoughtful and specific — well-reasoned arguments, real product intuition, awareness of tradeoffs
- 5: Exceptional — highly specific, nuanced, shows genuine product taste and strong self-awareness about assumptions

IMPORTANT: If the user's answers are placeholder text, gibberish, or obviously low-effort (e.g. single words, random characters, "I don't know", "test"), you MUST give a score of 0 and note that in the scoreComment.

SUMMARY GUIDELINES:
- Write 2–3 coherent paragraphs as an objective synthesis of what the user analyzed and said
- Capture their product perspective, what they would change, their reasoning about organizational decisions, and the patterns they noticed — without evaluating the quality of their thinking
- Do NOT reference the score or judge how good/deep their answers were; all evaluative commentary belongs in scoreComment only
- Write it as a neutral analytical record of their product take, as if documenting their perspective for future reference
- If answers are placeholder/gibberish, write a brief note that meaningful analysis could not be generated

SCORE_COMMENT GUIDELINES:
- 1–2 sentences explaining the score with direct reference to specific things they said
- Be constructive and specific

Respond ONLY with valid JSON (no markdown, no code fences):
{
  "summary": "string — 2-3 paragraph analysis",
  "score": number (0-5),
  "scoreComment": "string — 1-2 sentences"
}`;

export function buildTasteAnalysisMessage(
  productName: string,
  answers: TasteExerciseAnswer[],
): string {
  const answerLines = answers.map((a, i) =>
    `Q${i + 1}: ${a.question}\nAnswer: ${a.answer}`,
  ).join('\n\n');

  return `## PRODUCT TASTE EXERCISE — ${productName}\n\nQuestions answered: ${answers.length} of ${TASTE_QUESTIONS.length}\n\n${answerLines}\n\n## REQUEST\nAnalyze this product taste exercise and respond with JSON only.`;
}

export interface TasteAnalysisResult {
  summary: string;
  score: number;
  scoreComment: string;
}

export function parseTasteAnalysisResponse(rawText: string): TasteAnalysisResult {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  const parsed = JSON.parse(cleaned);
  return {
    summary: String(parsed.summary || 'No summary generated.'),
    score: Math.min(5, Math.max(0, Math.round(Number(parsed.score) || 0))),
    scoreComment: String(parsed.scoreComment || ''),
  };
}
