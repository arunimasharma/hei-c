import type { EmotionEntry, CareerEvent, MicroAction, UserProfile, ActionCategory, EmotionType, Goal, EmotionalIntelligenceGoal } from '../types';
import type { LLMActionResponse, LLMGeneratedAction, MemoryStore } from '../types/llm';

export const SYSTEM_PROMPT = `You are an emotionally intelligent career coach embedded in a personal development app called Hello-EQ. Your role is to suggest 3-5 personalized micro-actions (each under 15 minutes) that help a professional navigate their current emotional state in the context of their career.

GUIDELINES:
- Each action must be specific, actionable, and completable in the stated time.
- Tailor actions to the person's role, goals, recent career events, and emotional patterns.
- If someone has been consistently stressed, do not just suggest breathing -- suggest actions that address root causes (boundary-setting, delegation conversations, task triage).
- If someone has been completing certain types of actions and skipping others, lean into what works for them.
- Mix categories for variety, but weight toward what the emotional data suggests is most needed.
- Use warm, direct, non-clinical language. You are a supportive colleague, not a therapist.
- Never diagnose mental health conditions or suggest professional therapy (that is out of scope).
- When the user is experiencing positive emotions (Joy, Pride, Excitement), suggest actions that amplify and build on that momentum rather than only focusing on problem-solving.

CATEGORIES (use exactly these strings):
"Stress Relief" | "Confidence Building" | "Energy Boost" | "Reflection" | "Grounding" | "Gratitude" | "Self-Care"

EMOTION TYPES (reference these exactly):
"Joy" | "Stress" | "Anxiety" | "Confidence" | "Frustration" | "Pride" | "Fear" | "Excitement" | "Sadness" | "Hope" | "Anger" | "Gratitude"

You MUST respond with ONLY valid JSON matching this exact schema (no markdown, no code fences, no commentary outside the JSON):
{
  "actions": [
    {
      "title": "string (concise, max 60 chars)",
      "description": "string (1-2 sentences: describe exactly what to do, what a completed version looks like, and when to do it — write it as a natural, encouraging instruction that feels immediately doable)",
      "category": "one of the CATEGORIES above",
      "estimatedMinutes": number (1-15),
      "reasoning": "string (1 sentence: why this action for this person right now)",
      "suggestedFor": ["EmotionType", "EmotionType"]
    }
  ],
  "insight": "string (1 sentence: a pattern you notice in their emotional data)"
}`;

