import { PHASE_TITLES } from '../data/drilloopDrills';

// ── Drilloop learning-program phases ──
// Seeded phases (PHASE_TITLES, 0-8) are the built-in study plan. Creators can
// add their own phases; those persist to localStorage and merge with the seeded
// set. In production this is a `phases` table scoped to the creator's program.

export interface Phase {
  phase: number;
  title: string;
  /** True for creator-created phases (vs. the seeded program). */
  custom?: boolean;
}

const STORAGE_KEY = 'drilloop_custom_phases_v1';

function loadCustom(): Phase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Phase[]).map(p => ({ ...p, custom: true }));
  } catch {
    return [];
  }
}

function saveCustom(phases: Phase[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(phases)); } catch { /* noop */ }
}

const seededPhases = (): Phase[] =>
  Object.entries(PHASE_TITLES).map(([p, title]) => ({ phase: Number(p), title }));

/** All phases — seeded program first, then creator-created, sorted by number. */
export function getPhases(): Phase[] {
  return [...seededPhases(), ...loadCustom()].sort((a, b) => a.phase - b.phase);
}

export function getCustomPhases(): Phase[] {
  return loadCustom().sort((a, b) => a.phase - b.phase);
}

/** Resolve a phase number to its title (handles seeded + custom). */
export function phaseTitleOf(phase: number): string {
  return getPhases().find(p => p.phase === phase)?.title ?? `Phase ${phase}`;
}

/** Create a new creator phase. Numbered above all existing phases. */
export function createPhase(title: string): Phase {
  const existing = getPhases();
  const nextNum = Math.max(0, ...existing.map(p => p.phase)) + 1;
  const phase: Phase = { phase: nextNum, title: title.trim() || `Phase ${nextNum}`, custom: true };
  saveCustom([...loadCustom(), phase]);
  return phase;
}

/** Rename a creator-created phase. Seeded phases are read-only. */
export function renamePhase(phase: number, title: string): void {
  saveCustom(loadCustom().map(p => (p.phase === phase ? { ...p, title: title.trim() || p.title } : p)));
}

/** Delete a creator-created phase (seeded phases can't be deleted). */
export function deletePhase(phase: number): void {
  saveCustom(loadCustom().filter(p => p.phase !== phase));
}
