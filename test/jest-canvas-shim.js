// Minimal canvas shim for tests to provide basic 2D APIs and toDataURL
(function globalCanvasShim() {
  if (typeof window === 'undefined' || typeof HTMLCanvasElement === 'undefined') return;

  // Ensure canvas has a functional toDataURL so exportVideo doesn't throw
  if (!HTMLCanvasElement.prototype.toDataURL) {
    HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,FAKE'; };
  }

  // Ensure getContext returns a basic 2D context with a few methods used in code
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type) {
    try {
      const res = orig ? orig.call(this, type) : null;
      if (res && typeof res.fillRect === 'function' && typeof res.getImageData === 'function') return res;
    } catch (e) { /* ignore */ }

    if (type === '2d') {
      return {
        fillRect: () => {},
        clearRect: () => {},
        drawImage: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
        putImageData: () => {},
      };
    }
    return null;
  };
})();