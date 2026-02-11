/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import VisualEngine from '../src/core/Engine.js';

describe('VisualEngine exportVideo', () => {
  let eng;
  let origGetContext;

  beforeEach(() => {
    eng = new VisualEngine();
    origGetContext = HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    // restore original canvas behavior
    try { HTMLCanvasElement.prototype.getContext = origGetContext; } catch (e) {}
    try { eng.destroy(); } catch (e) {}
  });

  it('does not throw when 2D context is unavailable and returns an array of frames', async () => {
    // Force getContext to fail to simulate a minimal headless canvas
    HTMLCanvasElement.prototype.getContext = function () { return null; };
    eng._W = 40; eng._H = 40;

    const frames = await eng.exportVideo(3);
    expect(Array.isArray(frames)).toBe(true);
    expect(frames.length).toBe(3);
  });
});