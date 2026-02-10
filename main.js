import VisualEngine from './src/core/Engine.js';
import { PointerCoordinator } from './src/core/PointerCoordinator.js';
import Interface from './src/ui/Interface.js';
import CodeExporter from './src/utils/CodeExporter.js';
import PixiParticles from './src/components/PixiParticles.js';
import MojsEffects from './src/components/MojsEffects.js';
import DragSystem from './src/ui/DragSystem.js';

async function main() {
  // create engine and start SyncBridge
  const engine = new VisualEngine({ three: '#three-canvas', pixi: '#pixi-canvas', mojs: '#mojs-overlay' });
  engine.resize();
  engine.sync.start();

  // pointer coordinator
  const pc = new PointerCoordinator(engine);
  const viewport = document.getElementById('viewport');
  viewport.addEventListener('pointerdown', (e) => {
    const hit = pc.getIntersections(e);
    if (hit) console.log('Pointer hit:', hit.layer, hit.object);
  });

  // instantiate layers/components
  const pixiParticles = PixiParticles(engine, { color: 0xffffff });
  const mojsEffects = MojsEffects(engine);

  // UI (simple stepper-based)
  const ui = new Interface(engine);

  // Drag system (ghost previews)
  const drag = new DragSystem(engine, { pixiParticles, mojsEffects });
  drag.init();

  // Code exporter hooks
  const genBtn = document.getElementById('generate-code');
  const out = document.getElementById('code-output');
  const copyBtn = document.getElementById('copy-code');
  const exportBtn = document.getElementById('export-video');

  if (genBtn && out) {
    genBtn.addEventListener('click', () => {
      const snapshot = {
        date: (new Date()).toISOString(),
        modules: ['three','pixi','mojs'],
        sceneInfo: { children: engine.scene.children.length }
      };
      const html = CodeExporter.generateBundle(snapshot);
      out.value = html;
    });
  }

  if (copyBtn && out) copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(out.value); copyBtn.textContent = 'Copiado'; setTimeout(()=>copyBtn.textContent='Copiar',1200); } catch (e) { console.warn('Copy failed', e); }
  });

  // Quick diagnostic: ensure drag item buttons are enabled and provide click-to-spawn fallback
  function checkDragButtons() {
    const items = document.querySelectorAll('[data-drag-item]');
    items.forEach(btn => {
      // ensure draggable
      if (!btn.hasAttribute('draggable')) btn.setAttribute('draggable', 'true');
      // provide click fallback: spawn directly
      if (!btn.__visuefect_click) {
        btn.addEventListener('click', (e) => {
          const type = btn.getAttribute('data-drag-type');
          const item = btn.getAttribute('data-drag-item');
          const rect = engine.viewport.getBoundingClientRect();
          const cx = rect.width / 2; const cy = rect.height / 2;
          if (type === 'particle' && engine.addPixiEmitter) engine.addPixiEmitter(cx, cy, { color: 0xffffff });
          if (type === 'fx' && engine.addMojsBurst) engine.addMojsBurst(cx, cy, { stroke: '#ff00a0' });
          if (type === 'three' && engine.addThreeMesh) engine.addThreeMesh({ color: 0x00f0ff });
        });
        btn.__visuefect_click = true;
      }
    });
    console.log('Drag buttons checked:', items.length);

    // setup force preview button
    const fp = document.getElementById('force-preview');
    if (fp && !fp.__visuefect_bound) {
      fp.addEventListener('click', () => {
        try {
          const rect = engine.viewport.getBoundingClientRect(); const cx = rect.width/2; const cy = rect.height/2;
          // spawn test elements
          try { engine.addMojsBurst && engine.addMojsBurst(cx, cy, { stroke: '#00f0ff', count: 18 }); } catch (e) { console.warn('mojs burst failed', e); }
          try { engine.addPixiEmitter && engine.addPixiEmitter(cx, cy, { color: 0xffffff }); } catch (e) { console.warn('pixi emitter failed', e); }
          try { engine.addThreeMesh && engine.addThreeMesh({ color: 0x00f0ff }); } catch (e) { console.warn('three mesh failed', e); }
          // quick visual ghost tests
          _showTemporaryGhost(cx, cy);
          console.log('Force preview executed');
        } catch (err) { console.error('Force preview failed', err); showErrorToast(err && err.message ? err.message : String(err)); }
      });
      fp.__visuefect_bound = true;
    }
  }

  function _showTemporaryGhost(cx, cy) {
    // pixi ghost
    try {
      const g = new PIXI.Graphics(); g.beginFill(0x00f0ff, 0.12); g.drawCircle(0,0,48); g.endFill(); g.x = cx; g.y = cy; g.alpha = 0.95; g.blendMode = PIXI.BLEND_MODES.ADD; engine.pixiRoot.addChild(g);
      setTimeout(()=>{ try{ g.parent && g.parent.removeChild(g); g.destroy?.(); } catch(e){} }, 1200);
    } catch (e) {}
    // three ghost
    try {
      const geo = new THREE.BoxGeometry(0.8,0.8,0.8); const mat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.12 }); const m = new THREE.Mesh(geo, mat); m.position.set(0,0,0); engine.scene.add(m);
      setTimeout(()=>{ try{ engine.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } catch(e){} }, 1200);
    } catch (e) {}
  }
  // run diagnostic after small delay to ensure DOM ready
  setTimeout(checkDragButtons, 400);

  // Counts UI and controls for add/remove/reset
  function updateCountsUI() {
    try {
      const a = engine.audit();
      document.getElementById('pixi-count').textContent = a.createdCounts.pixi || 0;
      document.getElementById('mojs-count').textContent = a.createdCounts.mojs || 0;
      document.getElementById('three-count').textContent = a.createdCounts.three || 0;
    } catch (e) {}
  }

  setTimeout(updateCountsUI, 600);

  const mapBtn = (id, fn) => { const el = document.getElementById(id); if (!el) return; el.addEventListener('click', async () => { try { await fn(); updateCountsUI(); } catch (e) { console.error('Control action failed', e); showErrorToast(e && e.message ? e.message : String(e)); } }); };

  mapBtn('add-pixi', () => engine.addEffect('pixi', 1));
  mapBtn('sub-pixi', () => engine.removeEffect('pixi', 1));
  mapBtn('reset-pixi', () => { engine.resetEffects('pixi'); updateCountsUI(); });

  mapBtn('add-mojs', () => engine.addEffect('mojs', 1));
  mapBtn('sub-mojs', () => engine.removeEffect('mojs', 1));
  mapBtn('reset-mojs', () => { engine.resetEffects('mojs'); updateCountsUI(); });

  mapBtn('add-three', () => engine.addEffect('three', 1));
  mapBtn('sub-three', () => engine.removeEffect('three', 1));
  mapBtn('reset-three', () => { engine.resetEffects('three'); updateCountsUI(); });

  // refresh counts periodically in case things are added programmatically
  setInterval(updateCountsUI, 1500);

  // Deterministic export using SyncBridge (POC) — will try WebCodecs fallback to MediaRecorder
  async function exportVideoDeterministic(durationSeconds = 5, fps = 60) {
    // helper: on export, make sure the app falls back if mojs can't be driven
    const showStatus = (msg, timeout = 1200) => { const el = document.getElementById('fps'); if (el) { const old = el.textContent; el.textContent = msg; if (timeout) setTimeout(()=>el.textContent = old, timeout); } };
    const threeCanvas = document.getElementById('three-canvas');
    const pixiCanvas = document.getElementById('pixi-canvas');
    const mojsCanvas = document.querySelector('#mojs-overlay canvas');
    const rect = engine.viewport.getBoundingClientRect();
    const W = Math.max(1, Math.floor(rect.width));
    const H = Math.max(1, Math.floor(rect.height));

    let off, ctx;
    if (typeof OffscreenCanvas !== 'undefined') {
      off = new OffscreenCanvas(W, H);
      ctx = off.getContext('2d');
    } else {
      off = document.createElement('canvas'); off.width = W; off.height = H; ctx = off.getContext('2d');
    }

    const frameCount = Math.floor(durationSeconds * fps);

    // Prefer WebCodecs when available (POC) but fallback to MediaRecorder captureStream
    if (window.VideoEncoder && window.VideoFrame) {
      console.log('Using WebCodecs POC for encoding');
      const chunks = [];
      const encoder = new VideoEncoder({
        output: (chunk) => chunks.push(chunk),
        error: (e) => console.error('VideoEncoder error', e)
      });
      encoder.configure({ codec: 'vp8', width: W, height: H });

      const frameMs = 1000 / fps;
      // enable mojs fallback if mojs cannot be controlled deterministically
      engine.enableMojsFallback(!engine.mojsControlled);
      await engine.sync.renderFrames(frameCount, async (i) => {
        ctx.clearRect(0,0,W,H);
        try { const bm = await createImageBitmap(threeCanvas); ctx.drawImage(bm,0,0,W,H); bm.close(); } catch (e) {}
        try { const bm2 = await createImageBitmap(pixiCanvas); ctx.drawImage(bm2,0,0,W,H); bm2.close(); } catch (e) {}
        if (mojsCanvas) try { const bm3 = await createImageBitmap(mojsCanvas); ctx.drawImage(bm3,0,0,W,H); bm3.close(); } catch (e) {}

        const bitmap = await createImageBitmap(off);
        const ts = Math.floor(i * frameMs * 1000);
        const vf = new VideoFrame(bitmap, { timestamp: ts });
        encoder.encode(vf, { keyFrame: i % Math.round(fps/2) === 0 });
        vf.close(); bitmap.close();
      });
      engine.enableMojsFallback(false);

      await encoder.flush(); encoder.close();
      // Note: chunks need muxing into a playable container (beyond this POC)
      const totalBytes = chunks.reduce((s,c)=>s+c.byteLength,0);
      alert(`WebCodecs produced ${chunks.length} chunks (~${Math.round(totalBytes/1024)} KB). See console.`);
      console.log('WebCodecs chunks:', chunks);
      return chunks;
    } else {
      console.log('Using MediaRecorder deterministic capture');
      const stream = (off.captureStream) ? off.captureStream(fps) : null;
      const recorded = [];
      let mr = null;
      if (stream) {
        mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        mr.ondataavailable = (e) => { if (e.data && e.data.size) recorded.push(e.data); };
        mr.start();
      }

      // enable deterministic fallback if needed
      engine.enableMojsFallback(!engine.mojsControlled);
      await engine.sync.renderFrames(frameCount, async (i) => {
        ctx.clearRect(0,0,W,H);
        try { const bm = await createImageBitmap(threeCanvas); ctx.drawImage(bm,0,0,W,H); bm.close(); } catch (e) {}
        try { const bm2 = await createImageBitmap(pixiCanvas); ctx.drawImage(bm2,0,0,W,H); bm2.close(); } catch (e) {}
        if (mojsCanvas) try { const bm3 = await createImageBitmap(mojsCanvas); ctx.drawImage(bm3,0,0,W,H); bm3.close(); } catch (e) {}
      });
      engine.enableMojsFallback(false);

      if (mr) {
        mr.stop();
        return await new Promise((resolve) => { mr.onstop = () => {
          const blob = new Blob(recorded, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `visuefect_${fps}fps.webm`; a.click(); URL.revokeObjectURL(url);
          resolve(blob);
        }; });
      } else {
        // Fallback: no captureStream available, provide single-frame snapshot as PNG
        const png = (off.convertToBlob) ? await off.convertToBlob() : await new Promise(res => off.toBlob(res));
        const url = URL.createObjectURL(png);
        const a = document.createElement('a'); a.href = url; a.download = `visuefect_snapshot.png`; a.click(); URL.revokeObjectURL(url);
        return png;
      }
    }
  }

  if (exportBtn) exportBtn.addEventListener('click', async () => {
    try {
      exportBtn.disabled = true; exportBtn.textContent = 'Exportando...';
      await exportVideoDeterministic(5, 60);
    } catch (e) { console.error('Export failed', e); showErrorToast(e && e.message ? e.message : String(e)); }
    exportBtn.disabled = false; exportBtn.textContent = 'Exportar 5s';
  });

  // --- Error / Toast handling ---
  function showErrorToast(msg = 'Error', opts = {}) {
    try {
      const cont = document.getElementById('app-toast'); if (!cont) return;
      cont.innerHTML = '';
      cont.style.display = 'block';
      const box = document.createElement('div'); box.style.background = 'linear-gradient(90deg,#ff5aa0,#ff0066)'; box.style.color = '#fff'; box.style.padding = '12px 14px'; box.style.borderRadius = '8px'; box.style.boxShadow = '0 8px 30px rgba(0,0,0,0.4)'; box.style.maxWidth = '420px'; box.style.fontWeight = '700'; box.style.display = 'flex'; box.style.gap = '8px'; box.style.alignItems = 'center';
      const span = document.createElement('div'); span.textContent = String(msg); span.style.flex = '1'; span.style.fontSize = '13px';
      const close = document.createElement('button'); close.textContent = 'Cerrar'; close.style.background='rgba(255,255,255,0.08)'; close.style.color='#fff'; close.style.border='none'; close.style.padding='6px 8px'; close.style.borderRadius='6px';
      close.addEventListener('click', ()=>{ try{ cont.style.display='none'; cont.innerHTML=''; }catch(e){} });
      box.appendChild(span); box.appendChild(close); cont.appendChild(box);
      if (!opts.sticky) setTimeout(()=>{ try{ cont.style.display='none'; cont.innerHTML=''; }catch(e){} }, opts.timeout || 6000);
    } catch (e) { console.warn('Toast failed', e); }
  }

  // global error capture
  window.addEventListener('error', (ev) => { try { console.error('Unhandled error', ev.error || ev.message); showErrorToast(ev.error && ev.error.message ? ev.error.message : ev.message || 'Unknown error'); } catch (e) {} });
  window.addEventListener('unhandledrejection', (ev) => { try { console.error('Unhandled rejection', ev.reason); showErrorToast(ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)); } catch (e) {} });

  // expose
  window.__VISUEFECT = { engine, pc, ui };
}

main().catch(err => console.error('App init failed', err));
