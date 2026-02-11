import { describe, it, expect } from 'vitest';
import WebMMuxer from '../src/utils/webmMuxer.js';

describe('WebMMuxer skeleton', () => {
  it('exports a constructor', () => {
    expect(typeof WebMMuxer).toBe('function');
  });

  it('accepts frames and tracks count', () => {
    const m = new WebMMuxer({ width: 640, height: 480, fps: 24 });
    expect(m.frameCount()).toBe(0);
    m.addFrame({ dummy: true });
    expect(m.frameCount()).toBe(1);
  });

  it('finalize rejects because implementation is a skeleton', async () => {
    const m = new WebMMuxer();
    m.addFrame({});
    await expect(m.finalize()).rejects.toThrow(/not implemented/i);
  });
});
