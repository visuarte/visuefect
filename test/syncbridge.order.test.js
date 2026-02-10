/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import SyncBridge from '../src/core/SyncBridge.js';

describe('SyncBridge ordering', () => {
  it('calls onBeforeUpdate before onUpdate during a step', () => {
    const b = new SyncBridge();
    const seq = [];
    b.onBeforeUpdate(() => seq.push('before'));
    b.onUpdate(() => seq.push('update'));
    b.step(1);
    expect(seq[0]).toBe('before');
    expect(seq[1]).toBe('update');
  });
});
