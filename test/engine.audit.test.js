import {
  beforeEach, afterEach, describe, it, expect,
} from 'vitest';

import VisualEngine from '../src/core/Engine.js';

// ensure we can mutate env for mojs mock
const OLD_MOCK = process.env.MOJS_MOCK;

describe('Engine audits and regressions', () => {
  let engine;

  beforeEach(() => {
    // ensure a clean environment and create a fresh engine for each test
    process.env.MOJS_MOCK = '1';
    engine = new VisualEngine();
  });

  afterEach(() => {
    try { engine.destroy(); } catch (e) {}
    process.env.MOJS_MOCK = OLD_MOCK;
  });

  it('should load mojs when MOJS_MOCK=1 and set mojsLoaded & mojsControlled', async () => {
    await engine._maybeLoadMojs();
    expect(engine.mojsLoaded).toBe(true);
    // mock contains Tween.update so control should be available
    expect(engine.mojsControlled).toBe(true);
  });

  it('should remove processed mojs events after onBeforeUpdate', async () => {
    engine.mojsUseFallback = true;
    // schedule an event at next frame time
    const nextT = engine.sync.currentTime + engine.sync.frameDuration;
    engine._mojsEventLog = [{
      t: nextT, x: 0, y: 0, opts: {},
    }];
    // render one frame (will call onBeforeUpdate)
    await engine.sync.renderFrames(1);
    expect(engine._mojsEventLog.length).toBe(0);
  });

  it('addPixiProjection should register and remove its updater', async () => {
    const before = (engine._pixiUpdaters || []).length;
    const res = await engine.addPixiProjection({ width: 1, height: 1 });
    expect(res).toBeTruthy();
    const mid = (engine._pixiUpdaters || []).length;
    expect(mid).toBeGreaterThanOrEqual(before + 1);
    // call remove
    res.remove();
    const after = (engine._pixiUpdaters || []).length;
    expect(after).toBe(before);
  });

  it('removeEffect("mojs") should remove items from mojsItems', async () => {
    await engine._maybeLoadMojs();
    expect(engine.mojsLoaded).toBe(true);
    const rect = engine.viewport.getBoundingClientRect();
    const x = rect.width / 2; const y = rect.height / 2;
    const b = engine.addMojsBurst(x + rect.left, y + rect.top, {});
    expect(engine.mojsItems.length).toBeGreaterThan(0);
    engine.removeEffect('mojs', 1);
    // should have been removed
    expect(engine.mojsItems.length).toBe(0);
  });

  it('destroy should disconnect ResizeObserver if present', async () => {
    // inject a mock ResizeObserver before creating an engine to capture disconnect
    let disconnected = false;
    class MockRO {
      constructor(fn) { this.fn = fn; }

      observe() {}

      disconnect() { disconnected = true; }
    }
    global.ResizeObserver = MockRO;

    const tmp = new VisualEngine();
    expect(tmp._resizeObserver).toBeTruthy();
    tmp.destroy();
    expect(disconnected).toBe(true);

    // cleanup
    delete global.ResizeObserver;
  });
});
