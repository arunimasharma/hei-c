import type { EmotionType } from '../types';

export const EMOTIONS: { type: EmotionType; icon: string; color: string }[] = [
  { type: 'Joy', icon: '😊', color: '#FBBF24' },
  { type: 'Stress', icon: '😰', color: '#F97316' },
  { type: 'Anxiety', icon: '😟', color: '#DC2626' },
  { type: 'Confidence', icon: '💪', color: '#8B5CF6' },
  { type: 'Frustration', icon: '😤', color: '#EF4444' },
  { type: 'Pride', icon: '🌟', color: '#10B981' },
  { type: 'Fear', icon: '😨', color: '#7C3AED' },
  { type: 'Excitement', icon: '🎉', color: '#F59E0B' },
  { type: 'Sadness', icon: '😢', color: '#3B82F6' },
  { type: 'Hope', icon: '🌱', color: '#6EE7B7' },
  { type: 'Anger', icon: '😠', color: '#B91C1C' },
  { type: 'Gratitude', icon: '🙏', color: '#84CC16' },
];

export function getEmotionColor(emotion: EmotionType): string {
  return EMOTIONS.find(e => e.type === emotion)?.color ?? '#6B7280';
}

export function getEmotionIcon(emotion: EmotionType): string {
  return EMOTIONS.find(e => e.type === emotion)?.icon ?? '😐';
}

export function getIntensityColor(intensity: number): string {
  if (intensity <= 3) return '#34D399';
  if (intensity <= 5) return '#FCD34D';
  if (intensity <= 7) return '#FB923C';
  return '#EF4444';
}

export function getIntensityLabel(intensity: number): string {
  if (intensity <= 3) return 'Low';
  if (intensity <= 5) return 'Moderate';
  if (intensity <= 7) return 'Elevated';
  return 'High';
}

export function getIntensityGradient(intensity: number): string {
  const pct = ((intensity - 1) / 9) * 100;
  return `linear-gradient(to right, #34D399 0%, #FCD34D 33%, #FB923C 66%, #EF4444 100%) 0% 0% / ${pct}% 100% no-repeat`;
}
