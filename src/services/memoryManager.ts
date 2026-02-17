import type { MicroAction, EmotionEntry, EmotionType } from '../types';
import type { ActionOutcome, EmotionPattern, MemoryStore } from '../types/llm';

const STORAGE_KEY = 'eicos_llm_memory';
const MAX_OUTCOMES = 100;
const MAX_PATTERNS = 12;

export function loadMemory(): MemoryStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MemoryStore;
  } catch {
    console.warn('Failed to load LLM memory');
  }
  return {
    actionOutcomes: [],
    emotionPatterns: [],
    lastSummaryTimestamp: '',
    conversationSummary: '',
  };
}

export function saveMemory(memory: MemoryStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    console.warn('Failed to save LLM memory');
  }
}

export function recordActionOutcome(
  action: MicroAction,
  wasCompleted: boolean,
  recentEmotions: EmotionEntry[],
): void {
  const memory = loadMemory();

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const emotionContext = recentEmotions
    .filter(e => new Date(e.timestamp).getTime() >= weekAgo)
    .map(e => e.emotion);

  const outcome: ActionOutcome = {
    actionTitle: action.title,
    category: action.category,
    wasCompleted,
    emotionContext: [...new Set(emotionContext)] as EmotionType[],
    timestamp: new Date().toISOString(),
  };

  memory.actionOutcomes = [outcome, ...memory.actionOutcomes].slice(0, MAX_OUTCOMES);
  saveMemory(memory);
}

export function updateEmotionPatterns(emotions: EmotionEntry[]): void {
  const memory = loadMemory();

  const byWeek = new Map<string, EmotionEntry[]>();
  for (const e of emotions) {
    const d = new Date(e.timestamp);
    const weekKey = getISOWeek(d);
    const existing = byWeek.get(weekKey) || [];
    existing.push(e);
    byWeek.set(weekKey, existing);
  }

  const patterns: EmotionPattern[] = [];
  for (const [week, entries] of byWeek) {
    const emotionMap = new Map<string, { total: number; count: number }>();
    const allTriggers: string[] = [];

    for (const e of entries) {
      const existing = emotionMap.get(e.emotion) || { total: 0, count: 0 };
      existing.total += e.intensity;
      existing.count += 1;
      emotionMap.set(e.emotion, existing);
      if (e.triggers) allTriggers.push(...e.triggers);
    }

    const dominantEmotions = [...emotionMap.entries()]
      .map(([emotion, { total, count }]) => ({
        emotion: emotion as EmotionType,
        avgIntensity: total / count,
        count,
      }))
      .sort((a, b) => b.count - a.count || b.avgIntensity - a.avgIntensity)
      .slice(0, 5);

    patterns.push({
      period: week,
      dominantEmotions,
      triggers: [...new Set(allTriggers)].slice(0, 10),
    });
  }

  memory.emotionPatterns = patterns.sort((a, b) => a.period.localeCompare(b.period)).slice(-MAX_PATTERNS);
  memory.lastSummaryTimestamp = new Date().toISOString();
  saveMemory(memory);
}

export function updateConversationSummary(
  insight: string,
  actionTitles: string[],
): void {
  const memory = loadMemory();
  const date = new Date().toLocaleDateString();
  const newEntry = `[${date}] Insight: ${insight}. Suggested: ${actionTitles.join(', ')}.`;

  let summary = memory.conversationSummary
    ? `${memory.conversationSummary} ${newEntry}`
    : newEntry;

  if (summary.length > 500) {
    summary = summary.slice(summary.length - 480);
    const firstPeriod = summary.indexOf('.');
    if (firstPeriod > 0 && firstPeriod < 100) {
      summary = summary.slice(firstPeriod + 2);
    }
  }

  memory.conversationSummary = summary;
  saveMemory(memory);
}

export function clearMemory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
