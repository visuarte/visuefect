// Vitest setup: try to load jest-canvas-mock, fallback to minimal shims if not installed
(async () => {
  try {
    const _m = 'jest-canvas-mock';
    // Some modules assume a `jest` global at import-time (designed for Jest). Stub it briefly so
    // `jest-canvas-mock` can initialize without throwing in Vitest environment.
    const hadJest = typeof globalThis.jest !== 'undefined';
    if (!hadJest) globalThis.jest = {};
    await import(_m);
    if (!hadJest) delete globalThis.jest;
  } catch (e) {
    // missing or incompatible dependency: provide minimal 2D context fallback and warn
    // eslint-disable-next-line no-console
    console.warn('jest-canvas-mock not installed or failed to initialize; using minimal canvas shims');
    if (!HTMLCanvasElement.prototype.getContext) {
      HTMLCanvasElement.prototype.getContext = function (type) {
        if (type === '2d') {
          // minimal 2d stub
          return {
            fillRect: () => {},
            clearRect: () => {},
            getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
            putImageData: () => {},
            createImageData: () => [],
            setTransform: () => {},
            drawImage: () => {},
            measureText: () => ({ width: 0 }),
            canvas: this
          };
        }
        // Minimal WebGL-like stub
        return {
          drawingBufferWidth: this.width || 0,
          drawingBufferHeight: this.height || 0,
          getExtension: () => null,
          createTexture: () => ({}),
          bindTexture: () => {},
          texImage2D: () => {},
          texParameteri: () => {},
          viewport: () => {},
          clear: () => {},
          clearColor: () => {},
          enable: () => {},
          disable: () => {},
          createBuffer: () => ({}),
          bindBuffer: () => {},
          bufferData: () => {},
          useProgram: () => {},
          createProgram: () => ({}),
          createShader: () => ({}),
          shaderSource: () => {},
          compileShader: () => {},
          getShaderParameter: () => true,
          createFramebuffer: () => ({}),
          bindFramebuffer: () => {},
          framebufferTexture2D: () => {},
        };
      };
    }
  }

  // Also import existing test setup (mojs mock etc.)
  try { await import('./test/setup.js'); } catch (e) { /* ignore */ }
})();
