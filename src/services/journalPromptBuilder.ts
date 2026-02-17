import type { UserProfile, EmotionType, EventType } from '../types';
import type { JournalAnalysisResult } from '../types/llm';

export const JOURNAL_SYSTEM_PROMPT = `You are an emotional intelligence analyst embedded in a career wellness app called HEI-C. Your job is to analyze a user's journal entry and extract structured emotional and career data.

TASK:
1. Detect the PRIMARY emotion expressed in the journal entry.
2. Rate the emotional intensity on a scale of 1-10.
3. Identify the type of career event described, if any.
4. Extract the company or organization name mentioned, if any.
5. List emotional triggers (specific situations, people, or events that caused the emotion).
6. Write a brief, empathetic summary (1-2 sentences) that reflects back what you understood.
7. Classify the overall sentiment.
8. Rate your confidence in the analysis (0.0 to 1.0).

EMOTION TYPES (use exactly one of these):
"Joy" | "Stress" | "Anxiety" | "Confidence" | "Frustration" | "Pride" | "Fear" | "Excitement" | "Sadness" | "Hope" | "Anger" | "Gratitude"

EVENT TYPES (use exactly one, or null if no career event is described):
"Meeting" | "Project" | "Review" | "Interview" | "Promotion" | "Feedback" | "Presentation" | "Deadline" | "Conflict" | "Achievement" | "Learning" | "Other"

SENTIMENT VALUES:
"positive" | "negative" | "mixed" | "neutral"

GUIDELINES:
- Focus on what the person is FEELING, not just what happened.
- If multiple emotions are present, pick the DOMINANT one.
- Only identify a career event if the journal entry actually describes a work-related event. Personal reflections without career context should have eventType: null.
- Only extract a company name if explicitly mentioned. Do not infer or guess.
- Triggers should be specific and drawn from the text (e.g., "tight deadline", "manager feedback", "team conflict").
- The summary should be warm and validating, not clinical.
- Be honest about your confidence — lower confidence for vague or ambiguous entries.

You MUST respond with ONLY valid JSON matching this exact schema (no markdown, no code fences, no commentary):
{
  "emotion": "one of the EMOTION TYPES above",
  "intensity": number (1-10),
  "eventType": "one of the EVENT TYPES above" or null,
  "companyName": "string" or null,
  "triggers": ["string", ...],
  "summary": "string (1-2 empathetic sentences)",
  "sentiment": "one of the SENTIMENT VALUES above",
  "confidence": number (0.0-1.0)
}`;

export function buildJournalMessage(
  journalText: string,
  user?: UserProfile | null,
): string {
  const sections: string[] = [];

  if (user) {
    sections.push(`## CONTEXT ABOUT THE WRITER
Name: ${user.name}
Role: ${user.role || 'Not specified'}
Goals: ${user.goals || 'Not specified'}`);
  }

  sections.push(`## JOURNAL ENTRY
${journalText}`);

  sections.push(`## REQUEST
Analyze the journal entry above and respond with JSON only.`);

  return sections.join('\n\n');
}

const VALID_EMOTIONS: EmotionType[] = [
  'Joy', 'Stress', 'Anxiety', 'Confidence', 'Frustration',
  'Pride', 'Fear', 'Excitement', 'Sadness', 'Hope', 'Anger', 'Gratitude',
];

const VALID_EVENT_TYPES: EventType[] = [
  'Meeting', 'Project', 'Review', 'Interview', 'Promotion',
  'Feedback', 'Presentation', 'Deadline', 'Conflict', 'Achievement', 'Learning', 'Other',
];

const VALID_SENTIMENTS = ['positive', 'negative', 'mixed', 'neutral'] as const;

export function parseJournalResponse(rawText: string): JournalAnalysisResult {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned);

  return {
    emotion: VALID_EMOTIONS.includes(parsed.emotion as EmotionType)
      ? parsed.emotion
      : 'Stress',
    intensity: Math.min(10, Math.max(1, Math.round(Number(parsed.intensity) || 5))),
    eventType: parsed.eventType && VALID_EVENT_TYPES.includes(parsed.eventType as EventType)
      ? parsed.eventType
      : null,
    companyName: typeof parsed.companyName === 'string' && parsed.companyName.trim()
      ? parsed.companyName.trim()
      : null,
    triggers: Array.isArray(parsed.triggers)
      ? parsed.triggers.filter((t: unknown) => typeof t === 'string').slice(0, 10)
      : [],
    summary: String(parsed.summary || 'Your feelings are valid.'),
    sentiment: VALID_SENTIMENTS.includes(parsed.sentiment)
      ? parsed.sentiment
      : 'neutral',
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
  };
}
