

const DEFAULTS = {
  threeUrl: 'https://unpkg.com/three@0.154.0/build/three.module.js',
  pixiUrl: 'https://cdn.jsdelivr.net/npm/pixi.js@7.2.0/dist/browser/pixi.mjs',
  mojsUrl: 'https://cdn.jsdelivr.net/npm/@mojs/core/dist/mojs.esm.js',
  esModuleShims: 'https://cdn.jsdelivr.net/npm/es-module-shims@1.8.1/dist/es-module-shims.min.js'
};

export default class CodeExporter {
  constructor(opts = {}) {
    this.opts = Object.assign({}, DEFAULTS, opts);
  }

  generate({ type = 'iife', params = {} } = {}) {
    const loader = this._loaderSnippet();
    if (type === 'react') return this._reactTemplate(loader, params);
    if (type === 'webcomponent') return this._webComponentTemplate(loader, params);
    return this._iifeTemplate(loader, params);
  }

  _loaderSnippet() {
    // returns a loader function string that ensures libs are available on window
    const { threeUrl, pixiUrl, mojsUrl, esModuleShims } = this.opts;
    return `
async function ensureLib(url, globalName) {
  if (window[globalName]) return window[globalName];
  try {
    const m = await import(url);
    window[globalName] = m.default || m;
    return window[globalName];
  } catch (err) {
    // try importShim (es-module-shims)
    if (window.importShim) {
      const m = await window.importShim(url);
      window[globalName] = m.default || m;
      return window[globalName];
    }
    // load es-module-shims, then use importShim
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = '${esModuleShims}'; s.async = true;
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
    if (!window.importShim) throw new Error('es-module-shims failed to provide importShim');
    const m = await window.importShim(url);
    window[globalName] = m.default || m;
    return window[globalName];
  }
}

async function ensureAll() {
  const THREE = await ensureLib('${threeUrl}', 'THREE');
  const PIXI = await ensureLib('${pixiUrl}', 'PIXI');
  const mojs = await ensureLib('${mojsUrl}', 'mojs');
  return { THREE, PIXI, mojs };
}
`;
  }

