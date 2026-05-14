import { track } from '@vercel/analytics';
import type { ReadinessArea, ValidatorMode } from '../types/validator';

// Thin wrapper around @vercel/analytics so callers don't have to remember
// event-name strings or guard against the function being unavailable.

type Props = Record<string, string | number | boolean | null>;

function safeTrack(event: string, props?: Props): void {
  try {
    track(event, props);
  } catch {
    // Analytics is best-effort; never let it break the UI.
  }
}

export function trackSessionStarted(mode: ValidatorMode): void {
  safeTrack('validator_session_started', { mode });
}

export function trackMessageSent(input: { sessionId: string; mode: ValidatorMode; turnNumber: number }): void {
  safeTrack('validator_message_sent', input);
}

export function trackDocGenerated(input: { sessionId: string; mode: ValidatorMode; chatTurns: number }): void {
  safeTrack('validator_doc_generated', input);
}

export function trackDocCopied(sessionId: string): void {
  safeTrack('validator_doc_copied', { sessionId });
}

export function trackDocDownloaded(sessionId: string): void {
  safeTrack('validator_doc_downloaded', { sessionId });
}

export function trackModeSwitched(from: ValidatorMode, to: ValidatorMode): void {
  safeTrack('validator_mode_switched', { from, to });
}

// ── v2 events ─────────────────────────────────────────────────────────────────

export function trackGenerateAnywayClicked(input: { sessionId: string; areasMissing: ReadinessArea[] }): void {
  safeTrack('validator_generate_anyway_clicked', {
    sessionId: input.sessionId,
    areas_missing: input.areasMissing.join(','),
    areas_missing_count: input.areasMissing.length,
  });
}

/** Total pushbacks observed across the session. Useful to detect adversarial drift. */
export function trackPushbackCount(input: { sessionId: string; total: number }): void {
  safeTrack('validator_pushback_count', { sessionId: input.sessionId, total: input.total });
}

export function trackBuildPromptCopied(input: {
  sessionId: string;
  mode: ValidatorMode;
  copiedSection: 'full' | 'build_only';
}): void {
  safeTrack('validator_build_prompt_copied', input);
}

export function trackProductClubMentioned(input: {
  sessionId: string;
  surface: 'chat' | 'build_prompt';
}): void {
  safeTrack('validator_product_club_mentioned', input);
}
