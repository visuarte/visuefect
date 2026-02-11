/**
 * SyncBridge — Master Clock & RAF replacement
 * - Replaces window.requestAnimationFrame / cancelAnimationFrame with a controlled queue
 * - Provides deterministic frame stepping, pause/resume and setFPS
 * - Hooks: onBeforeUpdate, onUpdate, onAfterUpdate
 * - Helpers to attach Pixi ticker so it receives consistent normalized delta
 *
 * Usage:
 * const bridge = new SyncBridge({ fps: 60 });
 * bridge.onUpdate((dt, t) => { /* dt in ms, t in ms *\/ });
 * bridge.start();
 * // For deterministic export: await bridge.renderFrames(300, () => captureFrame());
 */

import logger from '../utils/logger.js';

export class SyncBridge {
  constructor({ fps = 60, autoStart = false } = {}) {
    this.setFPS(fps);

    // virtual clock (ms)
    this._time = 0;
    this._frame = 0;

    // running / paused
    this._running = false;
    this._paused = true;

    // hooks
    this._before = new Set();
    this._update = new Set();
    this._after = new Set();

    // RAF queue (polyfill)
    this._rafQueue = new Map();
    this._reqId = 1;

    // Save originals
    this._origRAF = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : null;
    this._origCancel = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : null;

    // Patch RAF/CANCEL
    const self = this;
    window.requestAnimationFrame = function (cb) {
      const id = self._reqId++;
      self._rafQueue.set(id, cb);
      return id;
    };
    window.cancelAnimationFrame = function (id) { self._rafQueue.delete(id); };

    // Pixi attachments
    this._pixiAttached = null; // { app, use60Baseline }

    if (autoStart) this.start();
  }

  // ------------ Clock & FPS ------------
  setFPS(fps) {
    const parsed = Number(fps);
    this.fps = (Number.isFinite(parsed) && parsed > 0) ? Math.max(1, parsed) : 1;
    this._frameMs = 1000 / this.fps;
  }

  get time() { return this._time; } // ms

  get frame() { return this._frame; }

  get frameDuration() { return this._frameMs; } // ms

  // ------------ Hook registration ------------
  onBeforeUpdate(fn) { this._before.add(fn); return () => this._before.delete(fn); }

  onUpdate(fn) { this._update.add(fn); return () => this._update.delete(fn); }

  onAfterUpdate(fn) { this._after.add(fn); return () => this._after.delete(fn); }

  // ------------ Loop control ------------
  start() {
    if (this._running) return;
    this._running = true;
    this._paused = false;
    // align virtual time with performance.now() offset if starting fresh
    this._lastReal = performance.now();
    this._tick();
  }

  stop() {
    this._running = false;
    this._paused = true;
  }

  pause() { this._paused = true; }

  resume() { if (!this._running) this.start(); this._paused = false; }

  // Advance a single frame (or n frames) deterministically
  step(frames = 1) { for (let i = 0; i < frames; i++) this._renderFrame(); }

  // Render many frames synchronously (useful for export): calls onBefore/onUpdate/onAfter per frame
  async renderFrames(count, optsOrCb = {}) {
    // Accept either a function (onProgress) or an options object { onProgress }
    const onProgress = typeof optsOrCb === 'function' ? optsOrCb : (optsOrCb && optsOrCb.onProgress) || null;
    for (let i = 0; i < count; i++) {
      this._renderFrame();
      if (onProgress) {
        // allow async handler (e.g., to composite & capture)
        await Promise.resolve(onProgress(i + 1));
      }
    }
  }

