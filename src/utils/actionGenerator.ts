import type { EmotionEntry, MicroAction, EmotionType } from '../types';

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

export function generateSuggestedActions(recentEmotions: EmotionEntry[], existingActions: MicroAction[]): MicroAction[] {
  const activeActionTitles = new Set(existingActions.filter(a => !a.completed && !a.skipped).map(a => a.title));

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recent = recentEmotions.filter(e => new Date(e.timestamp) >= weekAgo);

  const emotionScores = new Map<EmotionType, number>();
  recent.forEach(e => {
    const current = emotionScores.get(e.emotion) ?? 0;
    emotionScores.set(e.emotion, current + e.intensity);
  });

  const scored = ACTION_LIBRARY
    .filter(a => !activeActionTitles.has(a.title))
    .map(action => {
      let score = 0;
      (action.suggestedFor ?? []).forEach(emotion => {
        score += emotionScores.get(emotion) ?? 0;
      });
      return { action, score };
    })
    .sort((a, b) => b.score - a.score);

  const result: MicroAction[] = [];
  const usedCategories = new Set<string>();

  for (const { action } of scored) {
    if (result.length >= 5) break;
    if (usedCategories.size < 3 || !usedCategories.has(action.category)) {
      result.push({
        ...action,
        id: generateId(),
        completed: false,
      });
      usedCategories.add(action.category);
    }
  }

  if (result.length < 3) {
    const remaining = ACTION_LIBRARY.filter(a => !activeActionTitles.has(a.title) && !result.find(r => r.title === a.title));
    for (const action of remaining) {
      if (result.length >= 3) break;
      result.push({ ...action, id: generateId(), completed: false });
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
