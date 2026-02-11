import { describe, it, beforeEach, expect } from 'vitest';
import VisualEngine from '../src/core/Engine.js';

describe('Engine Pixi Updater cleanup', () => {
  let eng;
  beforeEach(() => {
    eng = new VisualEngine({ three: '#three-canvas', pixi: '#pixi-canvas', mojs: '#mojs-overlay' });
    eng.resize();
  });

  it('adds and removes pixi updaters when effects are created/removed', () => {
    const before = (eng._pixiUpdaters && eng._pixiUpdaters.length) || 0;
    eng.addEffect('pixi', 1);
    expect((eng._createdEffects.pixi || []).length).toBeGreaterThan(0);
    const afterAdd = eng._pixiUpdaters.length;
    expect(afterAdd).toBeGreaterThanOrEqual(before + 1);
    eng.removeEffect('pixi', 1);
    const afterRemove = eng._pixiUpdaters.length;
    expect(afterRemove).toBeLessThanOrEqual(afterAdd - 1);
  });
});