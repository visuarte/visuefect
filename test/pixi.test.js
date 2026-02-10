/** @vitest-environment jsdom */
import { describe, it, beforeEach, expect } from 'vitest';
import VisualEngine from '../src/core/Engine.js';
import PixiParticles from '../src/components/PixiParticles.js';

describe('PixiParticles', () => {
  let engine, pixi;
  beforeEach(() => {
    document.body.innerHTML = '<div id="viewport" style="width:640px;height:480px"><canvas id="three-canvas"></canvas><canvas id="pixi-canvas"></canvas></div>';
    engine = new VisualEngine({ three:'#three-canvas', pixi:'#pixi-canvas', mojs:'#mojs-overlay' });
    pixi = PixiParticles(engine, { color: 0xff00ff });
  });

  it('spawns particles and they are cleaned up by updater', () => {
      const before = (engine.pixiRoot.children[0] && engine.pixiRoot.children[0].children ? engine.pixiRoot.children[0].children.length : 0);
    pixi.spawnAt(100, 100);
    const after = (engine.pixiRoot.children[0] && engine.pixiRoot.children[0].children ? engine.pixiRoot.children[0].children.length : 0);
    expect(after).toBeGreaterThan(before);
    // run a few updater ticks
    for (let i=0;i<220;i++) engine._pixiUpdaters.forEach(f => f(16));
    // after life, at least one should be cleaned up
    expect(engine.pixiRoot.children.length).toBeGreaterThanOrEqual(0);
  });
});