/**
 * FrictionDetector — lightweight friction-event SDK
 * Detects: time_stall | exit_intent | scroll_stall | no_action
 * No external dependencies, no PII, target <5 KB minified.
 */

export type TriggerName = 'time_stall' | 'exit_intent' | 'scroll_stall' | 'no_action';

export interface FrictionEvent {
  type: 'friction_detected';
  trigger: TriggerName;
  timestamp: number;
  metadata: {
    page_id: string;
    scroll_pct: number;
    session_id: string;
    [key: string]: unknown;
  };
}

export interface FrictionConfig {
  /** ms of inactivity before time_stall fires (default 5000) */
  timeStallMs?: number;
  /** scroll depth % required before scroll_stall is armed (default 30) */
  scrollStallPct?: number;
  /** ms of scroll inactivity before scroll_stall fires (default 3000) */
  scrollStallIdleMs?: number;
  /** ms after page load with no activity before no_action fires (default 10000) */
  noActionMs?: number;
  /** which triggers to enable on init; all enabled if omitted */
  enabledTriggers?: TriggerName[];
}

type EventMap = {
  friction_detected: FrictionEvent;
  [trigger: string]: FrictionEvent;
};

type Listener<T> = (event: T) => void;

// ─── helpers ────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  const rand = Math.random().toString(36).slice(2, 11);
  const ts = Date.now().toString(36);
  return `s_${rand}${ts}`;
}

function scrollDepthPct(): number {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  return Math.min(100, Math.round((window.scrollY / scrollable) * 100));
}

// ─── class ──────────────────────────────────────────────────────────────────

export class FrictionDetector {
  // config
  private _timeStallMs = 5_000;
  private _scrollStallPct = 30;
  private _scrollStallIdleMs = 3_000;
  private _noActionMs = 10_000;

  // state
  private readonly _sessionId: string;
  private _enabledTriggers: Set<TriggerName>;
  private _listeners: Map<string, Set<Listener<FrictionEvent>>> = new Map();

  /**
   * Tracks which triggers have already fired in the current idle window.
   * Cleared when user activity resumes (except no_action which is page-lifetime).
   */
  private _firedInIdle: Set<TriggerName> = new Set();

  /** no_action is page-lifetime — once fired, never again */
  private _noActionFired = false;

  private _maxScrollPct = 0;
  private _timers: Partial<Record<TriggerName | 'scrollStall', ReturnType<typeof setTimeout>>> = {};

  // bound handler refs so we can removeEventListener
  private _onActivity!: () => void;
  private _onMouseLeave!: (e: MouseEvent) => void;
  private _onScroll!: () => void;
  private _attached = false;

  constructor() {
    this._sessionId = generateSessionId();
    this._enabledTriggers = new Set(['time_stall', 'exit_intent', 'scroll_stall', 'no_action']);
  }

  /** Configure and start detection. Call once after construction. */
  init(config: FrictionConfig = {}): this {
    if (config.timeStallMs !== undefined)     this._timeStallMs = config.timeStallMs;
    if (config.scrollStallPct !== undefined)  this._scrollStallPct = config.scrollStallPct;
    if (config.scrollStallIdleMs !== undefined) this._scrollStallIdleMs = config.scrollStallIdleMs;
    if (config.noActionMs !== undefined)      this._noActionMs = config.noActionMs;
    if (config.enabledTriggers)               this._enabledTriggers = new Set(config.enabledTriggers);

    this._bindHandlers();
    this._attachListeners();
    this._armTimeStall();
    this._armNoAction();
    return this;
  }

