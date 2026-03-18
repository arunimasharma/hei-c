/**
 * FrictionDetector SDK  v1.0.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Detects low-traffic, high-signal friction events on a web page and emits
 * structured trigger events so the frontend can react instantly (e.g. by
 * showing a feedback prompt).
 *
 * Triggers:
 *   time_stall   – user idle on page > timeStallMs  (default 10 s)
 *   exit_intent  – mouse moves toward top of viewport on desktop
 *   scroll_stall – user scrolls past scrollDepthPercent % then idles
 *                  for > scrollStallMs  (default 40 % / 5 s)
 *   no_action    – page load with zero interaction after noActionMs (default 10 s)
 *
 * Privacy: no PII, no cookies, anonymous session ID only.
 * Size:    < 5 KB minified.
 * Deps:    none.
 *
 * Usage:
 *   const detector = new FrictionDetector();
 *   detector.init({ timeStallMs: 8000 });
 *   detector.on('friction_detected', (event) => console.log(event));
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function (root, factory) {
  /* UMD wrapper – works as a <script> tag, CommonJS require(), or ES import */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();                  // CommonJS / Node
  } else if (typeof define === 'function' && define.amd) {
    define(factory);                             // AMD / RequireJS
  } else {
    root.FrictionDetector = factory();           // browser global
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  'use strict';

  // ── constants ──────────────────────────────────────────────────────────────

  /** Default configuration values */
  var DEFAULTS = {
    timeStallMs:         10000,   // ms idle before time_stall fires
    scrollDepthPercent:  40,      // % scroll depth that arms scroll_stall
    scrollStallMs:       5000,    // ms scroll-idle before scroll_stall fires
    noActionMs:          10000,   // ms after load with no activity → no_action
    exitIntentTopPx:     20,      // px from top of viewport that triggers exit_intent
  };

  // ── tiny helpers ───────────────────────────────────────────────────────────

  /**
   * Generate an anonymous session ID.
   * Format: "s_<8 random chars><timestamp base-36>"
   * No PII: purely random + time-based, not tied to any user.
   */
  function makeSessionId() {
    return 's_' +
      Math.random().toString(36).slice(2, 10) +
      Date.now().toString(36);
  }

  /**
   * Calculate how far down the page the user has scrolled as a percentage
   * of the scrollable area (0–100).
   */
  function getScrollPct() {
    var el = document.documentElement;
    var scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 0) return 0;
    return Math.min(100, Math.round((window.scrollY / scrollable) * 100));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FrictionDetector class
  // ─────────────────────────────────────────────────────────────────────────

  function FrictionDetector() {
    // ── public config (overridden by init()) ──────────────────────────────
    this._cfg = Object.assign({}, DEFAULTS);

    // ── event listeners registered via .on() ─────────────────────────────
    // Shape: { 'friction_detected': [fn, fn, ...], 'time_stall': [...], ... }
    this._handlers = {};

    // ── which triggers are currently active ──────────────────────────────
    // All four enabled by default.
    this._enabled = {
      time_stall:   true,
      exit_intent:  true,
      scroll_stall: true,
      no_action:    true,
    };

    // ── internal state ────────────────────────────────────────────────────

    /** Anonymous ID reused for the lifetime of this detector instance */
    this._sessionId = makeSessionId();

    /**
     * Set of triggers that have already fired in the current idle window.
     * Cleared when the user becomes active again, preventing duplicate events
     * within a single idle period.
     * Exception: no_action is page-lifetime (never cleared once fired).
     */
    this._firedInIdle = {};

    /** no_action only fires once per page load */
    this._noActionDone = false;

    /** Highest scroll % reached since page load */
    this._maxScrollPct = 0;

    /** Pending setTimeout handles, keyed by trigger name */
    this._timers = {};

    /** Bound handler references kept for removeEventListener */
    this._bound = {};

    /** Whether attachListeners() has been called */
    this._listening = false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * init(config?)
   * Configure thresholds and start detection.
   * Call once after construction (or call again to reconfigure).
   *
   * @param {object} config - optional overrides for DEFAULTS
   * @returns {FrictionDetector} this (chainable)
   */
  FrictionDetector.prototype.init = function (config) {
    // Merge caller config over defaults; ignore unknown keys
    if (config && typeof config === 'object') {
      var allowed = Object.keys(DEFAULTS).concat(['enabledTriggers']);
      for (var i = 0; i < allowed.length; i++) {
        var k = allowed[i];
        if (config[k] !== undefined) this._cfg[k] = config[k];
      }
      // Shorthand: pass an array of trigger names to enable only those
      if (Array.isArray(config.enabledTriggers)) {
        var all = Object.keys(this._enabled);
        for (var j = 0; j < all.length; j++) {
          this._enabled[all[j]] = config.enabledTriggers.indexOf(all[j]) !== -1;
        }
      }
    }

    this._attachListeners();
    this._armTimeStall();
    this._armNoAction();
    return this;
  };

  /**
   * on(eventName, callback)
   * Register a listener for a named event.
   *
   * eventName can be:
   *   'friction_detected'  – fires for every trigger
   *   'time_stall'         – fires only for that trigger
   *   'exit_intent'        – fires only for that trigger
   *   'scroll_stall'       – fires only for that trigger
   *   'no_action'          – fires only for that trigger
   *
   * @param {string}   eventName
   * @param {function} callback  – receives a FrictionEvent object
   * @returns {FrictionDetector} this (chainable)
   */
  FrictionDetector.prototype.on = function (eventName, callback) {
    if (typeof callback !== 'function') return this;
    if (!this._handlers[eventName]) this._handlers[eventName] = [];
    this._handlers[eventName].push(callback);
    return this;
  };

  /**
   * off(eventName, callback)
   * Remove a previously registered listener.
   *
   * @param {string}   eventName
   * @param {function} callback  – must be the exact same function reference
   * @returns {FrictionDetector} this (chainable)
   */
  FrictionDetector.prototype.off = function (eventName, callback) {
    var list = this._handlers[eventName];
    if (!list) return this;
    this._handlers[eventName] = list.filter(function (fn) { return fn !== callback; });
    return this;
  };

  /**
   * enableTrigger(name) / disableTrigger(name)
   * Dynamically turn a specific trigger on or off at runtime.
   *
   * @param {string} name – one of 'time_stall' | 'exit_intent' | 'scroll_stall' | 'no_action'
   * @returns {FrictionDetector} this (chainable)
   */
  FrictionDetector.prototype.enableTrigger = function (name) {
    this._enabled[name] = true;
    if (name === 'time_stall') this._armTimeStall();
    if (name === 'no_action' && !this._noActionDone) this._armNoAction();
    return this;
  };

  FrictionDetector.prototype.disableTrigger = function (name) {
    this._enabled[name] = false;
    this._clearTimer(name);
    if (name === 'scroll_stall') this._clearTimer('_scroll_stall_inner');
    return this;
  };

  /**
   * destroy()
   * Remove all DOM listeners and cancel pending timers.
   * Call this when tearing down the page/component.
   *
   * @returns {FrictionDetector} this (chainable)
   */
  FrictionDetector.prototype.destroy = function () {
    this._detachListeners();
    var keys = Object.keys(this._timers);
    for (var i = 0; i < keys.length; i++) clearTimeout(this._timers[keys[i]]);
    this._timers = {};
    return this;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: event emission
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * _emit(triggerName, extraMetadata?)
   * Build a standardised FrictionEvent, log it, and dispatch to all listeners.
   *
   * Skips emission if:
   *   – trigger is disabled
   *   – trigger already fired in current idle window (_firedInIdle debounce)
   */
  FrictionDetector.prototype._emit = function (trigger, extra) {
    if (!this._enabled[trigger]) return;
    if (this._firedInIdle[trigger]) return;  // debounce: once per idle window

    // Mark as fired for this idle window
    this._firedInIdle[trigger] = true;

    var event = {
      type:      'friction_detected',
      trigger:   trigger,
      timestamp: Date.now(),
      metadata: Object.assign(
        {
          page_id:     window.location.pathname,
          scroll_pct:  this._maxScrollPct,
          session_id:  this._sessionId,   // anonymous — no PII
        },
        extra || {}
      ),
    };

    // Console log for debugging / easy wiring
    console.log(
      '[FrictionDetector] I detected "' + trigger + '" trigger event for feedback gathering',
      event
    );

    // Dispatch to all 'friction_detected' listeners first
    this._dispatch('friction_detected', event);
    // Then dispatch to any trigger-specific listeners
    if (trigger !== 'friction_detected') this._dispatch(trigger, event);
  };

  /** Call every registered handler for channelName with data */
  FrictionDetector.prototype._dispatch = function (channelName, data) {
    var list = this._handlers[channelName];
    if (!list || !list.length) return;
    for (var i = 0; i < list.length; i++) {
      try { list[i](data); } catch (e) { /* isolate handler errors */ }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: idle / activity management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * _onActivity()
   * Called on every meaningful user interaction (mouse, key, touch, scroll).
   * Resets the idle window, clearing fired flags for repeatable triggers,
   * and restarts the time_stall countdown.
   */
  FrictionDetector.prototype._onActivity = function () {
    // Clear per-idle debounce for repeatable triggers
    // (exit_intent, time_stall, scroll_stall can fire again after re-engagement)
    delete this._firedInIdle['time_stall'];
    delete this._firedInIdle['exit_intent'];
    delete this._firedInIdle['scroll_stall'];
    // no_action is intentionally NOT cleared — it is a page-lifetime one-shot

    // Restart the stall countdown
    this._armTimeStall();

    // no_action: if it hasn't fired yet, restart its countdown too
    if (!this._noActionDone) this._armNoAction();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: timer arms
  // ─────────────────────────────────────────────────────────────────────────

  /** Start (or restart) the time_stall countdown */
  FrictionDetector.prototype._armTimeStall = function () {
    if (!this._enabled['time_stall']) return;
    var self = this;
    this._clearTimer('time_stall');
    this._timers['time_stall'] = setTimeout(function () {
      self._emit('time_stall');
    }, this._cfg.timeStallMs);
  };

  /** Start (or restart) the no_action countdown */
  FrictionDetector.prototype._armNoAction = function () {
    if (!this._enabled['no_action'] || this._noActionDone) return;
    var self = this;
    this._clearTimer('no_action');
    this._timers['no_action'] = setTimeout(function () {
      self._noActionDone = true;
      self._emit('no_action');
    }, this._cfg.noActionMs);
  };

  /** Clear a named pending timer */
  FrictionDetector.prototype._clearTimer = function (key) {
    if (this._timers[key] !== undefined) {
      clearTimeout(this._timers[key]);
      delete this._timers[key];
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Internal: DOM event handlers
  // ─────────────────────────────────────────────────────────────────────────

  FrictionDetector.prototype._attachListeners = function () {
    if (this._listening) return;
    this._listening = true;

    var self = this;

    // ── activity reset events ──────────────────────────────────────────────
    // Any of these counts as "user is active" → reset idle window
    this._bound.activity = function () { self._onActivity(); };
    var activityEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'pointerdown'];
    for (var i = 0; i < activityEvents.length; i++) {
      document.addEventListener(activityEvents[i], this._bound.activity, { passive: true });
    }

    // ── exit_intent ────────────────────────────────────────────────────────
    // Fires when the mouse cursor leaves the viewport through the top edge.
    // Classic "about to close tab or navigate away" signal on desktop.
    this._bound.mouseLeave = function (e) {
      // Guard: only top/sides — not natural bottom-scroll blur
      if (
        self._enabled['exit_intent'] &&
        (e.clientY <= self._cfg.exitIntentTopPx ||
         e.clientX <= 0 ||
         e.clientX >= window.innerWidth)
      ) {
        var edge = e.clientY <= self._cfg.exitIntentTopPx ? 'top'
                 : e.clientX <= 0                         ? 'left'
                 :                                          'right';
        self._emit('exit_intent', { exit_edge: edge });
      }
    };
    document.addEventListener('mouseleave', this._bound.mouseLeave);

    // ── scroll_stall ───────────────────────────────────────────────────────
    // Arms a stall timer once the user has scrolled past the depth threshold.
    // Each new scroll resets the timer; if they stop scrolling for scrollStallMs
    // after passing the threshold, the event fires.
    this._bound.scroll = function () {
      var pct = getScrollPct();
      if (pct > self._maxScrollPct) self._maxScrollPct = pct;

      // Scrolling is activity → reset idle timers
      delete self._firedInIdle['time_stall'];
      delete self._firedInIdle['scroll_stall'];
      self._armTimeStall();
      if (!self._noActionDone) self._armNoAction();

      // Arm scroll_stall only after depth threshold is crossed
      if (
        self._enabled['scroll_stall'] &&
        self._maxScrollPct >= self._cfg.scrollDepthPercent
      ) {
        self._clearTimer('_scroll_stall_inner');
        self._timers['_scroll_stall_inner'] = setTimeout(function () {
          self._emit('scroll_stall', { scroll_depth: self._maxScrollPct });
        }, self._cfg.scrollStallMs);
      }
    };
    window.addEventListener('scroll', this._bound.scroll, { passive: true });
  };

  FrictionDetector.prototype._detachListeners = function () {
    if (!this._listening) return;
    this._listening = false;

    var activityEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'pointerdown'];
    for (var i = 0; i < activityEvents.length; i++) {
      document.removeEventListener(activityEvents[i], this._bound.activity);
    }
    document.removeEventListener('mouseleave', this._bound.mouseLeave);
    window.removeEventListener('scroll', this._bound.scroll);
  };

  // ─────────────────────────────────────────────────────────────────────────

  return FrictionDetector;

})); // end UMD
