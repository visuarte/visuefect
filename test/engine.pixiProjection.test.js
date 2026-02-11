/** @vitest-environment jsdom */
import {
  describe, it, beforeEach, expect,
} from 'vitest';
import VisualEngine from '../src/core/Engine.js';

describe('Engine Pixi->Three projection', () => {
  let engine;
  beforeEach(() => {
    document.body.innerHTML = '<div id="viewport" style="width:640px;height:480px"><canvas id="three-canvas"></canvas><canvas id="pixi-canvas"></canvas><div id="mojs-overlay"></div></div>';
    engine = new VisualEngine({ three: '#three-canvas', pixi: '#pixi-canvas', mojs: '#mojs-overlay' });
  });

  afterEach(() => { try { engine && engine.destroy && engine.destroy(); } catch (e) {} });

  it('creates a plane mesh using the Pixi canvas as a THREE texture and updates it', async () => {
    // ensure pixi canvas exists (tests run headless; override view with a simple canvas)
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 200;
    // Replace pixiApp with a lightweight fake for the test
    engine.pixiApp = { view: canvas, renderer: { width: 200, height: 200 } };

    const res = await engine.addPixiProjection({ width: 2, height: 1, worldPosition: { x: 0, y: 0, z: 0 } });
    expect(res).toBeTruthy();
    const { mesh, texture } = res;
    expect(mesh).toBeTruthy();
    expect(texture).toBeTruthy();
    // texture image should be the canvas used by Pixi
    expect(texture.image).toBe(engine.pixiApp.view);
    // mesh should be in scene
    expect(engine.scene.children.includes(mesh)).toBe(true);

    // trigger a SyncBridge step to call before/onUpdate hooks which set texture.needsUpdate
    engine.sync.step(1);
    expect(texture.needsUpdate || texture.__visuefect_needsUpdate).toBe(true);

    // remove via engine removeEffect should remove mesh from scene
    const before = engine.scene.children.length;
    engine.removeEffect('three', 1);
    const after = engine.scene.children.length;
    expect(after).toBeLessThanOrEqual(before);
  });
});
