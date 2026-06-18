// ── Drilloop content calendar ──
// When a creator develops a post from rough notes and then publishes drills from
// it, the post is "approved" and lands on the content calendar with a date. From
// there the creator keeps editing it with the full post toolset (research,
// iterate, copy) and can reschedule. Persisted client-side like the rest of the
// Drilloop demo; in production this is a `content_posts` table.

export interface CalendarPost {
  id: string;
  title: string;
  post: string;
  /** Research directions captured at creation — power the "research & enhance" action later. */
  research: string[];
  /** Scheduled calendar date (ISO). Defaults to the approval date; the creator can reschedule. */
  date: string;
  createdAt: string;
  /** How many drills were published alongside this post (the "approval"). */
  drillsCount: number;
}

const STORAGE_KEY = 'drilloop_calendar_v1';

export function getCalendarPosts(): CalendarPost[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as CalendarPost[]).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  } catch {
    return [];
  }
}

function save(posts: CalendarPost[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); } catch { /* noop */ }
}

export function addCalendarPost(
  input: { title: string; post: string; research: string[]; drillsCount: number; date?: string },
  now: Date,
): CalendarPost {
  const entry: CalendarPost = {
    id: `post-${now.getTime()}`,
    title: input.title.trim() || 'Untitled post',
    post: input.post.trim(),
    research: input.research,
    date: input.date ?? now.toISOString(),
    createdAt: now.toISOString(),
    drillsCount: input.drillsCount,
  };
  save([entry, ...getCalendarPosts()]);
  return entry;
}

export function updateCalendarPost(
  id: string,
  patch: Partial<Pick<CalendarPost, 'title' | 'post' | 'date' | 'research'>>,
): CalendarPost | undefined {
  const next = getCalendarPosts().map(p => (p.id === id ? { ...p, ...patch } : p));
  save(next);
  return next.find(p => p.id === id);
}

export function deleteCalendarPost(id: string): void {
  save(getCalendarPosts().filter(p => p.id !== id));
}

// ── Author seed — hand a post idea from the calendar to the Author tab ──
// The "generate next post suggestion" flow writes a notes seed; the Author tab
// reads (and clears) it on mount to prefill "From rough notes".
const SEED_KEY = 'drilloop_author_seed_v1';

export function setAuthorSeed(text: string): void {
  try { localStorage.setItem(SEED_KEY, text); } catch { /* noop */ }
}

export function consumeAuthorSeed(): string | null {
  try {
    const raw = localStorage.getItem(SEED_KEY);
    if (raw) localStorage.removeItem(SEED_KEY);
    return raw;
  } catch {
    return null;
  }
}
