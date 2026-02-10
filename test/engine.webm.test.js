import { describe, it, expect, beforeEach } from 'vitest';
import VisualEngine from '../src/core/Engine.js';
import WebMMuxer from '../src/utils/webmMuxer.js';

describe('VisualEngine WebM export integration', () => {
  let engine;
  beforeEach(() => { engine = new VisualEngine(); engine._W = 128; engine._H = 96; });

  it('accepts a muxer and returns a Blob when using mockOutput', async () => {
    const mux = new WebMMuxer({ width: 128, height: 96, fps: 30, mockOutput: true });
    const blob = await engine.exportVideo(3, { muxer: mux });
    // Blob or blob-like object (fallback shim) accepted
    expect(blob).toBeDefined();
    // Confirm muxer received frames
    expect(mux.frameCount()).toBe(3);
    // If it's a real Blob, verify text payload contains frame count
    if (typeof blob.text === 'function') {
      const t = await blob.text();
      expect(t).toContain('"frames":3');
    }
  });
});
