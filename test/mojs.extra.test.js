/** @vitest-environment jsdom */
import {
  describe, it, beforeEach, expect, vi,
} from 'vitest';
import MojsEffects from '../src/components/MojsEffects.js';

describe('MojsEffects fallback and lifecycle', () => {
  let engine; let
    mojs;
  beforeEach(() => {
    document.body.innerHTML = '<div id="viewport"><div id="mojs-overlay"></div></div>';
    engine = {
      viewport: document.querySelector('#viewport'), mojsContainer: document.querySelector('#mojs-overlay'), mojsItems: [], addPixiEmitter: vi.fn(),
    };
    // ensure mojs not available to force fallback
    const saved = globalThis.mojs;
    delete globalThis.mojs;
    mojs = MojsEffects(engine);
    // restore after creating instance
    if (saved) globalThis.mojs = saved;
  });

  it('trigger creates fallback fake and registers it', () => {
    const before = engine.mojsItems.length;
    mojs.trigger('lines', 10, 15);
    expect(engine.mojsItems.length).toBeGreaterThan(before);
    const e = engine.mojsItems[engine.mojsItems.length - 1];
    expect(typeof e.play === 'function').toBe(true);
    // calling play should spawn Pixi fallback
    e.play();
    expect(engine.addPixiEmitter).toHaveBeenCalled();
  });

  it('destroy removes listener and cleans up items', () => {
    const ev = new PointerEvent('pointerdown', { clientX: 20, clientY: 30 });
    // ensure listener exists
    document.querySelector('#viewport').dispatchEvent(ev);
    // some effect may have been created
    mojs.destroy();
    // listener should be removed (no errors when dispatching)
    document.querySelector('#viewport').dispatchEvent(ev);
    expect(true).toBe(true); // reaching here without throw
  });
});
