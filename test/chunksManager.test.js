import { describe, it, expect } from 'vitest';
import { downloadChunksAsJson } from '../src/utils/chunksManager.js';

describe('chunksManager', () => {
  it('downloadChunksAsJson returns true for valid input', () => {
    const ok = downloadChunksAsJson([{ timestamp: 0, type: 'key', data: '' }], 'test_chunks');
    expect(ok).toBe(true);
  });
});
