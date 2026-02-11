/** @vitest-environment jsdom */
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import Interface from '../src/ui/Interface.js';
import * as Presets from '../src/utils/presets.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="viewport" style="width:640px;height:480px"><canvas id="three-canvas"></canvas><canvas id="pixi-canvas"></canvas><div id="mojs-overlay"></div></div><div class="card" style="display:flex;gap:8px;flex-wrap:wrap"></div>';
  localStorage.clear();
});

afterEach(() => { localStorage.clear(); });

test('can create and spawn a custom preset via interface click', () => {
  const engine = { viewport: document.querySelector('#viewport'), addCustomEffect: vi.fn() };
  const preset = { id: 'preset-test', name: 'Test', layer: 'particle', color: '#ff00aa', intensity: 30, count: 12 };
  Presets.savePreset(preset);

  const ui = new Interface(engine);
  // ensure presets rendered
  const btn = Array.from(document.querySelectorAll('[data-preset]')).find(b => b.getAttribute('data-drag-item') === 'preset-test');
  expect(btn).toBeTruthy();

  // click should spawn with engine.addCustomEffect called
  btn.click();
  expect(engine.addCustomEffect).toHaveBeenCalled();
  const calledWith = engine.addCustomEffect.mock.calls[0][0];
  expect(calledWith.name).toBe('Test');
});