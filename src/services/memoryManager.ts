/**
 * LLM Memory Manager — backed by encrypted Dexie/IndexedDB
 *
 * All memory data is stored via the same encrypted persistence layer as the
 * rest of app state (AES-256-GCM).  The legacy localStorage key is handled
 * by the one-time migration in db.ts.
 */

import type { MicroAction, EmotionEntry, EmotionType } from '../types';
import type { ActionOutcome, EmotionPattern, MemoryInsight, MemoryStore } from '../types/llm';
import { db, KV_LLM_MEMORY, dbPut, dbGet } from './db';

// ── In-memory cache ───────────────────────────────────────────────────────────

const EMPTY_MEMORY: MemoryStore = {
  actionOutcomes: [],
  emotionPatterns: [],
  lastSummaryTimestamp: '',
  conversationSummary: '',
  recentInsights: [],
};

let _cache: MemoryStore = { ...EMPTY_MEMORY };
let _cacheLoaded = false;
let _loadPromise: Promise<void> | null = null;

// ── Load / Save ───────────────────────────────────────────────────────────────

async function ensureLoaded(): Promise<void> {
  if (_cacheLoaded) return;
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    try {
      const stored = await dbGet<MemoryStore>(db.keyvalue, KV_LLM_MEMORY);
      if (stored) {
        _cache = { ...EMPTY_MEMORY, ...stored };
        if (!_cache.recentInsights) _cache.recentInsights = [];
      }
    } catch {
      console.warn('[HEQ] Failed to load LLM memory from Dexie');
    } finally {
      _cacheLoaded = true;
    }
  })();
  return _loadPromise;
}

async function saveMemory(memory: MemoryStore): Promise<void> {
  _cache = memory;
  try {
    await dbPut(db.keyvalue, KV_LLM_MEMORY, memory);
  } catch {
    console.warn('[HEQ] Failed to save LLM memory to Dexie');
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const MAX_OUTCOMES = 100;
const MAX_PATTERNS = 12;

/** Returns the in-memory cache (sync, best-effort). */
export function loadMemory(): MemoryStore {
  void ensureLoaded();
  return _cache;
}

/** Async variant — guaranteed to read from Dexie on first call. */
export async function loadMemoryAsync(): Promise<MemoryStore> {
  await ensureLoaded();
  return _cache;
}

export function recordActionOutcome(
  action: MicroAction,
  wasCompleted: boolean,
  recentEmotions: EmotionEntry[],
): void {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const emotionContext = [
    ...new Set(
      recentEmotions
        .filter(e => new Date(e.timestamp).getTime() >= weekAgo)
        .map(e => e.emotion),
    ),
  ] as EmotionType[];

  const outcome: ActionOutcome = {
    actionTitle:   action.title,
    category:      action.category,
    wasCompleted,
    emotionContext,
    timestamp:     new Date().toISOString(),
  };

  const updated: MemoryStore = {
    ..._cache,
    actionOutcomes: [outcome, ..._cache.actionOutcomes].slice(0, MAX_OUTCOMES),
  };
  void saveMemory(updated);
}

export function updateEmotionPatterns(emotions: EmotionEntry[]): void {
  const byWeek = new Map<string, EmotionEntry[]>();
  for (const e of emotions) {
    const weekKey = getISOWeek(new Date(e.timestamp));
    const bucket = byWeek.get(weekKey) ?? [];
    bucket.push(e);
    byWeek.set(weekKey, bucket);
  }

  const patterns: EmotionPattern[] = [];
  for (const [week, entries] of byWeek) {
    const emotionMap = new Map<string, { total: number; count: number }>();
    const allTriggers: string[] = [];
    for (const e of entries) {
      const curr = emotionMap.get(e.emotion) ?? { total: 0, count: 0 };
      curr.total += e.intensity;
      curr.count += 1;
      emotionMap.set(e.emotion, curr);
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
    patterns.push({ period: week, dominantEmotions, triggers: [...new Set(allTriggers)].slice(0, 10) });
  }

  const updated: MemoryStore = {
    ..._cache,
    emotionPatterns: patterns.sort((a, b) => a.period.localeCompare(b.period)).slice(-MAX_PATTERNS),
    lastSummaryTimestamp: new Date().toISOString(),
  };
  void saveMemory(updated);
}

export function updateConversationSummary(insight: string, actionTitles: string[]): void {
  const newInsight: MemoryInsight = {
    date: new Date().toLocaleDateString(),
    insight,
    suggestedTitles: actionTitles,
  };
  const recentInsights = [newInsight, ...(_cache.recentInsights ?? [])].slice(0, 8);
  const updated: MemoryStore = {
    ..._cache,
    recentInsights,
    conversationSummary: recentInsights.map(i => `[${i.date}] ${i.insight}`).join(' | '),
  };
  void saveMemory(updated);
}

export function getSkippedActionTitles(limit = 30): string[] {
  return _cache.actionOutcomes.filter(a => !a.wasCompleted).slice(0, limit).map(a => a.actionTitle);
}

export function getCompletedActionTitles(limit = 30): string[] {
  return _cache.actionOutcomes.filter(a => a.wasCompleted).slice(0, limit).map(a => a.actionTitle);
}

export function clearMemory(): void {
  _cache = { ...EMPTY_MEMORY };
  _cacheLoaded = false;
  _loadPromise = null;
}

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 + Math.round(((d.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
