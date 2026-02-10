/** @vitest-environment jsdom */
import { describe, it, beforeEach, expect } from 'vitest';
import VisualEngine from '../src/core/Engine.js';
import DragSystem from '../src/ui/DragSystem.js';
import PixiParticles from '../src/components/PixiParticles.js';
import MojsEffects from '../src/components/MojsEffects.js';

describe('DragSystem ghost previews', () => {
  let engine, drag, pixi, mojs;
  beforeEach(() => {
    document.body.innerHTML = '<div id="viewport" style="width:640px;height:480px"><canvas id="three-canvas"></canvas><canvas id="pixi-canvas"></canvas><div id="mojs-overlay"></div></div>';
    engine = new VisualEngine({ three:'#three-canvas', pixi:'#pixi-canvas', mojs:'#mojs-overlay' });
    pixi = PixiParticles(engine, {});
    mojs = MojsEffects(engine);
    drag = new DragSystem(engine, { pixiParticles: pixi, mojsEffects: mojs });
    drag.init();
  });

  it('creates a 2D ghost when ensuring ghost2D', () => {
    drag._ensureGhost2D();
    expect(drag._ghost2D).toBeTruthy();
    // Ghost may be added to the PixiParticles' root (a child of engine.pixiRoot)
    const direct = engine.pixiRoot.children.includes(drag._ghost2D);
    const nested = engine.pixiRoot.children.some(c => c.children && c.children.includes && c.children.includes(drag._ghost2D));
    expect(direct || nested || (engine.pixiApp && engine.pixiApp.stage && engine.pixiApp.stage.children.includes(drag._ghost2D))).toBe(true);
    drag._removeGhost();
  });

  it('creates a 3D ghost when ensuring ghost3D', () => {
    drag._ensureGhost3D();
    expect(drag._ghost3D).toBeTruthy();
    expect(engine.scene.children.includes(drag._ghost3D)).toBe(true);
    drag._removeGhost();
  });
});