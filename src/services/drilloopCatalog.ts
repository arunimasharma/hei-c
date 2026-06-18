import type { Drill, DrillDraft, DrillTier } from '../types/drilloop';
import { DRILLS } from '../data/drilloopDrills';
import { phaseTitleOf } from './drilloopPhases';

// ── Drilloop catalog ──
// The published drill set the member experience reads and the creator authors.
// Source of truth = the seeded program (DRILLS) plus any drills the creator
// publishes in-app, persisted locally. In a production build this is the
// `drills` / `content_items` Postgres tables; here it is one localStorage key so
// the author→publish→member-practices loop works end to end in the browser.

const STORAGE_KEY = 'drilloop_authored_drills_v1';

function loadAuthored(): Drill[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Drill[];
  } catch {
    return [];
  }
}

function saveAuthored(drills: Drill[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drills));
  } catch {
    /* storage unavailable */
  }
}

/** The full published catalog: seeded program first, then creator-authored. */
export function getCatalog(): Drill[] {
  const authored = loadAuthored();
  return [...DRILLS, ...authored].sort((a, b) => a.order - b.order);
}

export function getAuthoredDrills(): Drill[] {
  return loadAuthored();
}

/** Free-preview drills shown before the paywall. */
export function getSampleDrills(): Drill[] {
  return getCatalog().filter(d => d.isSample);
}

/** The tier a drill is published to. isSample is the gate the member app reads. */
export function tierOf(drill: Drill): DrillTier {
  return drill.isSample ? 'free' : 'member';
}

/**
 * Publish creator drafts into the catalog, attaching them to a source URL
 * (content linking) and a phase. Each draft can carry its own tier; otherwise
 * `defaultTier` applies. Returns the newly-created drills.
 */
export function publishDrafts(
  drafts: DrillDraft[],
  opts: { phase: number; sourceUrl?: string; sourceLabel?: string; now: Date; defaultTier?: DrillTier },
): Drill[] {
  const existing = loadAuthored();
  const baseOrder = 100 + existing.length; // authored drills sort after the program
  const created: Drill[] = drafts.map((d, i) => {
    const tier = d.tier ?? opts.defaultTier ?? 'member';
    return {
      id: `auth-${opts.now.getTime()}-${i}`,
      phase: opts.phase,
      phaseTitle: phaseTitleOf(opts.phase),
      order: baseOrder + i,
      type: d.type,
      difficulty: d.difficulty,
      title: d.title,
      prompt: d.prompt,
      keyPoints: d.keyPoints,
      modelAnswer: d.modelAnswer,
      tags: ['authored'],
      authored: true,
      isSample: tier === 'free',
      sourceUrl: opts.sourceUrl,
      sourceLabel: opts.sourceLabel,
    };
  });
  saveAuthored([...existing, ...created]);
  return created;
}

export function getAuthoredById(id: string): Drill | undefined {
  return loadAuthored().find(d => d.id === id);
}

/** Edit an already-published authored drill (audit/lifecycle management). */
export function updateAuthoredDrill(
  id: string,
  patch: Partial<Pick<Drill, 'title' | 'prompt' | 'keyPoints' | 'modelAnswer' | 'type' | 'difficulty' | 'phase'>>,
): Drill | undefined {
  const next = loadAuthored().map(d =>
    d.id === id
      ? { ...d, ...patch, phaseTitle: patch.phase != null ? phaseTitleOf(patch.phase) : d.phaseTitle }
      : d,
  );
  saveAuthored(next);
  return next.find(d => d.id === id);
}

export function deleteAuthoredDrill(id: string): void {
  saveAuthored(loadAuthored().filter(d => d.id !== id));
}

/** Set an authored drill's publish tier explicitly. */
export function setDrillTier(id: string, tier: DrillTier): void {
  const drills = loadAuthored().map(d =>
    d.id === id ? { ...d, isSample: tier === 'free' } : d,
  );
  saveAuthored(drills);
}

/** Toggle whether an authored drill is a free preview. */
export function toggleSample(id: string): void {
  const drills = loadAuthored().map(d =>
    d.id === id ? { ...d, isSample: !d.isSample } : d,
  );
  saveAuthored(drills);
}
