/**
 * MojsEffects(engine, opts)
 * - Define 3 efectos tipo 'burst' y expone trigger(name,x,y)
 * - Se integra con engine.mojsContainer
 *
 * NOTE: avoid static top-level import of '@mojs/core' to keep headless tests/audits
 * resilient; effects are lazily created on-demand and will fallback to Pixi when
 * mojs is not available.
 */
export default function MojsEffects(engine, opts = {}) {
  const parent = engine.mojsContainer;

  function _absPos(clientX, clientY) {
    const rect = engine.viewport.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // Effect factories (lazy)
  function createLinesBurst() {
    const m = (typeof window !== 'undefined' && window.mojs) || null;
    if (m && m.Burst) {
      const b = new m.Burst({
        parent,
        left: 0, top: 0,
        radius: { 0: 120 },
        count: 18,
        children: {
          shape: 'line',
          stroke: 'rgba(0,240,255,0.95)',
          strokeWidth: { 6: 0 },
          duration: 700,
          angle: { 0: 360 },
          easing: 'cubic.out'
        }
      });
      if (engine && engine.mojsItems) engine.mojsItems.push(b);
      return b;
    }
    // fallback stub (simple object that registers into engine.mojsItems)
    const fake = { parent, play() { /* spawn a quick pixi fallback */ engine.addPixiEmitter(100,100); }, tune() { return this; }, replay() { return this; } };
    if (engine && engine.mojsItems) engine.mojsItems.push(fake);
    return fake;
  }

  function createStarBurst() {
    const m = (typeof window !== 'undefined' && window.mojs) || null;
    if (m && m.Burst) {
      const b = new m.Burst({
        parent,
        left: 0, top: 0,
        radius: { 0: 90 },
        count: 24,
        children: {
          shape: 'line',
          stroke: { 'rgba(255,0,160,0.95)': 'rgba(139,99,255,0.95)' },
          strokeWidth: { 4: 0 },
          duration: 850,
          angle: { 0: 260 },
          easing: 'quint.out'
        }
      });
      if (engine && engine.mojsItems) engine.mojsItems.push(b);
      return b;
    }
    const fake = { parent, play() { engine.addPixiEmitter(100,100); }, tune() { return this; }, replay() { return this; } };
    if (engine && engine.mojsItems) engine.mojsItems.push(fake);
    return fake;
  }

  function createRingLines() {
    const m = (typeof window !== 'undefined' && window.mojs) || null;
    if (m && m.Burst) {
      const b = new m.Burst({
        parent,
        left: 0, top: 0,
        radius: { 0: 150 },
        count: 32,
        children: {
          shape: 'line',
          stroke: '#8b63ff',
          strokeWidth: { 2: 0 },
          radius: { 8: 0 },
          duration: 900,
          easing: 'cubic.out'
        }
      });
      if (engine && engine.mojsItems) engine.mojsItems.push(b);
      return b;
    }
    const fake = { parent, play() { engine.addPixiEmitter(100,100); }, tune() { return this; }, replay() { return this; } };
    if (engine && engine.mojsItems) engine.mojsItems.push(fake);
    return fake;
  }

  const factories = {
    lines: createLinesBurst,
    star: createStarBurst,
    ring: createRingLines,
  };
  const effects = { lines: null, star: null, ring: null };

  // trigger by name (lazy create)
  function trigger(name, clientX, clientY) {
    if (!factories[name]) return;
    if (!effects[name]) effects[name] = factories[name]();
    const e = effects[name];
    if (!e) return;
    const pos = _absPos(clientX, clientY);
    // position via tune/play API when available
    try { e.tune && e.tune({ x: pos.x, y: pos.y }).replay && e.replay(); } catch (err) { /* ignore */ }
  }

  // listen to clicks on viewport to trigger a default effect
  function onPointerDown(ev) {
    trigger('lines', ev.clientX, ev.clientY);
  }
  engine.viewport.addEventListener('pointerdown', onPointerDown);

  return {
    trigger,
    effects,
    destroy() {
      engine.viewport.removeEventListener('pointerdown', onPointerDown);
      // unregister from engine list and try to stop animations
      try {
        Object.values(effects).forEach(e => {
          const idx = engine.mojsItems.indexOf(e);
          if (idx >= 0) engine.mojsItems.splice(idx, 1);
          try { e.stop && e.stop(); } catch (err) {}
        });
      } catch (err) {}
    }
  };
}