  _iifeTemplate(loader, params = {}) {
    const presets = JSON.stringify(params || {});
    return `/* VISUEFECT SNIPPET (IIFE) — generated */
(function(){
  ${loader}

  const PRESET = ${presets};

  (async function init(){
    const { THREE, PIXI, mojs } = await ensureAll();

    // create container
    const container = document.querySelector('#visuefect-export-root') || (function(){ const d=document.createElement('div'); d.id='visuefect-export-root'; document.body.appendChild(d); return d; })();
    container.style.position = 'relative'; container.style.width = PRESET.width || '100%'; container.style.height = PRESET.height || '100%';

    // canvases
    const threeCanvas = document.createElement('canvas'); threeCanvas.id='three-canvas'; threeCanvas.style.position='absolute'; threeCanvas.style.inset='0'; container.appendChild(threeCanvas);
    const pixiCanvas = document.createElement('canvas'); pixiCanvas.id='pixi-canvas'; pixiCanvas.style.position='absolute'; pixiCanvas.style.inset='0'; container.appendChild(pixiCanvas);
    const mojsOverlay = document.createElement('div'); mojsOverlay.id='mojs-overlay'; mojsOverlay.style.position='absolute'; mojsOverlay.style.inset='0'; container.appendChild(mojsOverlay);

    // THREE minimal init
    const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000); cam.position.set(0,0,3);

    const geo = new THREE.TorusKnotGeometry(0.7,0.22,128,24);
    const mat = new THREE.MeshStandardMaterial({ color: PRESET.color || 0x00f0ff, emissive: PRESET.emissive || 0x001820 });
    const mesh = new THREE.Mesh(geo, mat); scene.add(mesh);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x080820, 0.9));

    // PIXI minimal init
    let app;
    try {
      app = new PIXI.Application();
      if (typeof app.init === 'function') {
        app.init({ view: pixiCanvas, backgroundAlpha: 0, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
      }
    } catch (e) {
      app = new PIXI.Application({ view: pixiCanvas, backgroundAlpha: 0, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
    }
    app.stage.sortableChildren = true;

    // mojs example
    const burst = new mojs.Burst({ parent: mojsOverlay, left:0, top:0, radius:{0:90}, count:16, children:{ shape:'line', stroke: PRESET.mojsColor || '#00f0ff' } });

    function resize(){
      const rect = container.getBoundingClientRect(); const W=Math.max(1,Math.floor(rect.width)); const H=Math.max(1,Math.floor(rect.height));
      renderer.setSize(W,H,false); cam.aspect=W/H; cam.updateProjectionMatrix(); app.renderer.resize(W,H);
    }
    new ResizeObserver(resize).observe(container); resize();

    // loop
    let last=performance.now(); function loop(now){ requestAnimationFrame(loop); const dt = now-last; last=now; mesh.rotation.y += 0.001*dt; renderer.render(scene, cam); app.render(); }
    loop(last);

    // export util (composite and mediarecorder)
    async function exportToVideo(duration=5,fps=30){
      const rect = container.getBoundingClientRect(); const W=rect.width; const H=rect.height; const off=document.createElement('canvas'); off.width=W; off.height=H; const ctx=off.getContext('2d');
      const stream=off.captureStream(fps); const rec=[]; const mr=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'}); mr.ondataavailable = e => { if(e.data && e.data.size) rec.push(e.data); } ; mr.start(); const start = performance.now();
      await new Promise((resolve)=>{ function tick(){ ctx.clearRect(0,0,W,H); try{ ctx.drawImage(threeCanvas,0,0,W,H);}catch(e){} try{ ctx.drawImage(pixiCanvas,0,0,W,H);}catch(e){} if(performance.now()-start < duration*1000) requestAnimationFrame(tick); else setTimeout(resolve,200); } tick(); }); mr.stop();
      return await new Promise((resolve)=>{ mr.onstop = () => { const blob = new Blob(rec,{type:'video/webm'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='visuefect.webm'; a.click(); URL.revokeObjectURL(url); resolve(blob); }; });
    }

    // attach export util to root for consumer
    container.__visuefect_export = { exportToVideo };
  })().catch(e=>{ try { globalThis.logger?.error ? globalThis.logger.error('VISUEFECT export init failed', e) : console.error('VISUEFECT export init failed', e); } catch (er) { console.error('VISUEFECT export init failed', e); } });
})();`;
  }

  _reactTemplate(loader, params = {}) {
    const presets = JSON.stringify(params || {});
    return `/* VISUEFECT React Component — generated */
import React, { useRef, useEffect } from 'react';

${loader}

export default function VisuefectSnapshot(props) {
  const rootRef = useRef(null);
  const PRESET = Object.assign(${presets}, props);

  useEffect(()=>{
    let mounted = true;
    let cleanup;
    (async function(){
      const { THREE, PIXI, mojs } = await ensureAll();
      if (!mounted) return;

      const container = rootRef.current;
      container.style.position = 'relative'; container.style.width = PRESET.width || '100%'; container.style.height = PRESET.height || '100%';
      const threeCanvas = document.createElement('canvas'); threeCanvas.style.position='absolute'; threeCanvas.style.inset='0'; container.appendChild(threeCanvas);
      const pixiCanvas = document.createElement('canvas'); pixiCanvas.style.position='absolute'; pixiCanvas.style.inset='0'; container.appendChild(pixiCanvas);
      const mojsOverlay = document.createElement('div'); mojsOverlay.style.position='absolute'; mojsOverlay.style.inset='0'; container.appendChild(mojsOverlay);

      const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias:true, alpha:true }); renderer.setPixelRatio(window.devicePixelRatio||1);
      const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(60,1,0.1,1000); cam.position.set(0,0,3);
      const geo = new THREE.TorusKnotGeometry(0.7,0.22,128,24); const mat = new THREE.MeshStandardMaterial({ color: PRESET.color || 0x00f0ff }); const mesh = new THREE.Mesh(geo, mat); scene.add(mesh);
      let app;
    try {
      app = new PIXI.Application();
      if (typeof app.init === 'function') {
        app.init({ view: pixiCanvas, backgroundAlpha:0, antialias:true, resolution:window.devicePixelRatio||1, autoDensity:true });
      }
    } catch (e) {
      app = new PIXI.Application({ view: pixiCanvas, backgroundAlpha:0, antialias:true, resolution:window.devicePixelRatio||1, autoDensity:true });
    }
    app.stage.sortableChildren = true;

      const resize = ()=>{ const rect = container.getBoundingClientRect(); const W=Math.max(1,Math.floor(rect.width)); const H=Math.max(1,Math.floor(rect.height)); renderer.setSize(W,H,false); cam.aspect=W/H; cam.updateProjectionMatrix(); app.renderer.resize(W,H); } ; new ResizeObserver(resize).observe(container); resize();

      let last = performance.now(); let raf = true; function loop(now){ if(!raf) return; requestAnimationFrame(loop); const dt = now - last; last = now; mesh.rotation.y += 0.001*dt; renderer.render(scene, cam); app.render(); } loop(last);

      cleanup = ()=>{ raf = false; try{ app.destroy(true); }catch(e){} try{ renderer.dispose(); }catch(e){} container.innerHTML = ''; };
    })();

    return ()=>{ mounted=false; cleanup && cleanup(); };
  }, []);

  return React.createElement('div', { ref: rootRef, style: { width: '100%', height: '100%' } });
}
`;
  }

