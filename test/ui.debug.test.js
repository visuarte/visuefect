import {
  describe, it, beforeEach, expect,
} from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import Interface from '../src/ui/Interface.js';

describe('UI Debug Toggle', () => {
  let dom; let win; let doc; let I;
  beforeEach(() => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    win = dom.window; doc = win.document;
    global.window = win; global.document = doc; global.HTMLElement = win.HTMLElement; global.Event = win.Event;
    // ensure debug default is false
    win.__VISUEFECT = { debug: false };
    const engineStub = { viewport: doc.getElementById('viewport') };
    I = new Interface(engineStub);
  });

  it('renders debug toggle and toggles global flag', () => {
    const btn = document.getElementById('debug-toggle');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Off');
    // simulate click
    btn.click();
    expect(window.__VISUEFECT.debug).toBe(true);
    expect(btn.textContent).toContain('On');
    // toggle back
    btn.click();
    expect(window.__VISUEFECT.debug).toBe(false);
    expect(btn.textContent).toContain('Off');
  });

  it('Interface.setDebug updates global flag', () => {
    I.setDebug(true);
    expect(window.__VISUEFECT.debug).toBe(true);
    I.setDebug(false);
    expect(window.__VISUEFECT.debug).toBe(false);
  });
});
