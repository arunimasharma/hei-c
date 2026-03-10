/**
 * Journal Prompt Builder
 *
 * Upgrades the analysis pipeline from a simple emotion-detection pass to a
 * clinical-grade CBT "ABC Model" analysis that also detects cognitive
 * distortions and generates gentle reframe suggestions.
 *
 * Output schema includes the full CBTAnalysis alongside all original fields
 * so existing consumers don't break.
 */

import type { UserProfile, EmotionType, EventType, JournalReflection } from '../types';
import type { JournalAnalysisResult, CBTAnalysis, CognitiveDistortion, MemoryStore } from '../types/llm';

// ── System prompt ─────────────────────────────────────────────────────────────

export const JOURNAL_SYSTEM_PROMPT = `You are an emotionally intelligent analyst embedded in Hello-EQ, a career wellness app. Your job is to analyse a journal entry using the clinical CBT "ABC Model" framework and extract structured emotional data.

## STEP 1 — Standard Emotion Analysis
Detect:
1. PRIMARY emotion (one of the EMOTION TYPES list)
2. Emotional intensity 1–10
3. Career event type (or null)
4. Company name (if explicitly mentioned, else null)
5. Emotional triggers (specific situations, people, events)
6. A warm, empathetic 1–2 sentence summary
7. Overall sentiment
8. Confidence in your analysis (0.0–1.0)

## STEP 2 — CBT ABC Model Analysis
Using Aaron Beck's Cognitive Behavioral Therapy framework, analyse:

A — ACTIVATING EVENT: Quote or closely paraphrase the specific event described.

B — BELIEFS / AUTOMATIC THOUGHTS: What implicit beliefs or automatic thoughts is the person expressing? List 1–3 concise statements (e.g. "I must be perfect to be valued", "If this goes wrong, I'm a failure").

C — CONSEQUENCES: Describe the emotional and/or behavioral consequences that follow from those beliefs.

## STEP 3 — Cognitive Distortion Detection
Identify any of these specific distortions present (return empty array if none):
- "catastrophizing"     → assuming worst-case outcomes
- "all-or-nothing"      → black-and-white thinking
- "mind-reading"        → assuming you know others' intentions
- "overgeneralization"  → broad conclusions from one event
- "personalization"     → excessive personal responsibility for external events
- "should-statements"   → rigid rules about how things must be
- "emotional-reasoning" → treating a feeling as proof of a fact
- "labeling"            → fixed negative labels on self or others
- "filtering"           → focusing exclusively on negatives
- "fortune-telling"     → predicting negative outcomes as certain

## STEP 4 — Reframe Hint
If any distortion was detected, write ONE concise, gentle reframe suggestion (1–2 sentences) that challenges the most prominent distortion without being dismissive. If no distortions, return an empty string.

---

EMOTION TYPES (use exactly one):
"Joy" | "Stress" | "Anxiety" | "Confidence" | "Frustration" | "Pride" | "Fear" | "Excitement" | "Sadness" | "Hope" | "Anger" | "Gratitude"

EVENT TYPES (use exactly one, or null):
"Meeting" | "Project" | "Review" | "Interview" | "Promotion" | "Feedback" | "Presentation" | "Deadline" | "Conflict" | "Achievement" | "Learning" | "Other"

SENTIMENT: "positive" | "negative" | "mixed" | "neutral"

GUIDELINES:
- Focus on what the person FEELS, not just what happened.
- The summary should be warm and validating, not clinical.
- Distortion detection must be evidence-based — only flag what is clearly present.
- Reframe hints must be gentle ("It might also be worth considering…") not confrontational.
- If prior reflection context is provided, use it to acknowledge recurring patterns.
- Never suggest professional therapy or diagnose conditions.

You MUST respond with ONLY valid JSON (no markdown, no code fences):
{
  "emotion": "string",
  "intensity": number,
  "eventType": "string" | null,
  "companyName": "string" | null,
  "triggers": ["string"],
  "summary": "string",
  "sentiment": "string",
  "confidence": number,
  "cbt": {
    "activatingEvent": "string",
    "coreBeliefs": ["string"],
    "consequences": "string",
    "distortions": ["string"],
    "reframeHint": "string"
  }
}`;

// ── Reasoning steps narrated to the UI (skeleton loader copy) ─────────────────

export const REASONING_STEPS = [
  'Reading your entry…',
  'Identifying the core emotion…',
  'Mapping the ABC model…',
  'Checking for thinking patterns…',
  'Crafting your summary…',
] as const;

// ── Message builder ───────────────────────────────────────────────────────────

