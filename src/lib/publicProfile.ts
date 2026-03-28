/**
 * publicProfile.ts
 *
 * Client-side public profile payload builder.
 * Reads ONLY from InsightStore (aggregated accuracy data) to produce:
 *   - credibilityScore  (0–100 derived metric)
 *   - expertTags        (theme strings, no raw answers)
 *   - proofHash         (SHA-256 tamper-resistant fingerprint)
 *
 * ─────────────────────────────────────────────────────────────
 * PRIVACY GUARANTEE
 * This module never reads or exposes:
 *   • Journal entries         • Emotion logs
 *   • CBT analysis            • Raw exercise answers
 *   • AI-generated reflections • Career events / decisions
 * ─────────────────────────────────────────────────────────────
 */

import { InsightStore } from './InsightStore';
import type { FrictionTheme } from '../data/frictionCases';

// ── Storage keys ──────────────────────────────────────────────────────────────

const SLUG_KEY             = 'heq_public_slug';
const PUBLIC_ENABLED_KEY   = 'heq_public_profile_enabled';

// ── Constants ─────────────────────────────────────────────────────────────────

export const PAYLOAD_VERSION = 1;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PublicProfilePayload {
  credibilityScore: number;
  expertTags: FrictionTheme[];
  /** Number of Friction Cases completed — used in proof hash, never exposed publicly. */
  caseCount: number;
  /** SHA-256 of "score|tags|caseCount|YYYY-MM" — tamper-resistance fingerprint. */
  proofHash: string;
  version: number;
  lastUpdated: string;
}

// ── Slug management ───────────────────────────────────────────────────────────

const SLUG_ADJECTIVES = [
  'keen', 'sharp', 'clear', 'swift', 'solid', 'bold',
  'bright', 'deep', 'true', 'wise', 'calm', 'steady',
];

const SLUG_NOUNS = [
  'lens', 'signal', 'mind', 'eye', 'view', 'take',
  'read', 'sense', 'grasp', 'frame', 'edge', 'track',
];

/**
 * Returns the user's stable public slug, creating one on first call.
 * Format: "{adjective}-{noun}-{4-hex}" — readable, URL-safe, no PII.
 */
export function getOrCreateSlug(): string {
  let slug = localStorage.getItem(SLUG_KEY);
  if (!slug) {
    const adj  = SLUG_ADJECTIVES[Math.floor(Math.random() * SLUG_ADJECTIVES.length)];
    const noun = SLUG_NOUNS[Math.floor(Math.random() * SLUG_NOUNS.length)];
    const hex  = Math.random().toString(16).slice(2, 6);
    slug = `${adj}-${noun}-${hex}`;
    localStorage.setItem(SLUG_KEY, slug);
  }
  return slug;
}

// ── Time bucket (anti-replay) ─────────────────────────────────────────────────

/**
 * Returns "YYYY-MM" for the current UTC month.
 * Including this in the hash means an old hash cannot be re-used
 * indefinitely — it becomes stale after the month rolls over.
 */
function timeBucket(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ── Proof hash ────────────────────────────────────────────────────────────────

/**
 * Builds a SHA-256 proof hash from public-safe aggregates only.
 *
 * Canonical string: "{score}|{sortedTags}|{caseCount}|{YYYY-MM}"
 *
 * Properties:
 *   • Deterministic — same inputs always produce the same hash
 *   • Tamper-evident — changing the score or tags invalidates the hash
 *   • Time-bound — YYYY-MM prevents old payloads from passing as current
 *   • Privacy-safe — contains zero raw user data
 *
 * Does NOT include raw exercise answers, journal text, or any PII.
 */
export async function buildProofHash(
  score: number,
  tags: FrictionTheme[],
  caseCount: number,
): Promise<string> {
  const canonical = [score, [...tags].sort().join(','), caseCount, timeBucket()].join('|');
  const encoded   = new TextEncoder().encode(canonical);
  const buffer    = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Payload builder ───────────────────────────────────────────────────────────

/**
 * Reads InsightStore and produces the public profile payload.
 * Returns null when there is no activity to share (0 cases submitted).
 *
 * Called by the sync layer and the private toggle UI to build
 * the payload before upserting to Supabase.
 */
export async function buildPublicProfilePayload(): Promise<PublicProfilePayload | null> {
  const profile = InsightStore.getProfile();
  if (profile.totalCases === 0) return null;

  const proofHash = await buildProofHash(
    profile.credibilityScore,
    profile.expertTags,
    profile.totalCases,
  );

  return {
    credibilityScore: profile.credibilityScore,
    expertTags:       profile.expertTags,
    caseCount:        profile.totalCases,
    proofHash,
    version:          PAYLOAD_VERSION,
    lastUpdated:      new Date().toISOString(),
  };
}

// ── Opt-in state ──────────────────────────────────────────────────────────────

export function isPublicProfileEnabled(): boolean {
  return localStorage.getItem(PUBLIC_ENABLED_KEY) === 'true';
}

export function setPublicProfileEnabled(enabled: boolean): void {
  localStorage.setItem(PUBLIC_ENABLED_KEY, String(enabled));
}
