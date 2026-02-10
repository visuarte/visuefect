import * as PIXI from 'pixi.js';

/**
 * PixiParticles(engine, opts)
 * - spawns particles that follow the pointer
 * - uses engine.pixiApp and engine.addPixiUpdater
 */
export default function PixiParticles(engine, opts = {}) {
  const cfg = Object.assign({ color: 0xffffff, spawnRadius: 6, maxParticles: 300 }, opts);
  const root = new PIXI.Container();
  engine.pixiRoot.addChild(root);

  const particles = [];

  function spawn(x, y) {
    const g = new PIXI.Graphics();
    const r = cfg.spawnRadius * (0.6 + Math.random() * 1.4);
    // Use new Pixi v8 API: fill() + circle() instead of deprecated beginFill/drawCircle/endFill
    try { g.fill({ color: cfg.color, alpha: 1 }); g.circle(0, 0, r); } catch (e) { /* fallback for older pixi */ g.beginFill(cfg.color, 1); g.drawCircle(0, 0, r); g.endFill(); }
    g.x = x; g.y = y;
    g.vx = (Math.random() - 0.5) * 2;
    g.vy = (Math.random() - 0.5) * 2 - 0.6;
    g.life = 80 + Math.floor(Math.random() * 60);
    g.alpha = 1;
    g.scale.set(0.8 + Math.random() * 0.6);
    root.addChild(g);
    particles.push(g);

    // cap
    if (particles.length > cfg.maxParticles) {
      const old = particles.shift();
      try { root.removeChild(old); } catch (e) {}
    }
  }

  // pointer tracking
  let lastPointer = { x: 0, y: 0 };
  function onPointerMove(e) {
    const rect = engine.viewport.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lastPointer.x = x; lastPointer.y = y;
    // spawn a few particles along the movement
    for (let i = 0; i < 2; i++) spawn(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8);
  }

  engine.viewport.addEventListener('pointermove', onPointerMove);

  // updater
  function updater(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += 0.03; // gravity
      // slight attraction to lastPointer to create "follow" feeling
      const ax = (lastPointer.x - p.x) * 0.002;
      const ay = (lastPointer.y - p.y) * 0.002;
      p.vx += ax; p.vy += ay;
      p.x += p.vx * dt * 0.06; p.y += p.vy * dt * 0.06;
      p.life -= Math.max(1, dt * 0.06);
      p.alpha = Math.max(0, p.life / 120);
      p.scale.x = p.scale.y = Math.max(0.2, p.life / 140);
      const rendererHeight = (engine.pixiApp && engine.pixiApp.renderer && typeof engine.pixiApp.renderer.height === 'number') ? engine.pixiApp.renderer.height : (engine._H || 600);
      if (p.life <= 0 || p.y > rendererHeight + 30) {
        root.removeChild(p);
        particles.splice(i, 1);
      }
    }
  }

  if (typeof engine.addPixiUpdater === 'function') engine.addPixiUpdater(updater); else { if (!engine._pixiUpdaters) engine._pixiUpdaters = []; engine._pixiUpdaters.push(updater); }

  return {
    spawnAt(x, y) { spawn(x, y); },
    config: cfg,
    destroy() {
      // remove listener
      engine.viewport.removeEventListener('pointermove', onPointerMove);
      // remove updater
      if (engine._pixiUpdaters) engine._pixiUpdaters = engine._pixiUpdaters.filter(f => f !== updater);
      try { engine.pixiRoot.removeChild(root); root.destroy({ children: true }); } catch (e) {}
    }
  };
}
