import type { EmotionEntry, CareerEvent, MicroAction, EmotionType, EventType } from '../types';
import { daysAgo } from './dateHelpers';

export function generateDemoEmotions(userId: string): EmotionEntry[] {
  const entries: { emotion: EmotionType; intensity: number; daysBack: number; notes?: string; triggers?: string[] }[] = [
    { emotion: 'Excitement', intensity: 8, daysBack: 0, notes: 'Got positive feedback on my project presentation', triggers: ['presentation', 'feedback'] },
    { emotion: 'Stress', intensity: 7, daysBack: 1, notes: 'Multiple deadlines approaching this week', triggers: ['deadlines', 'workload'] },
    { emotion: 'Confidence', intensity: 6, daysBack: 1, notes: 'Successfully led the team standup meeting' },
    { emotion: 'Anxiety', intensity: 5, daysBack: 2, notes: 'Performance review coming up next week', triggers: ['review', 'evaluation'] },
    { emotion: 'Joy', intensity: 9, daysBack: 3, notes: 'Team celebrated completing the Q4 project!' },
    { emotion: 'Frustration', intensity: 6, daysBack: 4, notes: 'Communication breakdown with cross-team stakeholder', triggers: ['communication', 'stakeholder'] },
    { emotion: 'Pride', intensity: 8, daysBack: 5, notes: 'Mentored a junior developer through their first PR' },
    { emotion: 'Hope', intensity: 7, daysBack: 6, notes: 'Applied for the senior position internally' },
    { emotion: 'Stress', intensity: 8, daysBack: 7, notes: 'Sprint planning revealed more work than expected', triggers: ['planning', 'scope'] },
    { emotion: 'Gratitude', intensity: 7, daysBack: 8, notes: 'Manager recognized my contributions in all-hands' },
    { emotion: 'Fear', intensity: 4, daysBack: 9, notes: 'New technology stack for upcoming project' },
    { emotion: 'Confidence', intensity: 8, daysBack: 10, notes: 'Nailed the technical interview for the internal transfer' },
    { emotion: 'Sadness', intensity: 3, daysBack: 11, notes: 'Colleague announced they are leaving the company' },
    { emotion: 'Excitement', intensity: 7, daysBack: 12, notes: 'Got invited to present at the company tech talk' },
  ];

  return entries.map((e, i) => ({
    id: `demo_emotion_${i}`,
    userId,
    emotion: e.emotion,
    intensity: e.intensity,
    timestamp: daysAgo(e.daysBack),
    notes: e.notes,
    triggers: e.triggers,
    eventId: i < 8 ? `demo_event_${i % 7}` : undefined,
  }));
}

export function generateDemoEvents(userId: string): CareerEvent[] {
  const events: { title: string; type: EventType; daysBack: number; description: string; outcome: CareerEvent['outcome'] }[] = [
    { title: 'Q4 Project Presentation', type: 'Presentation', daysBack: 0, description: 'Final presentation of Q4 project results to leadership', outcome: 'positive' },
    { title: 'Sprint Planning Meeting', type: 'Meeting', daysBack: 1, description: 'Weekly sprint planning with the development team', outcome: 'neutral' },
    { title: 'Performance Review Prep', type: 'Review', daysBack: 2, description: 'Preparing documentation for annual performance review', outcome: 'pending' },
    { title: 'Q4 Project Completion', type: 'Achievement', daysBack: 3, description: 'Successfully delivered the Q4 project on time', outcome: 'positive' },
    { title: 'Cross-team Sync', type: 'Meeting', daysBack: 4, description: 'Sync meeting with marketing team on product launch', outcome: 'mixed' },
    { title: 'Junior Dev Mentoring', type: 'Learning', daysBack: 5, description: 'Code review and mentoring session with new team member', outcome: 'positive' },
    { title: 'Internal Job Application', type: 'Interview', daysBack: 6, description: 'Applied for Senior Developer position in Platform team', outcome: 'pending' },
  ];

  return events.map((e, i) => ({
    id: `demo_event_${i}`,
    userId,
    title: e.title,
    type: e.type,
    date: daysAgo(e.daysBack),
    description: e.description,
    outcome: e.outcome,
  }));
}

export function generateDemoActions(): MicroAction[] {
  return [
    {
      id: 'demo_action_0',
      title: '5-Minute Breathing Exercise',
      description: 'Practice box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s.',
      category: 'Stress Relief',
      estimatedMinutes: 5,
      completed: false,
      suggestedFor: ['Stress', 'Anxiety'],
    },
    {
      id: 'demo_action_1',
      title: 'Gratitude Journaling',
      description: 'Write down 3 things you are grateful for in your career right now.',
      category: 'Gratitude',
      estimatedMinutes: 5,
      completed: false,
      suggestedFor: ['Joy', 'Gratitude'],
    },
    {
      id: 'demo_action_2',
      title: 'Strengths Assessment',
      description: 'List 5 professional strengths you have demonstrated recently.',
      category: 'Confidence Building',
      estimatedMinutes: 5,
      completed: false,
      suggestedFor: ['Fear', 'Anxiety'],
    },
    {
      id: 'demo_action_3',
      title: 'Quick Walk',
      description: 'Take a 10-minute walk outside. Focus on your surroundings.',
      category: 'Energy Boost',
      estimatedMinutes: 10,
      completed: true,
      completedAt: new Date(Date.now() - 86400000).toISOString(),
      suggestedFor: ['Stress', 'Frustration'],
    },
    {
      id: 'demo_action_4',
      title: 'Positive Affirmations',
      description: 'Repeat career affirmations: "I am capable," "I bring value."',
      category: 'Confidence Building',
      estimatedMinutes: 2,
      completed: false,
      suggestedFor: ['Anxiety', 'Fear'],
    },
  ];
}
