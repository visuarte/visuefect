import {
  describe, it, beforeEach, expect, vi,
} from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import Interface from '../src/ui/Interface.js';
import DragSystem from '../src/ui/DragSystem.js';

// Small mock engine used to spy on actions
const makeEngineStub = () => ({
  addThreeMesh: vi.fn(),
  addPixiEmitter: vi.fn(),
  addMojsBurst: vi.fn(),
  viewport: null,
});

function createDataTransferMock() {
  const store = {};
  return {
    types: [],
    setData(type, val) { store[type] = String(val); if (!this.types.includes(type)) this.types.push(type); },
    getData(type) { return store[type] || ''; },
    files: [],
  };
}

describe('Interface + DragSystem integration', () => {
  let dom; let win; let doc; let engine;
  beforeEach(() => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    win = dom.window; doc = win.document;
    // ensure global document/window point to JSDOM for modules that use global document
    global.window = win; global.document = doc; global.HTMLElement = win.HTMLElement; global.Event = win.Event; global.DragEvent = win.DragEvent;
    engine = makeEngineStub();
    engine.viewport = doc.getElementById('viewport');
  });

  it('Interface attaches step button listeners and goToStep works', () => {
    const I = new Interface(engine);
    const btn = doc.querySelector('.step-btn[data-step="2"]');
    expect(btn).toBeTruthy();
    // simulate click
    btn.click();
    expect(I.currentStep).toBe(2);
  });

  it('dragging a sidebar item sets dataTransfer and drop triggers engine methods', () => {
    const I = new Interface(engine);
    const dragBtn = doc.querySelector('[data-drag-item="particle"]');
    expect(dragBtn).toBeTruthy();

    // simulate dragstart
    const dt = createDataTransferMock();
    const dragstartEvent = new win.Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragstartEvent, 'dataTransfer', { value: dt });

    dragBtn.dispatchEvent(dragstartEvent);
    // ensure the data was set by the handler (application/json normalized + legacy keys)
    const j = dt.getData('application/json');
    expect(j).toBeTruthy();
    const parsed = JSON.parse(j);
    expect(parsed.type).toBe('particle');
    expect(dt.getData('item-type')).toBe('particle');
    expect(dt.getData('item')).toBe('particle');

    // simulate drop onto viewport
    const dropEvent = new win.Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dt });
    // position data
    dropEvent.clientX = 120; dropEvent.clientY = 60;

    const viewport = doc.getElementById('viewport');
    viewport.dispatchEvent(dropEvent);

    // Interface.handleDrop should call engine.addPixiEmitter for type 'particle'
    expect(engine.addPixiEmitter).toHaveBeenCalled();
  });

  it('DragSystem handles JSON payload drops for fx', async () => {
    const pixiParticles = { spawnAt: vi.fn(), pixiRoot: doc.createElement('div') };
    const mojsEffects = { trigger: vi.fn() };
    const ds = new DragSystem(engine, { pixiParticles, mojsEffects });
    ds.init();

    const dt = createDataTransferMock();
    dt.setData('text/plain', JSON.stringify({ type: 'fx', item: 'lines' }));

    const dropEvent = new win.Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dt });
    dropEvent.clientX = 20; dropEvent.clientY = 30;

    const viewport = doc.getElementById('viewport');
    viewport.dispatchEvent(dropEvent);

    // expecting mojsEffects.trigger called
    expect(mojsEffects.trigger).toHaveBeenCalledWith('lines', 20, 30);
  });
});
