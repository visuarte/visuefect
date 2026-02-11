// Simple audio reactivity helper
// Usage: const conn = connectAudioToSync(sync, analyser, callback, { threshold, minIntervalMS })
// returns { disconnect() }
export function connectAudioToSync(sync, analyser, cb, opts = {}) {
  if (!sync || !analyser || typeof cb !== 'function') throw new Error('connectAudioToSync requires sync, analyser and callback');
  const { threshold = 0.06, minIntervalMS = 150 } = opts;
  const buf = new Float32Array(analyser.fftSize || 1024);
  let lastHit = 0;

  const handler = (_dt) => {
    try {
      if (typeof analyser.getFloatTimeDomainData === 'function') {
        analyser.getFloatTimeDomainData(buf);
      } else if (typeof analyser.getFloatFrequencyData === 'function') {
        analyser.getFloatFrequencyData(buf);
      } else if (typeof analyser.getByteTimeDomainData === 'function') {
        // de-quantize byte data into -1..1
        // allocate a byte buffer view
        const byteBuf = new Uint8Array(buf.length);
        analyser.getByteTimeDomainData(byteBuf);
        for (let i = 0; i < buf.length; i++) buf[i] = (byteBuf[i] - 128) / 128;
      } else {
        return;
      }
      // RMS energy
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = buf[i] || 0; sum += v * v; }
      const rms = Math.sqrt(sum / buf.length);
      const now = sync.currentTime || Date.now();
      if (rms > threshold && (now - lastHit) > minIntervalMS) {
        lastHit = now;
        try { cb({ rms, time: now }); } catch (e) {}
      }
    } catch (e) {
      // ignore, do not throw in realtime
    }
  };

  // subscribe to sync (onUpdate recommended for timed sampling)
  const unsub = sync.onUpdate(handler);
  return { disconnect: unsub };
}
