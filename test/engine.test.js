/** @vitest-environment jsdom */
import {
  beforeEach, afterEach, describe, it, expect, vi,
} from 'vitest';
import mojs from '@mojs/core';
import VisualEngine from '../src/core/Engine.js';

// Mock mojs to avoid DOM heavy internals
vi.mock('@mojs/core', () => ({
  default: {
    Burst: class {
      constructor(opts) { this.opts = opts; this.el = document.createElement('div'); }

      play() { this._played = true; }

      stop() { this._played = false; }
    },
    Tween: { update: () => {} },
    reducers: { update: () => {} },
  },
}));

describe('VisualEngine basic effects API', () => {
  let engine;

  beforeEach(() => {
    // minimal DOM
    document.body.innerHTML = '<div id="viewport"><canvas id="three-canvas"></canvas><canvas id="pixi-canvas"></canvas><div id="mojs-overlay"></div></div>';
    // expose the mocked mojs on window so engine Mojs calls will find it synchronously
    window.mojs = mojs.default || mojs;
    engine = new VisualEngine({ three: '#three-canvas', pixi: '#pixi-canvas', mojs: '#mojs-overlay' });
  });

  afterEach(() => {
    try { engine.destroy(); } catch (e) {}
    document.body.innerHTML = '';
  });

  it('should initialize and resize without throwing', () => {
    const res = engine.resize();
    expect(res.W).toBeGreaterThan(0);
    expect(res.H).toBeGreaterThan(0);
  });

  it('addEffect pixi increments counts and creates child', () => {
    const before = engine.audit().createdCounts.pixi;
    engine.addEffect('pixi', 1);
    const after = engine.audit().createdCounts.pixi;
    expect(after).toBe(before + 1);
    expect(engine.pixiRoot.children.length).toBeGreaterThan(0);
  });

  it('removeEffect pixi decrements counts and removes child', () => {
    engine.addEffect('pixi', 2);
    const before = engine.audit().createdCounts.pixi;
    engine.removeEffect('pixi', 1);
    const after = engine.audit().createdCounts.pixi;
    expect(after).toBe(before - 1);
  });

  it('resetEffects clears all types', () => {
    engine.addEffect('pixi', 1);
    engine.addEffect('mojs', 1);
    engine.addEffect('three', 1);
    const pre = engine.audit();
    expect(pre.createdCounts.pixi).toBeGreaterThanOrEqual(1);
    expect(pre.createdCounts.mojs).toBeGreaterThanOrEqual(1);
    expect(pre.createdCounts.three).toBeGreaterThanOrEqual(1);

    engine.resetEffects();
    const post = engine.audit();
    expect(post.createdCounts.pixi).toBe(0);
    expect(post.createdCounts.mojs).toBe(0);
    // three children includes camera, so ensure our created list is empty
    expect(engine._createdEffects.three.length).toBe(0);
  });

  it('audit returns errorLog array and structure', () => {
    const a = engine.audit();
    expect(a).toHaveProperty('errors');
    expect(Array.isArray(a.errors)).toBe(true);
  });
});
