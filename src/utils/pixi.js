import * as PIXI from 'pixi.js';

// Helper to create/init a PIXI.Application while supporting both constructor and newer Application.init API
export function createPixiApp(opts = {}) {
  // Prefer to call init when available to silence warnings in modern PIXI
  try {
    const app = new PIXI.Application();
    if (typeof app.init === 'function') {
      app.init(opts);
      return app;
    }
    return app;
  } catch (e) {
    // fallback to constructor with options
    return new PIXI.Application(opts);
  }
}
