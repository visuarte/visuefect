/** @vitest-environment jsdom */
import {
  describe, it, beforeEach, expect, vi,
} from 'vitest';
import VisualEngine from '../src/core/Engine.js';

class MockAnalyser {
  constructor(size = 128) { this.fftSize = size; this._samples = new Float32Array(size); }

  setSamples(arr) { this._samples.set(arr); }

  getFloatTimeDomainData(out) { out.set(this._samples.subarray(0, out.length)); }
}

describe('Audio reactivity integration', () => {
  let engine; let
    analyser;
  beforeEach(() => {
    document.body.innerHTML = '<div id="viewport" style="width:640px;height:480px"><canvas id="three-canvas"></canvas><canvas id="pixi-canvas"></canvas><div id="mojs-overlay"></div></div>';
    engine = new VisualEngine({ three: '#three-canvas', pixi: '#pixi-canvas', mojs: '#mojs-overlay' });
    analyser = new MockAnalyser(64);
  });

  afterEach(() => { try { engine && engine.destroy && engine.destroy(); } catch (e) {} });

  it('detects a beat and calls addMojsBurst', async () => {
    const spy = vi.spyOn(engine, 'addMojsBurst');
    const conn = await engine.attachAudioReactivity({ analyser, threshold: 0.05, minIntervalMS: 1 });
    // silence
    analyser.setSamples(new Float32Array(64).fill(0));
    engine.sync.step(1);
    expect(spy).not.toHaveBeenCalled();

    // spike
    const spike = new Float32Array(64).fill(0);
    spike[10] = 0.6;
    analyser.setSamples(spike);
    engine.sync.step(1);
    expect(spy).toHaveBeenCalled();

    conn.disconnect();
    spy.mockRestore();
  });

  it('onBeat callback is invoked with rms and time', async () => {
    const cb = vi.fn();
    const conn = await engine.attachAudioReactivity({
      analyser, threshold: 0.05, minIntervalMS: 1, onBeat: cb,
    });
    const spike = new Float32Array(64).fill(0);
    spike[5] = 0.9;
    analyser.setSamples(spike);
    engine.sync.step(1);
    expect(cb).toHaveBeenCalled();
    const arg = cb.mock.calls[0][0];
    expect(arg).toHaveProperty('rms');
    expect(arg).toHaveProperty('time');
    conn.disconnect();
  });
});