export function buildJournalMessage(
  journalText: string,
  user?: UserProfile | null,
  recentReflections?: JournalReflection[],
  memory?: MemoryStore,
): string {
  const sections: string[] = [];

  if (user) {
    sections.push(`## CONTEXT ABOUT THE WRITER
Name: ${user.name}
Role: ${user.role || 'Not specified'}
Goals: ${user.goals || 'Not specified'}`);
  }

  // Prior reflection summaries for pattern awareness
  const priorReflections = recentReflections
    ?.filter(r => r.status === 'approved' && r.detectedSummary)
    .slice(0, 4);

  if (priorReflections && priorReflections.length > 0) {
    const lines = priorReflections.map(r => {
      const date = new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const emotion = r.approvedEmotion ?? 'unknown';
      const triggers = r.detectedTriggers?.length
        ? ` | triggers: ${r.detectedTriggers.slice(0, 3).join(', ')}`
        : '';
      return `- [${date}] ${emotion}: "${r.detectedSummary}"${triggers}`;
    });
    sections.push(
      `## PRIOR REFLECTION CONTEXT (most recent first — for pattern awareness)\n${lines.join('\n')}`,
    );
  }

  // Weekly emotion patterns from memory
  if (memory?.emotionPatterns.length) {
    const latest = memory.emotionPatterns[memory.emotionPatterns.length - 1];
    const patternLine = latest.dominantEmotions
      .slice(0, 3)
      .map(d => `${d.emotion} (${d.count}×, avg ${d.avgIntensity.toFixed(1)})`)
      .join(', ');
    const triggerLine = latest.triggers.length
      ? `\nRecurring triggers: ${latest.triggers.slice(0, 5).join(', ')}`
      : '';
    sections.push(`## EMOTIONAL PATTERNS (week ${latest.period})\nDominant: ${patternLine}${triggerLine}`);
  }

  sections.push(`## JOURNAL ENTRY\n${journalText}`);
  sections.push(`## REQUEST\nApply the full CBT ABC analysis and respond with JSON only.`);

  return sections.join('\n\n');
}

// ── Response parser ───────────────────────────────────────────────────────────

const VALID_EMOTIONS: EmotionType[] = [
  'Joy', 'Stress', 'Anxiety', 'Confidence', 'Frustration',
  'Pride', 'Fear', 'Excitement', 'Sadness', 'Hope', 'Anger', 'Gratitude',
];

const VALID_EVENT_TYPES: EventType[] = [
  'Meeting', 'Project', 'Review', 'Interview', 'Promotion',
  'Feedback', 'Presentation', 'Deadline', 'Conflict', 'Achievement', 'Learning', 'Other',
];

const VALID_SENTIMENTS = ['positive', 'negative', 'mixed', 'neutral'] as const;

const VALID_DISTORTIONS: CognitiveDistortion[] = [
  'catastrophizing', 'all-or-nothing', 'mind-reading', 'overgeneralization',
  'personalization', 'should-statements', 'emotional-reasoning', 'labeling',
  'filtering', 'fortune-telling',
];

const EMPTY_CBT: CBTAnalysis = {
  activatingEvent: '',
  coreBeliefs: [],
  consequences: '',
  distortions: [],
  reframeHint: '',
};

export function parseJournalResponse(rawText: string): JournalAnalysisResult {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  // Parse CBT sub-object
  const rawCbt = (parsed.cbt && typeof parsed.cbt === 'object')
    ? parsed.cbt as Record<string, unknown>
    : {};

  const cbt: CBTAnalysis = {
    activatingEvent: typeof rawCbt.activatingEvent === 'string' ? rawCbt.activatingEvent : '',
    coreBeliefs: Array.isArray(rawCbt.coreBeliefs)
      ? (rawCbt.coreBeliefs as unknown[]).filter(b => typeof b === 'string') as string[]
      : [],
    consequences: typeof rawCbt.consequences === 'string' ? rawCbt.consequences : '',
    distortions: Array.isArray(rawCbt.distortions)
      ? (rawCbt.distortions as unknown[]).filter(
          (d): d is CognitiveDistortion =>
            typeof d === 'string' && VALID_DISTORTIONS.includes(d as CognitiveDistortion),
        )
      : [],
    reframeHint: typeof rawCbt.reframeHint === 'string' ? rawCbt.reframeHint : '',
  };

  return {
    emotion: VALID_EMOTIONS.includes(parsed.emotion as EmotionType)
      ? (parsed.emotion as string)
      : 'Stress',
    intensity: Math.min(10, Math.max(1, Math.round(Number(parsed.intensity) || 5))),
    eventType:
      parsed.eventType && VALID_EVENT_TYPES.includes(parsed.eventType as EventType)
        ? (parsed.eventType as string)
        : null,
    companyName:
      typeof parsed.companyName === 'string' && parsed.companyName.trim()
        ? parsed.companyName.trim()
        : null,
    triggers: Array.isArray(parsed.triggers)
      ? (parsed.triggers as unknown[]).filter(t => typeof t === 'string').slice(0, 10) as string[]
      : [],
    summary: String(parsed.summary || 'Your feelings are valid.'),
    sentiment: VALID_SENTIMENTS.includes(parsed.sentiment as typeof VALID_SENTIMENTS[number])
      ? (parsed.sentiment as typeof VALID_SENTIMENTS[number])
      : 'neutral',
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
    cbt,
  };
}

/** Fallback CBT for error/timeout paths — keeps the type consistent. */
export { EMPTY_CBT };
