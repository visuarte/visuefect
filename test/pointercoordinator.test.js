/** @vitest-environment jsdom */
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { PointerCoordinator } from '../src/core/PointerCoordinator.js';

function makeEngine() {
  return {
    renderer: {
      domElement: {
        getBoundingClientRect: () => ({
          left: 0, top: 0, width: 100, height: 100,
        }),
      },
    },
    camera: {},
    scene: { children: [] },
    // provide pixi mock shape
    pixiApp: { renderer: { plugins: { interaction: { hitTest: () => null } } }, stage: {} },
  };
}

describe('PointerCoordinator', () => {
  let engine;
  let pc;
  beforeEach(() => {
    engine = makeEngine();
    pc = new PointerCoordinator(engine);
  });

  it('returns null when clicking empty area', () => {
    const res = pc.getIntersections({ clientX: 10, clientY: 10 });
    expect(res).toBe(null);
  });

  it('returns pixi hit when interaction returns object', () => {
    const hit = { interactive: true, id: 'pixi' };
    engine.pixiApp.renderer.plugins.interaction.hitTest = () => hit;
    const res = pc.getIntersections({ clientX: 20, clientY: 20 });
    expect(res).toBeTruthy(); expect(res.layer).toBe('pixi'); expect(res.object).toBe(hit);
  });

  it('falls back to three when no pixi hit and raycaster intersects', () => {
    // stub raycaster to return synthetic intersects
    const fakeIntersect = [{ distance: 1, object: { id: 'mesh' } }];
    pc.raycaster.intersectObjects = () => fakeIntersect;
    const res = pc.getIntersections({ clientX: 30, clientY: 30 });
    expect(res).toBeTruthy(); expect(res.layer).toBe('three'); expect(res.object).toEqual(fakeIntersect[0]);
  });

  it('is defensive with zero-sized DOM rect', () => {
    engine.renderer.domElement.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 0, height: 0,
    });
    const res = pc.getIntersections({ clientX: 10, clientY: 10 });
    expect(res).toBe(null);
  });
});