  // ------------ Internal frame rendering ------------
  _renderFrame() {
    // advance virtual clock by fixed frame duration
    this._time += this._frameMs;
    this._frame += 1;
    const dt = this._frameMs; // ms

    // before hooks
    for (const fn of Array.from(this._before)) {
      try { fn(dt, this._time); } catch (e) { /* log via logger to make tests deterministic */ }
    }

    // invoke RAF callbacks registered by libraries (one-shot semantics)
    if (this._rafQueue.size > 0) {
      const queue = Array.from(this._rafQueue.entries());
      // clear queue first to emulate rAF semantics (callbacks may queue new rAF)
      this._rafQueue.clear();
      for (const [, cb] of queue) {
        try { cb(this._time); } catch (e) { logger.error('raf callback error', e); }
      }
    }

    // update hooks
    for (const fn of Array.from(this._update)) {
      try { fn(dt, this._time); } catch (e) { logger.error('SyncBridge update hook error', e); }
    }

    // If Pixi attached, update its ticker with normalized delta relative to 60fps baseline
    if (this._pixiAttached) {
      const { app } = this._pixiAttached;
      // normalized delta as in PIXI: delta = dt / (1000 / 60)
      const normalizedDelta = dt / (1000 / 60);
      try { app.ticker.update(normalizedDelta); } catch (e) { logger.error('Pixi update error', e); }
    }

    // after hooks
    for (const fn of Array.from(this._after)) {
      try { fn(dt, this._time); } catch (e) { try { logger.error('SyncBridge after hook error', e); } catch (err) { /* best-effort */ } }
    }
  }

  // Main tick loop (drives frames in real-time mode)
  _tick() {
    if (!this._running) return;

    if (!this._paused) {
      // In real-time mode we attempt to advance by the number of frames that corresponds to elapsed real time
      const now = performance.now();
      const elapsed = now - (this._lastReal || now);
      this._lastReal = now;

      // determine how many frames should pass to catch up
      let framesToAdvance = Math.max(1, Math.round(elapsed / this._frameMs));

      // cap to avoid spiral of death
      framesToAdvance = Math.min(framesToAdvance, 8);

      for (let i = 0; i < framesToAdvance; i++) this._renderFrame();
    }

    // schedule next tick — use setTimeout to have control and avoid busy-loop; small delay to yield
    if (this._running) setTimeout(() => this._tick(), 0);
  }

  // ------------ Pixi integration helper ------------
  attachPixi(app, { autoStopTicker = true } = {}) {
    if (!app || !app.ticker) throw new Error('attachPixi requires a PIXI.Application instance');
    if (autoStopTicker) app.ticker.stop();
    this._pixiAttached = { app };
    // option: register an update hook that ensures app.render is called after ticker update
    // but we keep rendering calls to the host engine; apps normally render automatically by ticker
    return () => {
      if (autoStopTicker) app.ticker.start();
      this._pixiAttached = null;
    };
  }

  // ---------- Compatibility helpers ----------
  /**
   * Backwards compatible `subscribe(eventName, fn)`
   * eventName: 'onBeforeUpdate' | 'onUpdate' | 'onAfterUpdate'
   */
  subscribe(eventName, fn) {
    if (eventName === 'onBeforeUpdate') return this.onBeforeUpdate(fn);
    if (eventName === 'onUpdate') return this.onUpdate(fn);
    if (eventName === 'onAfterUpdate') return this.onAfterUpdate(fn);
    throw new Error(`Unknown event ${eventName}`);
  }

  /** Return normalized delta relative to 60fps baseline (useful for Pixi) */
  getNormalizedDelta() {
    return this._frameMs / (1000 / 60);
  }

  get currentTime() { return this._time; }

  // ------------ Utilities ------------
  // get current virtual time in ms
  now() { return this._time; }

  // restore original requestAnimationFrame/cancelAnimationFrame
  restoreNativeRAF() {
    try {
      window.requestAnimationFrame = this._origRAF;
      window.cancelAnimationFrame = this._origCancel;
    } catch (e) { try { logger.warn('Could not restore native RAF', e); } catch (err) { /* best-effort */ } }
  }

  destroy() {
    this.stop();
    this.restoreNativeRAF();
    this._before.clear(); this._update.clear(); this._after.clear(); this._rafQueue.clear();
  }
}

// also export default for compatibility
export default SyncBridge;