  /** Listen for a specific trigger name OR 'friction_detected' for all events. */
  on<K extends keyof EventMap>(event: K, cb: Listener<EventMap[K]>): this {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event)!.add(cb as Listener<FrictionEvent>);
    return this;
  }

  /** Remove a specific listener. */
  off<K extends keyof EventMap>(event: K, cb: Listener<EventMap[K]>): this {
    this._listeners.get(event)?.delete(cb as Listener<FrictionEvent>);
    return this;
  }

  enableTrigger(name: TriggerName): this {
    this._enabledTriggers.add(name);
    if (name === 'time_stall') this._armTimeStall();
    if (name === 'no_action' && !this._noActionFired) this._armNoAction();
    return this;
  }

  disableTrigger(name: TriggerName): this {
    this._enabledTriggers.delete(name);
    this._clearTimer(name);
    if (name === 'scroll_stall') this._clearTimer('scrollStall');
    return this;
  }

  /** Tear down all listeners and timers. */
  destroy(): this {
    this._detachListeners();
    (Object.keys(this._timers) as Array<keyof typeof this._timers>)
      .forEach(k => this._clearTimer(k));
    this._listeners.clear();
    return this;
  }

  // ── private ──────────────────────────────────────────────────────────────

  private _emit(trigger: TriggerName, extra: Record<string, unknown> = {}): void {
    if (!this._enabledTriggers.has(trigger)) return;
    if (this._firedInIdle.has(trigger)) return;          // dedupe per idle window

    this._firedInIdle.add(trigger);

    const event: FrictionEvent = {
      type: 'friction_detected',
      trigger,
      timestamp: Date.now(),
      metadata: {
        page_id: window.location.pathname,
        scroll_pct: this._maxScrollPct,
        session_id: this._sessionId,
        ...extra,
      },
    };

    this._dispatch('friction_detected', event);
    this._dispatch(trigger, event);
  }

  private _dispatch(channel: string, event: FrictionEvent): void {
    this._listeners.get(channel)?.forEach(fn => fn(event));
  }

  /** Called on any meaningful user activity — resets idle-window state. */
  private _resetIdle(): void {
    // Clear the per-idle fired set for repeatable triggers
    this._firedInIdle.delete('time_stall');
    this._firedInIdle.delete('scroll_stall');
    this._firedInIdle.delete('exit_intent');
    // no_action is NOT cleared here — it is page-lifetime only

    this._armTimeStall();

    // If no_action hasn't fired yet, restart its countdown too
    if (!this._noActionFired) this._armNoAction();
  }

  private _armTimeStall(): void {
    if (!this._enabledTriggers.has('time_stall')) return;
    this._clearTimer('time_stall');
    this._timers['time_stall'] = setTimeout(() => {
      this._emit('time_stall');
    }, this._timeStallMs);
  }

  private _armNoAction(): void {
    if (!this._enabledTriggers.has('no_action')) return;
    if (this._noActionFired) return;
    this._clearTimer('no_action');
    this._timers['no_action'] = setTimeout(() => {
      this._noActionFired = true;
      this._emit('no_action');
    }, this._noActionMs);
  }

  private _clearTimer(key: keyof typeof this._timers): void {
    if (this._timers[key] !== undefined) {
      clearTimeout(this._timers[key]);
      delete this._timers[key];
    }
  }

  // ── event handlers ───────────────────────────────────────────────────────

  private _bindHandlers(): void {
    this._onActivity = () => {
      this._resetIdle();
    };

    this._onMouseLeave = (e: MouseEvent) => {
      // Only fire when pointer exits the actual viewport
      const { clientX: x, clientY: y } = e;
      const { innerWidth: w, innerHeight: h } = window;
      if (x <= 0 || y <= 0 || x >= w || y >= h) {
        const edge = y <= 0 ? 'top' : y >= h ? 'bottom' : x <= 0 ? 'left' : 'right';
        this._emit('exit_intent', { exit_edge: edge });
      }
    };

    this._onScroll = () => {
      const pct = scrollDepthPct();
      if (pct > this._maxScrollPct) this._maxScrollPct = pct;

      // Scroll itself counts as activity for time_stall / no_action
      this._firedInIdle.delete('time_stall');
      this._firedInIdle.delete('scroll_stall');
      this._armTimeStall();
      if (!this._noActionFired) this._armNoAction();

      // Arm scroll_stall if depth threshold met
      if (
        this._enabledTriggers.has('scroll_stall') &&
        this._maxScrollPct >= this._scrollStallPct
      ) {
        this._clearTimer('scrollStall');
        this._timers['scrollStall'] = setTimeout(() => {
          this._emit('scroll_stall', { scroll_stall_depth: this._maxScrollPct });
        }, this._scrollStallIdleMs);
      }
    };
  }

  private _attachListeners(): void {
    if (this._attached) return;
    this._attached = true;
    const opts = { passive: true } as AddEventListenerOptions;
    (['mousemove', 'keydown', 'click', 'touchstart', 'pointerdown'] as const)
      .forEach(evt => document.addEventListener(evt, this._onActivity, opts));
    document.addEventListener('mouseleave', this._onMouseLeave);
    window.addEventListener('scroll', this._onScroll, opts);
  }

  private _detachListeners(): void {
    if (!this._attached) return;
    this._attached = false;
    (['mousemove', 'keydown', 'click', 'touchstart', 'pointerdown'] as const)
      .forEach(evt => document.removeEventListener(evt, this._onActivity));
    document.removeEventListener('mouseleave', this._onMouseLeave);
    window.removeEventListener('scroll', this._onScroll);
  }
}

// ─── singleton export (optional convenience) ─────────────────────────────────
export const frictionDetector = new FrictionDetector();

/* ─────────────────────────────────────────────────────────────────────────────
EXAMPLE USAGE
─────────────────────────────────────────────────────────────────────────────

import { FrictionDetector } from '@/lib/FrictionDetector';

const detector = new FrictionDetector();

detector.init({
  timeStallMs:       4_000,   // fire time_stall after 4 s of inactivity
  scrollStallPct:    40,      // arm scroll_stall once user scrolls past 40 %
  scrollStallIdleMs: 2_500,   // fire scroll_stall after 2.5 s of scroll-idle
  noActionMs:        8_000,   // fire no_action if nothing happens in first 8 s
  enabledTriggers: ['time_stall', 'exit_intent', 'scroll_stall', 'no_action'],
});

// listen to ALL friction events on a single handler
detector.on('friction_detected', (event) => {
  console.log('[friction]', event);
  // {
  //   type: 'friction_detected',
  //   trigger: 'time_stall',
  //   timestamp: 1710000000000,
  //   metadata: { page_id: '/dashboard', scroll_pct: 12, session_id: 's_abc123xyz' }
  // }

  // Route to your analytics / in-app nudge layer
  if (event.trigger === 'exit_intent') {
    showRetentionModal();
  }
  if (event.trigger === 'time_stall' || event.trigger === 'scroll_stall') {
    triggerHelpWidget(event.metadata);
  }
});

// or subscribe per trigger
detector.on('exit_intent', (event) => sendToAnalytics(event));

// dynamically toggle triggers
detector.disableTrigger('no_action');
detector.enableTrigger('no_action');

// cleanup (e.g. in React useEffect return / Vue onUnmounted)
// detector.destroy();
───────────────────────────────────────────────────────────────────────────── */
