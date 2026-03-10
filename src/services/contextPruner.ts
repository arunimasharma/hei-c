/**
 * Context Pruner — longitudinal data summarisation
 *
 * As a user's history grows, passing raw records to Claude inflates prompt
 * token usage.  This module compresses historical data into dense summaries
 * that preserve signal while staying within a configurable token budget.
 *
 * Strategy:
 *  - Recent data (last 7 days) → kept verbatim as rich context
 *  - Older data → compressed into a statistical + narrative summary
 *  - Memory insights → kept as-is (already compact)
 *
 * The output is ready to embed directly into a Claude system/user prompt.
 */

import type { EmotionEntry, JournalReflection } from '../types';
import type { MemoryStore } from '../types/llm';

// ── Configuration ─────────────────────────────────────────────────────────────

/** Max number of recent verbatim emotion entries to include. */
const MAX_RECENT_EMOTIONS = 10;
/** Max number of approved reflections to summarise. */
const MAX_REFLECTIONS_SUMMARY = 6;
/** Milliseconds in one week. */
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ── Public API ────────────────────────────────────────────────────────────────

export interface PrunedContext {
  /** Verbatim recent emotions (last 7 days, capped at MAX_RECENT_EMOTIONS). */
  recentEmotions: EmotionEntry[];
  /** Compressed narrative of older emotional history. */
  historySummary: string;
  /** Compressed narrative from approved reflections. */
  reflectionSummary: string;
  /** True if any historical data was pruned (older than 7 days). */
  wasPruned: boolean;
}

/**
 * Prunes and compresses longitudinal user data into a context-efficient form.
 *
 * @param emotions  Full emotion history (newest first)
 * @param reflections  Full reflection history
 * @param memory  Memory store with patterns and insights
 */
export function pruneContext(
  emotions: EmotionEntry[],
  reflections: JournalReflection[],
  memory: MemoryStore,
): PrunedContext {
  const cutoff = Date.now() - ONE_WEEK_MS;

  // ── Split emotions into recent + historical ──────────────────────────────
  const recentEmotions = emotions
    .filter(e => new Date(e.timestamp).getTime() >= cutoff)
    .slice(0, MAX_RECENT_EMOTIONS);

  const historicalEmotions = emotions.filter(
    e => new Date(e.timestamp).getTime() < cutoff,
  );

  const wasPruned = historicalEmotions.length > 0;

  // ── Compress historical emotions ─────────────────────────────────────────
  let historySummary = '';
  if (historicalEmotions.length > 0) {
    const countMap = new Map<string, { total: number; n: number }>();
    for (const e of historicalEmotions) {
      const curr = countMap.get(e.emotion) ?? { total: 0, n: 0 };
      curr.total += e.intensity;
      curr.n += 1;
      countMap.set(e.emotion, curr);
    }

    const sorted = [...countMap.entries()]
      .map(([emotion, { total, n }]) => ({ emotion, avg: total / n, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);

    const emotionLines = sorted
      .map(({ emotion, avg, n }) => `${emotion} (${n}× avg ${avg.toFixed(1)}/10)`)
      .join(', ');

    const oldestDate = new Date(
      Math.min(...historicalEmotions.map(e => new Date(e.timestamp).getTime())),
    ).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    historySummary =
      `Historical emotional baseline (${oldestDate} – last week, ${historicalEmotions.length} entries): ` +
      `${emotionLines}.`;

    // Append pattern-level trigger summary from memory if available
    const allPatternTriggers = memory.emotionPatterns
      .flatMap(p => p.triggers)
      .reduce<Map<string, number>>((acc, t) => { acc.set(t, (acc.get(t) ?? 0) + 1); return acc; }, new Map());

    const topTriggers = [...allPatternTriggers.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([t]) => t);

    if (topTriggers.length > 0) {
      historySummary += ` Recurring triggers across history: ${topTriggers.join(', ')}.`;
    }
  }

  // ── Compress approved reflections ────────────────────────────────────────
  const approved = reflections
    .filter(r => r.status === 'approved' && r.detectedSummary)
    .slice(0, MAX_REFLECTIONS_SUMMARY);

  let reflectionSummary = '';
  if (approved.length > 0) {
    const lines = approved.map(r => {
      const date = new Date(r.timestamp).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
      });
      const emotion = r.approvedEmotion ?? r.detectedEmotion ?? 'unknown';
      const intensity = r.approvedIntensity ?? r.detectedIntensity ?? '?';
      return `[${date}] ${emotion} (${intensity}/10): ${r.detectedSummary}`;
    });
    reflectionSummary = lines.join('\n');
  }

  return { recentEmotions, historySummary, reflectionSummary, wasPruned };
}

/**
 * Formats pruned context into prompt-ready markdown sections.
 * Returns an empty string if no context is available.
 */
export function formatPrunedContextForPrompt(ctx: PrunedContext): string {
  const sections: string[] = [];

  if (ctx.historySummary) {
    sections.push(`## HISTORICAL CONTEXT (compressed)\n${ctx.historySummary}`);
  }

  if (ctx.reflectionSummary) {
    sections.push(`## RECENT JOURNAL REFLECTIONS\n${ctx.reflectionSummary}`);
  }

  return sections.join('\n\n');
}
