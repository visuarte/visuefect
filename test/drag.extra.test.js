/** @vitest-environment jsdom */
import { describe, it, beforeEach, expect, vi } from 'vitest';
import DragSystem from '../src/ui/DragSystem.js';
import PixiParticles from '../src/components/PixiParticles.js';
import logger from '../src/utils/logger.js';

describe('DragSystem inference and drop handling', () => {
  let engine, drag, pixi;
  beforeEach(() => {
    document.body.innerHTML = '<div id="viewport" style="width:640px;height:480px"><canvas id="three-canvas"></canvas><canvas id="pixi-canvas"></canvas><div id="mojs-overlay"></div></div>';
    engine = { viewport: document.querySelector('#viewport'), scene: { add: vi.fn() }, camera: { }, pixiApp: null, pixiRoot: { addChild: vi.fn() }, pixiParticles: null };
    pixi = PixiParticles(engine, {});
    drag = new DragSystem(engine, { pixiParticles: pixi, mojsEffects: null });
  });

  it('infers three from gltf/obj files', () => {
    const fakeDT = { files: [{ name: 'model.gltf', type: 'model/gltf' }] };
    const r = drag._inferFromDataTransfer(fakeDT);
    expect(r.layer).toBe('three');
  });

  it('drops fx triggers mojsEffects when present', () => {
    const mojs = { trigger: vi.fn() };
    drag = new DragSystem(Object.assign({}, engine), { mojsEffects: mojs });
    const ev = { preventDefault: () => {}, clientX: 100, clientY: 120, dataTransfer: { getData: () => JSON.stringify({ item: 'lines', type: 'fx' }) } };
    drag._onDrop(ev);
    expect(mojs.trigger).toHaveBeenCalled();
  });

  it('unknown drop logs via logger', () => {
    const spy = vi.spyOn(logger, 'warn');
    const ev = { preventDefault: () => {}, clientX: 10, clientY: 10, dataTransfer: { getData: () => 'not-json' } };
    const d = new DragSystem(engine, {});
    d._onDrop(ev);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
