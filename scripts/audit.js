#!/usr/bin/env node
// Deep audit script: creates a headless DOM, instantiates engine, runs a set of operations and reports issues.
import { JSDOM } from 'jsdom';

(async function(){
  const dom = new JSDOM(`<!doctype html><html><body><div id="viewport"><canvas id="three-canvas"></canvas><canvas id="pixi-canvas"></canvas><div id="mojs-overlay"></div></div></body></html>`, { pretendToBeVisual: true });
  // setup headless globals BEFORE loading project code to avoid UMD/browser-shim runtime failures
  global.window = dom.window; global.self = dom.window; global.globalThis = dom.window; global.this = dom.window; global.document = dom.window.document; 
  try { Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true }); } catch (e) { /* some Node versions have navigator as getter-only */ }
  // explicit signal: use Node mock for mojs in headless audits/tests (preferred to skipping)
  process.env.MOJS_MOCK = '1';
  process.env.SKIP_MOJS = '1'; // keep backward-compatibility
  // If requested, pre-load the Node mock into the DOM window so any top-level
  // references or lazy factories find it immediately.
  if (process.env.MOJS_MOCK === '1') {
    try {
      const mod = await import('../src/mocks/mojs-node-mock.js').catch(() => null);
      const mock = mod ? (mod.default || mod) : null;
      if (mock && global.window) global.window.mojs = mock;
    } catch (e) { /* ignore */ }
  }
  try {
    const { default: VisualEngine } = await import('../src/core/Engine.js');
    const engine = new VisualEngine({ three:'#three-canvas', pixi:'#pixi-canvas', mojs:'#mojs-overlay' });
    engine.sync.start();
    engine.resize();
    // simulated operations
    engine.addEffect('pixi', 3);
    engine.addEffect('mojs', 2);
    engine.addEffect('three', 1);

    engine.removeEffect('pixi', 1);
    const audit = engine.audit();
    console.log('AUDIT RESULTS:', JSON.stringify(audit, null, 2));

    // logical checks
    const issues = [];
    if (audit.createdCounts.pixi !== engine._createdEffects.pixi.length) issues.push('pixi counts mismatch');
    if (audit.createdCounts.mojs !== engine._createdEffects.mojs.length) issues.push('mojs counts mismatch');
    if (audit.createdCounts.three !== engine._createdEffects.three.length) issues.push('three counts mismatch');
    if (audit.errors && audit.errors.length) issues.push('errors logged: ' + audit.errors.length);

    if (issues.length) {
      console.error('AUDIT ISSUES FOUND:');
      issues.forEach(i => console.error('- ' + i));
      process.exitCode = 2;
    } else {
      console.log('Audit passed — no issues detected.');
    }
    engine.destroy();
  } catch (e) {
    console.error('Audit failed with exception:', e);
    process.exitCode = 3;
  }
})();