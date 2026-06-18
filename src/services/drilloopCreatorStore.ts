// ── Drilloop creator-side persistence ──
// Everything the creator owns that isn't a drill: their shareable invite config
// and the in-person gatherings they host. Fully client-side (localStorage) to
// match the rest of the Drilloop demo; in production these are the `creators`
// and `gatherings` tables.

const GATHERINGS_KEY = 'drilloop_gatherings_v1';
const SHARE_KEY = 'drilloop_share_v1';

// ── Share / invite config ──────────────────────────────────────────────────

export interface ShareConfig {
  /** Creator handle that becomes the referral code in the invite link. */
  handle: string;
  /** Headline the invite landing shows. */
  headline: string;
}

const DEFAULT_SHARE: ShareConfig = {
  handle: 'arunima',
  headline: 'Drill the judgment that makes you defensible — free to start.',
};

export function getShareConfig(): ShareConfig {
  try {
    const raw = localStorage.getItem(SHARE_KEY);
    return raw ? { ...DEFAULT_SHARE, ...JSON.parse(raw) } : DEFAULT_SHARE;
  } catch {
    return DEFAULT_SHARE;
  }
}

export function saveShareConfig(cfg: ShareConfig): void {
  try { localStorage.setItem(SHARE_KEY, JSON.stringify(cfg)); } catch { /* noop */ }
}

/** The public invite link a creator shares. Free join; upgrade prompted later. */
export function buildInviteLink(handle: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://hello-eq.club';
  return `${origin}/drilloop?ref=${encodeURIComponent(handle)}`;
}

// ── In-person gatherings ────────────────────────────────────────────────────

export interface Gathering {
  id: string;
  city: string;
  venue: string;
  /** Free-text date/time, e.g. "Thu, Jul 3 · 6:30pm". */
  when: string;
  capacity: number;
  note: string;
  createdAt: string;
  status: 'scheduled' | 'cancelled';
  /** Demo RSVP count; seeded small so the card looks alive. */
  rsvps: number;
}

export function getGatherings(): Gathering[] {
  try {
    const raw = localStorage.getItem(GATHERINGS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Gathering[]).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch {
    return [];
  }
}

function saveGatherings(gs: Gathering[]): void {
  try { localStorage.setItem(GATHERINGS_KEY, JSON.stringify(gs)); } catch { /* noop */ }
}

export function createGathering(
  input: { city: string; venue: string; when: string; capacity: number; note: string },
  now: Date,
): Gathering {
  const g: Gathering = {
    id: `gather-${now.getTime()}`,
    city: input.city.trim(),
    venue: input.venue.trim(),
    when: input.when.trim(),
    capacity: Math.max(2, input.capacity || 12),
    note: input.note.trim(),
    createdAt: now.toISOString(),
    status: 'scheduled',
    rsvps: 0,
  };
  saveGatherings([g, ...getGatherings()]);
  return g;
}

export function cancelGathering(id: string, _now: Date): void {
  saveGatherings(getGatherings().map(g => (g.id === id ? { ...g, status: 'cancelled' } : g)));
}

/** A ready-to-paste announcement the creator sends to the community. */
export function gatheringAnnouncement(g: Gathering, creatorName: string): string {
  return [
    `📍 ${creatorName} is hosting a Drilloop meetup in ${g.city}!`,
    '',
    `🗓 ${g.when}`,
    `📌 ${g.venue}`,
    g.note ? `\n${g.note}` : '',
    `\nWe'll debate the week's hardest drills over coffee. ${g.capacity} spots — reply to claim yours.`,
  ].filter(Boolean).join('\n');
}
