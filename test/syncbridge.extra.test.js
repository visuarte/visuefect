/** @vitest-environment jsdom */
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import SyncBridge from '../src/core/SyncBridge.js';

describe('SyncBridge extra', () => {
  let bridge;
  beforeEach(() => { bridge = new SyncBridge(); });

  it('restoreNativeRAF restores original functions', () => {
    const origRAF = bridge._origRAF;
    // override by constructing bridge (done). Now restore
    bridge.restoreNativeRAF();
    expect(window.requestAnimationFrame).toBe(origRAF);
  });

  it('attachPixi stops and starts ticker when requested', () => {
    const app = { ticker: { stop: vi.fn(), start: vi.fn() } };
    const undo = bridge.attachPixi(app, { autoStopTicker: true });
    expect(app.ticker.stop).toHaveBeenCalled();
    // undo should start
    undo();
    expect(app.ticker.start).toHaveBeenCalled();
  });
});
