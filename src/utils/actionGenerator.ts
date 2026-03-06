import type { EmotionEntry, MicroAction, EmotionType, ActionCategory, Goal, EmotionalIntelligenceGoal } from '../types';
import { loadMemory } from '../services/memoryManager';

// Map EQ goal focus areas to the action categories that build them
const FOCUS_AREA_CATEGORY_MAP: Record<string, ActionCategory> = {
  'self-awareness': 'Reflection',
  'self-regulation': 'Grounding',
  'empathy': 'Reflection',
  'social-skills': 'Confidence Building',
  'motivation': 'Energy Boost',
};

const ACTION_LIBRARY: Omit<MicroAction, 'id' | 'completed' | 'completedAt' | 'skipped'>[] = [
  {
    title: '5-Minute Breathing Exercise',
    description: 'Practice box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s. Repeat 5 times.',
    category: 'Stress Relief',
    estimatedMinutes: 5,
    suggestedFor: ['Stress', 'Anxiety', 'Anger'],
  },
  {
    title: 'Quick Body Scan',
    description: 'Close your eyes and scan from head to toe, releasing tension in each area.',
    category: 'Grounding',
    estimatedMinutes: 3,
    suggestedFor: ['Anxiety', 'Stress', 'Fear'],
  },
  {
    title: 'Gratitude Journaling',
    description: 'Write down 3 things you are grateful for in your career right now.',
    category: 'Gratitude',
    estimatedMinutes: 5,
    suggestedFor: ['Joy', 'Gratitude', 'Hope', 'Pride'],
  },
  {
    title: 'Celebrate a Win',
    description: 'Think of a recent accomplishment and take a moment to truly celebrate it.',
    category: 'Confidence Building',
    estimatedMinutes: 3,
    suggestedFor: ['Pride', 'Joy', 'Excitement', 'Confidence'],
  },
  {
    title: 'Strengths Assessment',
    description: 'List 5 professional strengths you have demonstrated recently.',
    category: 'Confidence Building',
    estimatedMinutes: 5,
    suggestedFor: ['Frustration', 'Sadness', 'Fear'],
  },
  {
    title: 'Desk Stretching Routine',
    description: 'Do 5 simple stretches at your desk: neck rolls, shoulder shrugs, wrist circles, seated twist, standing hamstring stretch.',
    category: 'Energy Boost',
    estimatedMinutes: 5,
    suggestedFor: ['Stress', 'Frustration', 'Sadness'],
  },
  {
    title: 'Positive Affirmations',
    description: 'Repeat 3 career affirmations: "I am capable," "I bring value," "I am growing."',
    category: 'Confidence Building',
    estimatedMinutes: 2,
    suggestedFor: ['Anxiety', 'Fear', 'Sadness'],
  },
  {
    title: '5-4-3-2-1 Grounding',
    description: 'Name 5 things you see, 4 you hear, 3 you touch, 2 you smell, 1 you taste.',
    category: 'Grounding',
    estimatedMinutes: 3,
    suggestedFor: ['Anxiety', 'Fear', 'Stress'],
  },
  {
    title: 'Quick Walk',
    description: 'Take a 10-minute walk outside. Focus on your surroundings, not your thoughts.',
    category: 'Stress Relief',
    estimatedMinutes: 10,
    suggestedFor: ['Stress', 'Anger', 'Frustration'],
  },
  {
    title: 'Reflection Journal',
    description: 'Spend 5 minutes writing about what you learned from a recent challenge.',
    category: 'Reflection',
    estimatedMinutes: 5,
    suggestedFor: ['Frustration', 'Sadness', 'Anxiety'],
  },
  {
    title: 'Mentor Check-in',
    description: 'Reach out to a mentor or trusted colleague for a brief career conversation.',
    category: 'Confidence Building',
    estimatedMinutes: 15,
    suggestedFor: ['Fear', 'Anxiety', 'Sadness'],
  },
  {
    title: 'Mindful Coffee Break',
    description: 'Make a warm drink and savor it mindfully. Focus on taste, warmth, and aroma.',
    category: 'Self-Care',
    estimatedMinutes: 10,
    suggestedFor: ['Stress', 'Frustration', 'Anger'],
  },
  {
    title: 'Career Vision Board',
    description: 'Spend time visualizing your career goals and what success looks like for you.',
    category: 'Reflection',
    estimatedMinutes: 10,
    suggestedFor: ['Hope', 'Excitement', 'Confidence'],
  },
  {
    title: 'Progressive Muscle Relaxation',
    description: 'Tense and release each muscle group for 5 seconds, starting from your toes up.',
    category: 'Stress Relief',
    estimatedMinutes: 8,
    suggestedFor: ['Stress', 'Anxiety', 'Anger'],
  },
  {
    title: 'Share Your Success',
    description: 'Tell someone about a recent career win. Sharing amplifies positive emotions.',
    category: 'Gratitude',
    estimatedMinutes: 5,
    suggestedFor: ['Joy', 'Pride', 'Excitement', 'Gratitude'],
  },
  {
    title: 'Digital Detox Break',
    description: 'Step away from all screens for 10 minutes. Rest your eyes and mind.',
    category: 'Self-Care',
    estimatedMinutes: 10,
    suggestedFor: ['Stress', 'Frustration', 'Anxiety'],
  },
  {
    title: 'Power Pose',
    description: 'Stand in a confident posture for 2 minutes. Research shows it boosts confidence.',
    category: 'Confidence Building',
    estimatedMinutes: 2,
    suggestedFor: ['Fear', 'Anxiety', 'Sadness'],
  },
  {
    title: 'Kind Self-Talk',
    description: 'Replace one negative thought about your career with a compassionate, realistic one.',
    category: 'Self-Care',
    estimatedMinutes: 3,
    suggestedFor: ['Frustration', 'Sadness', 'Anger', 'Fear'],
  },
];

