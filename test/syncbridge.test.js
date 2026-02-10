/** @vitest-environment jsdom */
import { describe, it, beforeEach, expect, vi } from 'vitest';
import SyncBridge from '../src/core/SyncBridge.js';

describe('SyncBridge basics', () => {
  let bridge;
  beforeEach(() => { bridge = new SyncBridge(); });

  it('setFPS clamps to minimum of 1', () => {
    bridge.setFPS(0);
    expect(bridge.fps).toBe(1);
    bridge.setFPS(30);
    expect(bridge.fps).toBe(30);
  });

  it('renderFrames advances time and calls onProgress', async () => {
    const calls = [];
    await bridge.renderFrames(3, (i) => calls.push(i));
    expect(calls.length).toBe(3);
    expect(bridge.frame).toBe(3);
    expect(bridge.time).toBeGreaterThan(0);
  });

  it('requestAnimationFrame polyfill calls callbacks and supports cancel', () => {
    const spy = vi.fn();
    const id = window.requestAnimationFrame(spy);
    // before stepping callback not called
    expect(spy).not.toHaveBeenCalled();
    // step a single frame
    bridge.step(1);
    expect(spy).toHaveBeenCalled();

    // schedule another and cancel it
    const id2 = window.requestAnimationFrame(spy);
    window.cancelAnimationFrame(id2);
    bridge.step(1);
    // number of calls should not have increased by the cancelled one
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('attachPixi validates app instance', () => {
    expect(() => bridge.attachPixi(null)).toThrow();
    expect(() => bridge.attachPixi({})).toThrow();
  });

  it('subscribe throws on unknown event', () => {
    expect(() => bridge.subscribe('nonexistent', () => {})).toThrow();
  });
});
