// ── Drilloop "request more drills" ──
// A member, inside a topic, can ask the creator for more drills and leave a note
// (a sub-topic, scenario, or angle they want). Persisted client-side like the
// rest of the Drilloop demo; the creator sees these in the Insights tab. In
// production this is a `drill_requests` table scoped to the creator's program.

export interface DrillRequest {
  id: string;
  /** The topic (phase) the request was made from. */
  phase: number;
  topicTitle: string;
  text: string;
  at: string;
}

const STORAGE_KEY = 'drilloop_drill_requests_v1';

export function getDrillRequests(): DrillRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as DrillRequest[]).sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  } catch {
    return [];
  }
}

export function addDrillRequest(
  input: { phase: number; topicTitle: string; text: string },
  now: Date,
): DrillRequest {
  const req: DrillRequest = {
    id: `req-${now.getTime()}`,
    phase: input.phase,
    topicTitle: input.topicTitle,
    text: input.text.trim(),
    at: now.toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([req, ...getDrillRequests()]));
  } catch {
    /* noop */
  }
  return req;
}