let actionCounter = 0;

function generateId(): string {
  return `action_${Date.now()}_${actionCounter++}`;
}

// Trigger keywords mapped to action categories that address them
const TRIGGER_CATEGORY_MAP: Record<string, ActionCategory> = {
  workload: 'Stress Relief',
  deadline: 'Stress Relief',
  overwhelmed: 'Stress Relief',
  meeting: 'Grounding',
  conflict: 'Grounding',
  feedback: 'Reflection',
  review: 'Reflection',
  promotion: 'Confidence Building',
  presentation: 'Confidence Building',
  interview: 'Confidence Building',
  achievement: 'Gratitude',
  success: 'Gratitude',
};

export function generateSuggestedActions(recentEmotions: EmotionEntry[], existingActions: MicroAction[], goals: Goal[] = []): MicroAction[] {
  const memory = loadMemory();

  // Boost categories aligned with active EQ goal focus areas
  const goalCategoryBoosts = new Map<ActionCategory, number>();
  goals
    .filter(g => g.status === 'active' && 'focusArea' in g)
    .forEach(g => {
      const cat = FOCUS_AREA_CATEGORY_MAP[(g as EmotionalIntelligenceGoal).focusArea];
      if (cat) goalCategoryBoosts.set(cat, (goalCategoryBoosts.get(cat) ?? 0) + 2);
    });

  // Titles to avoid: currently active + previously skipped
  const skippedTitles = new Set(
    memory.actionOutcomes.filter(a => !a.wasCompleted).map(a => a.actionTitle)
  );
  const activeActionTitles = new Set(
    existingActions.filter(a => !a.completed && !a.skipped).map(a => a.title)
  );
  const excludedTitles = new Set([...activeActionTitles, ...skippedTitles]);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recent = recentEmotions.filter(e => new Date(e.timestamp) >= weekAgo);

  const now = Date.now();

  // Recency-weighted emotion scores: newer entries count more
  const emotionScores = new Map<EmotionType, number>();
  recent.forEach(e => {
    const ageDays = (now - new Date(e.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.max(0.3, 1 - ageDays / 7); // 1.0 → 0.3 over 7 days
    const weighted = e.intensity * recencyWeight;
    emotionScores.set(e.emotion, (emotionScores.get(e.emotion) ?? 0) + weighted);
  });

  // Boost categories that match known triggers
  const triggeredCategories = new Map<ActionCategory, number>();
  recent.forEach(e => {
    (e.triggers ?? []).forEach(trigger => {
      const cat = TRIGGER_CATEGORY_MAP[trigger.toLowerCase()];
      if (cat) triggeredCategories.set(cat, (triggeredCategories.get(cat) ?? 0) + 1);
    });
  });

  // Prefer categories the user has completed before
  const completedCatCounts = new Map<string, number>();
  memory.actionOutcomes
    .filter(a => a.wasCompleted)
    .forEach(a => completedCatCounts.set(a.category, (completedCatCounts.get(a.category) ?? 0) + 1));

  const scored = ACTION_LIBRARY
    .filter(a => !excludedTitles.has(a.title))
    .map(action => {
      let score = 0;
      // Base: emotion match with recency weighting
      (action.suggestedFor ?? []).forEach(emotion => {
        score += emotionScores.get(emotion) ?? 0;
      });
      // Boost: trigger-matched categories
      score += (triggeredCategories.get(action.category) ?? 0) * 2;
      // Boost: active goal focus areas
      score += goalCategoryBoosts.get(action.category) ?? 0;
      // Boost: previously completed category (user finds this type helpful)
      score += (completedCatCounts.get(action.category) ?? 0) * 0.5;
      return { action, score };
    })
    .sort((a, b) => b.score - a.score);

  const result: MicroAction[] = [];
  const usedCategories = new Set<string>();
  const generatedAt = new Date().toISOString();

  for (const { action } of scored) {
    if (result.length >= 5) break;
    if (usedCategories.size < 3 || !usedCategories.has(action.category)) {
      result.push({
        ...action,
        id: generateId(),
        completed: false,
        generatedAt,
      });
      usedCategories.add(action.category);
    }
  }

  // Fill to minimum 3 from remaining (ignoring skipped for backfill if needed)
  if (result.length < 3) {
    const resultTitles = new Set(result.map(r => r.title));
    const backfill = ACTION_LIBRARY.filter(
      a => !activeActionTitles.has(a.title) && !resultTitles.has(a.title)
    );
    for (const action of backfill) {
      if (result.length >= 3) break;
      result.push({ ...action, id: generateId(), completed: false, generatedAt });
    }
  }

  return result;
}

export function getDefaultActions(): MicroAction[] {
  return ACTION_LIBRARY.slice(0, 5).map(action => ({
    ...action,
    id: generateId(),
    completed: false,
  }));
}
