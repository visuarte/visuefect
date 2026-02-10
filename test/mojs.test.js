/** @vitest-environment jsdom */
import { describe, it, beforeEach, expect } from 'vitest';
import VisualEngine from '../src/core/Engine.js';
import MojsEffects from '../src/components/MojsEffects.js';

describe('MojsEffects integration', () => {
  let engine, mojs;
  beforeEach(() => {
    document.body.innerHTML = '<div id="viewport"><canvas id="three-canvas"></canvas><canvas id="pixi-canvas"></canvas><div id="mojs-overlay"></div></div>';
    engine = new VisualEngine({ three:'#three-canvas', pixi:'#pixi-canvas', mojs:'#mojs-overlay' });
    mojs = MojsEffects(engine);
  });

  it('trigger creates and registers burst effects', () => {
    const before = (engine.mojsItems||[]).length;
    mojs.trigger('lines', 100, 100);
    const after = (engine.mojsItems||[]).length;
    expect(after).toBeGreaterThan(before);
  });
});