export function buildUserMessage(
  user: UserProfile,
  recentEmotions: EmotionEntry[],
  recentEvents: CareerEvent[],
  memory: MemoryStore,
  currentActions: MicroAction[],
  goals: Goal[] = [],
): string {
  const sections: string[] = [];

  // Section 1: User profile
  sections.push(`## WHO YOU ARE COACHING
Name: ${user.name}
Role: ${user.role || 'Not specified'}
Goals: ${user.goals || 'Not specified'}
Using app since: ${new Date(user.createdAt).toLocaleDateString()}`);

  // Section 1.5: Career steering focus from Control Plane
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('heq_control_focus') : null;
    if (raw) {
      const focus = JSON.parse(raw) as { product?: string; coworker?: string; career?: string };
      const lines: string[] = [];
      if (focus.product) lines.push(`Product direction I'm steering toward: ${focus.product}`);
      if (focus.coworker) lines.push(`Coworker dynamics I want to grow capacity for: ${focus.coworker}`);
      if (focus.career) lines.push(`Career focus I'm actively building: ${focus.career}`);
      if (lines.length > 0) {
        sections.push(`## CAREER STEERING FOCUS (from user's Control Plane)\n${lines.join('\n')}\n\nIMPORTANT: Bias suggested actions toward these stated directions. Actions should feel like concrete steps in these directions, not generic coping.`);
      }
    }
  } catch { /* ignore — localStorage unavailable or malformed */ }

  // Section 2: Active goals
  const activeGoals = goals.filter(g => g.status === 'active');
  if (activeGoals.length > 0) {
    const goalLines = activeGoals.map(g => {
      const isEQ = 'focusArea' in g;
      const type = isEQ ? `EQ (${(g as EmotionalIntelligenceGoal).focusArea})` : 'Career';
      const due = new Date(g.targetDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      return `- [${type}] "${g.title}" — ${g.description} | Progress: ${g.progress}% | Target: ${due}`;
    });
    sections.push(`## ACTIVE GOALS\n${goalLines.join('\n')}\n\nIMPORTANT: Suggested actions should directly help this person make progress toward these goals, not just manage their current emotional state.`);
  }

  // Section 3: Recent emotions (last 7 days, max 15)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = recentEmotions
    .filter(e => new Date(e.timestamp).getTime() >= weekAgo)
    .slice(0, 15);

  if (recent.length > 0) {
    const emotionLines = recent.map(e => {
      const date = new Date(e.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const triggers = e.triggers?.length ? ` | Triggers: ${e.triggers.join(', ')}` : '';
      const notes = e.notes ? ` | "${e.notes}"` : '';
      return `- ${e.emotion} (intensity ${e.intensity}/10) on ${date}${triggers}${notes}`;
    });
    sections.push(`## RECENT EMOTIONS (last 7 days)\n${emotionLines.join('\n')}`);
  } else {
    sections.push(`## RECENT EMOTIONS\nNo emotions logged in the last 7 days.`);
  }

  // Section 3: Recent career events (last 14 days, max 5)
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recentEvts = recentEvents
    .filter(e => new Date(e.date).getTime() >= twoWeeksAgo)
    .slice(0, 5);

  if (recentEvts.length > 0) {
    const eventLines = recentEvts.map(e => {
      const desc = e.description ? `: ${e.description}` : '';
      return `- [${e.type}] "${e.title}"${desc} (outcome: ${e.outcome || 'pending'})`;
    });
    sections.push(`## RECENT CAREER EVENTS\n${eventLines.join('\n')}`);
  }

  // Section 4: Action history from memory (titles + categories)
  if (memory.actionOutcomes.length > 0) {
    const completed = memory.actionOutcomes.filter(a => a.wasCompleted);
    const skipped = memory.actionOutcomes.filter(a => !a.wasCompleted);

    const lines: string[] = [];
    if (completed.length > 0) {
      const recentTitles = completed.slice(0, 5).map(a => `"${a.actionTitle}"`).join(', ');
      lines.push(`Recently completed: ${recentTitles}`);
      const catCounts = new Map<string, number>();
      completed.forEach(a => catCounts.set(a.category, (catCounts.get(a.category) || 0) + 1));
      const sorted = [...catCounts.entries()].sort((a, b) => b[1] - a[1]);
      lines.push(`Preferred categories: ${sorted.map(([cat, n]) => `${cat} (${n}x)`).join(', ')}`);
    }
    if (skipped.length > 0) {
      const skippedTitles = skipped.slice(0, 8).map(a => `"${a.actionTitle}"`).join(', ');
      lines.push(`SKIPPED (do NOT suggest these or very similar actions): ${skippedTitles}`);
    }
    sections.push(`## ACTION HISTORY\n${lines.join('\n')}`);
  }

  // Section 5: Emotion patterns from memory
  if (memory.emotionPatterns.length > 0) {
    const latestPattern = memory.emotionPatterns[memory.emotionPatterns.length - 1];
    const patternLine = latestPattern.dominantEmotions
      .map(d => `${d.emotion} (avg ${d.avgIntensity.toFixed(1)}, ${d.count}x)`)
      .join(', ');
    const triggerLine = latestPattern.triggers.length > 0
      ? `\nCommon triggers: ${latestPattern.triggers.join(', ')}`
      : '';
    sections.push(`## EMOTIONAL PATTERNS (${latestPattern.period})\nDominant: ${patternLine}${triggerLine}`);
  }

  // Section 6: Recent AI insights (structured)
  if (memory.recentInsights && memory.recentInsights.length > 0) {
    const insightLines = memory.recentInsights
      .slice(0, 4)
      .map(i => `- [${i.date}] ${i.insight} (suggested: ${i.suggestedTitles.slice(0, 3).join(', ')})`);
    sections.push(`## PRIOR COACHING HISTORY\n${insightLines.join('\n')}`);
  } else if (memory.conversationSummary) {
    sections.push(`## PRIOR CONTEXT\n${memory.conversationSummary}`);
  }

  // Section 7: Currently active actions (avoid duplicates)
  const active = currentActions.filter(a => !a.completed && !a.skipped);
  if (active.length > 0) {
    sections.push(`## CURRENTLY ACTIVE ACTIONS (do not repeat these)\n${active.map(a => `- ${a.title}`).join('\n')}`);
  }

  sections.push(`## REQUEST\nBased on the above context, suggest 3-5 new micro-actions. Respond with JSON only.`);

  return sections.join('\n\n');
}

const VALID_CATEGORIES: ActionCategory[] = [
  'Stress Relief', 'Confidence Building', 'Energy Boost',
  'Reflection', 'Grounding', 'Gratitude', 'Self-Care',
];

const VALID_EMOTIONS: EmotionType[] = [
  'Joy', 'Stress', 'Anxiety', 'Confidence', 'Frustration',
  'Pride', 'Fear', 'Excitement', 'Sadness', 'Hope', 'Anger', 'Gratitude',
];

export function parseAndValidateResponse(rawText: string): LLMActionResponse {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed.actions) || parsed.actions.length === 0) {
    throw new Error('Response missing actions array');
  }

  const actions: LLMGeneratedAction[] = parsed.actions.slice(0, 5).map((a: Record<string, unknown>) => ({
    title: String(a.title || '').slice(0, 80),
    description: String(a.description || '').slice(0, 300),
    category: VALID_CATEGORIES.includes(a.category as ActionCategory)
      ? (a.category as ActionCategory)
      : 'Self-Care',
    estimatedMinutes: Math.min(15, Math.max(1, Number(a.estimatedMinutes) || 5)),
    reasoning: String(a.reasoning || ''),
    suggestedFor: Array.isArray(a.suggestedFor)
      ? (a.suggestedFor as string[]).filter(e => VALID_EMOTIONS.includes(e as EmotionType)) as EmotionType[]
      : [],
  }));

  return {
    actions,
    insight: String(parsed.insight || ''),
  };
}