  _webComponentTemplate(loader, params = {}) {
    const presets = JSON.stringify(params || {});
    return `/* VISUEFECT Web Component — generated */
${loader}

(function(){
  const PRESET = ${presets};
  class VisuefectWidget extends HTMLElement {
    constructor(){ super(); this._root = this.attachShadow({ mode: 'open' }); }
    connectedCallback(){ this._init(); }
    async _init(){ const { THREE, PIXI, mojs } = await ensureAll();
      this._container = document.createElement('div'); this._container.style.position='relative'; this._container.style.width = PRESET.width || '100%'; this._container.style.height = PRESET.height || '100%'; this._root.appendChild(this._container);
      const threeCanvas = document.createElement('canvas'); threeCanvas.style.position='absolute'; threeCanvas.style.inset='0'; this._container.appendChild(threeCanvas);
      const pixiCanvas = document.createElement('canvas'); pixiCanvas.style.position='absolute'; pixiCanvas.style.inset='0'; this._container.appendChild(pixiCanvas);

      this._renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias:true, alpha:true }); this._renderer.setPixelRatio(window.devicePixelRatio||1);
      this._scene = new THREE.Scene(); this._cam = new THREE.PerspectiveCamera(60,1,0.1,1000); this._cam.position.set(0,0,3);
      const geo = new THREE.TorusKnotGeometry(0.7,0.22,128,24); const mat = new THREE.MeshStandardMaterial({ color: PRESET.color || 0x00f0ff }); const mesh = new THREE.Mesh(geo, mat); this._scene.add(mesh);

      let app;
      try {
        app = new PIXI.Application();
        if (typeof app.init === 'function') {
          app.init({ view: pixiCanvas, backgroundAlpha:0, antialias:true, resolution:window.devicePixelRatio||1, autoDensity:true });
        }
      } catch (e) {
        app = new PIXI.Application({ view: pixiCanvas, backgroundAlpha:0, antialias:true, resolution:window.devicePixelRatio||1, autoDensity:true });
      }
      this._pixi = app; this._pixi.stage.sortableChildren = true;

      const resize = ()=>{ const rect = this._container.getBoundingClientRect(); const W=Math.max(1,Math.floor(rect.width)); const H=Math.max(1,Math.floor(rect.height)); this._renderer.setSize(W,H,false); this._cam.aspect = W/H; this._cam.updateProjectionMatrix(); this._pixi.renderer.resize(W,H); }; new ResizeObserver(resize).observe(this._container); resize();

      // simple loop
      this._running = true; this._last = performance.now(); const step = (now)=>{ if(!this._running) return; requestAnimationFrame(step); const dt = now - this._last; this._last = now; this._scene.children[0].rotation.y += 0.001*dt; this._renderer.render(this._scene,this._cam); this._pixi.render(); }; requestAnimationFrame(step);
    }
    disconnectedCallback(){ this._running=false; try{ this._pixi.destroy(true); }catch(e){} try{ this._renderer.dispose(); }catch(e){} }
  }
  if (!customElements.get('visuefect-widget')) customElements.define('visuefect-widget', VisuefectWidget);
})();
`;
  }
}
