import mojs from '@mojs/core';

/**
 * Stepper / WorkflowManager
 * - Gestor de pasos: ATMOSPHERE (1), DYNAMICS (2), ACCENTS (3), EXPORT (4)
 * - Mutaciones de UI: oculta/activa controles por step usando data-step
 * - Usa mo.js para animar highlights
 * - Validador de rendimiento que muestra aviso si FPS < threshold
 */
export default class Stepper {
  constructor({ engine, ui = null, pixiParticles = null, mojsEffects = null, options = {} } = {}) {
    if (!engine) throw new Error('Stepper requires engine instance');
    this.engine = engine;
    this.ui = ui;
    this.pixiParticles = pixiParticles;
    this.mojsEffects = mojsEffects;

    this.steps = [ 'ATMOSPHERE', 'DYNAMICS', 'ACCENTS', 'EXPORT' ];
    this.currentIndex = 0;

    this.fpsThreshold = options.fpsThreshold || 30;
    this._fpsSamples = [];
    this._fpsWindowMs = options.fpsWindowMs || 2000;

    this._onFrameBound = this._onFrame.bind(this);

    this._perfEl = null;
    this._perfShown = false;

    this._updaters = new Set();
    this._listeners = new Set();
  }

  init() {
    // hook into engine frames to compute FPS (add a light updater)
    this.engine.addThreeUpdater(this._onFrameBound);

    // create perf banner
    this._createPerfBanner();

    // ensure initial UI state
    this.setStep('ATMOSPHERE');

    // start monitoring
    this._monitoring = true;
  }

  destroy() {
    // remove updater
    if (this.engine && this._onFrameBound) {
      if (this.engine._threeUpdaters) this.engine._threeUpdaters = this.engine._threeUpdaters.filter(f => f !== this._onFrameBound);
    }
    if (this._perfEl && this._perfEl.parentNode) this._perfEl.parentNode.removeChild(this._perfEl);
    this._monitoring = false;
    this._listeners.clear();
  }

  /* ---------- Steps control ---------- */
  get currentStep() { return this.steps[this.currentIndex]; }

  setStep(stepOrIndex) {
    let idx = this.currentIndex;
    if (typeof stepOrIndex === 'number') idx = Math.max(0, Math.min(this.steps.length - 1, stepOrIndex));
    else {
      const s = String(stepOrIndex || '').toUpperCase();
      const find = this.steps.indexOf(s);
      if (find >= 0) idx = find;
    }
    this.currentIndex = idx;
    this._mutateUIForStep(idx + 1);

    if (this.ui && typeof this.ui.setStep === 'function') {
      try { this.ui.setStep(idx + 1); } catch (e) { /* ignore */ }
    }

    // dispatch event
    const ev = new CustomEvent('stepper:change', { detail: { step: this.currentStep, index: this.currentIndex } });
    document.dispatchEvent(ev);
    return this.currentStep;
  }

  next() { return this.setStep(this.currentIndex + 1); }
  prev() { return this.setStep(this.currentIndex - 1); }

  /* ---------- UI mutation ---------- */
  _mutateUIForStep(stepNumber) {
    // find all controls with data-step
    const all = document.querySelectorAll('[data-step]');
    all.forEach(el => {
      const step = Number(el.getAttribute('data-step')) || 1;
      const container = el.closest('.card') || el;
      if (step === stepNumber) {
        // active: remove hidden, add highlight
        el.disabled = false; container.classList.remove('ve-step-hidden'); container.classList.add('ve-step-highlight');
        // animate highlight
        try { new mojs.Html({ el: container, duration: 450, scale: { 1: 1.03 }, easing: 'elastic.out' }).play(); } catch (e) {}
      } else {
        // inactive: disable and visually mute
        el.disabled = true; container.classList.remove('ve-step-highlight'); container.classList.add('ve-step-hidden');
      }
    });

    // special handling for EXPORT step
    if (stepNumber === 4) {
      const exports = document.querySelectorAll('#generate-code, #export-video, #copy-code');
      exports.forEach(el => { el.classList.add('ve-step-highlight'); try { new mojs.Html({ el, duration: 350, scale: {1:1.04} }).play(); } catch (e) {} });
    }
  }

  /* ---------- FPS monitoring & validator ---------- */
  _createPerfBanner() {
    if (document.getElementById('perf-warning')) return;
    const el = document.createElement('div');
    el.id = 'perf-warning';
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div><strong>Límite de Hardware Alcanzado</strong> — <span id="perf-fps">0</span> FPS</div>
        <div><button id="perf-optimize" class="btn">Optimizar</button></div>
      </div>
      <div id="perf-suggestions" style="font-size:12px;margin-top:8px">Sugerencias: reducir partículas, bajar calidad o desactivar FX</div>
      <div id="perf-list" style="margin-top:10px;max-height:160px;overflow:auto;font-size:12px"></div>
    `;
    document.body.appendChild(el);
    el.querySelector('#perf-optimize').addEventListener('click', () => this.autoOptimize());
    this._perfEl = el;
  }

  _showPerfBanner(fps) {
    if (!this._perfEl) this._createPerfBanner();
    const el = this._perfEl;
    el.querySelector('#perf-fps').textContent = String(Math.round(fps));
    el.classList.add('show');
    this._perfShown = true;

    // populate heavy elements list
    const list = el.querySelector('#perf-list');
    if (list) {
      const heavy = this._getHeavyElements();
      if (heavy.length === 0) list.innerHTML = '<div style="opacity:0.8">No se detectaron elementos pesados</div>';
      else {
        list.innerHTML = heavy.map((h, idx) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px;border-bottom:1px solid rgba(255,255,255,0.03)">
            <div><strong>${h.label}</strong><div style="color:#ffd8d8;font-size:11px">${h.hint}</div></div>
            <div style="display:flex;gap:8px"><div style="font-size:12px;opacity:0.9">${h.metricText}</div><button data-idx="${idx}" class="perf-remove btn" style="background:#ff4d6d;color:#fff;padding:6px 8px;border-radius:6px;border:none">Eliminar</button></div>
          </div>
        `).join('');
        // attach remove handlers
        list.querySelectorAll('.perf-remove').forEach(btn => btn.addEventListener('click', (ev) => {
          const idx = Number(btn.getAttribute('data-idx'));
          const item = heavy[idx];
          if (item) this._removeHeavyElement(item);
        }));

        // attach details buttons dynamically (insert before remove buttons)
        Array.from(list.children).forEach((node, idx) => {
          const removeBtn = node.querySelector('.perf-remove');
          if (removeBtn) {
            const detailsBtn = document.createElement('button');
            detailsBtn.textContent = 'Detalles';
            detailsBtn.className = 'perf-details btn';
            detailsBtn.style.cssText = 'background:#3b8cff;color:#fff;padding:6px 8px;border-radius:6px;border:none;margin-right:6px';
            detailsBtn.addEventListener('click', () => { const item = heavy[idx]; if (item) this._showElementDetails(item); });
            removeBtn.parentNode.insertBefore(detailsBtn, removeBtn);
          }
        });
      }
    }
  }
  _hidePerfBanner() { if (this._perfEl) { this._perfEl.classList.remove('show'); this._perfShown = false; } }

  _onFrame(dt) {
    // dt is ms from Three updater
    const now = performance.now();
    // push timestamp
    this._fpsSamples.push({ t: now, dt });
    // purge old
    const cutoff = now - this._fpsWindowMs;
    while (this._fpsSamples.length && this._fpsSamples[0].t < cutoff) this._fpsSamples.shift();

    // compute fps: frames per second = samples.length / (window/1000)
    const windowDuration = Math.max(1, (this._fpsSamples.length ? (now - this._fpsSamples[0].t) : this._fpsWindowMs));
    const fps = (this._fpsSamples.length / (windowDuration / 1000)) || 0;

    if (fps < this.fpsThreshold) {
      // check if particle/scene counts are high
      const particlesCount = (this.pixiParticles && this.pixiParticles.pixiRoot && this.pixiParticles.pixiRoot.children ? this.pixiParticles.pixiRoot.children.length : 0);
      const sceneCount = (this.engine && this.engine.scene && this.engine.scene.children ? this.engine.scene.children.length : 0);
      if (!this._perfShown && (particlesCount > 80 || sceneCount > 40)) {
        this._showPerfBanner(fps);
      } else if (!this._perfShown && fps < (this.fpsThreshold - 6)) {
        // also show if fps is seriously low
        this._showPerfBanner(fps);
      }
    } else {
      // hide banner once recovered
      if (this._perfShown) this._hidePerfBanner();
    }
  }

  // Simple auto optimize function (best-effort)
  autoOptimize() {
    // reduce PIXI elements
    if (this.pixiParticles && this.pixiParticles.pixiRoot) {
      const root = this.pixiParticles.pixiRoot;
      // remove oldest half
      const toRemove = Math.floor(root.children.length / 2);
      for (let i = 0; i < toRemove; i++) {
        try { const c = root.children[0]; root.removeChild(c); if (c.destroy) c.destroy(); } catch (e) {}
      }
      // reduce spawn radius
      if (this.pixiParticles.config) this.pixiParticles.config.spawnRadius = Math.max(1, this.pixiParticles.config.spawnRadius * 0.6);
    }

    // reduce Three quality
    try {
      if (this.engine && this.engine.threeRenderer) {
        this.engine.threeRenderer.setPixelRatio(1);
        // dim emissive
        if (this.engine.scene && this.engine.scene.children) {
          this.engine.scene.traverse((o) => {
            if (o.isMesh && o.material && o.material.emissiveIntensity) o.material.emissiveIntensity = Math.max(0, (o.material.emissiveIntensity || 0.2) * 0.4);
          });
        }
      }
    } catch (e) {}

    // turn off mojs heavy children by reducing counts (no direct API, but we can tune existing effects)
    try {
      if (this.mojsEffects && this.mojsEffects.effects) {
        Object.values(this.mojsEffects.effects).forEach((ef) => {
          try { ef.tune && ef.tune({ count: Math.max(6, (ef.count || ef.o && ef.o.count || 12) >> 1) }); } catch (e) {}
        });
      }
    } catch (e) {}

    // show small confirmation
    const prev = this._perfEl; if (prev) prev.innerHTML = '<div style="font-weight:bold">Optimización aplicada — Revise el rendimiento</div>'; setTimeout(()=>{ if (this._perfEl) this._perfEl.innerHTML = `<div><strong>Límite de Hardware Alcanzado</strong> — <span id="perf-fps">0</span> FPS</div>
      <div id="perf-suggestions" style="font-size:12px;margin-top:8px">Sugerencias: reducir partículas, bajar calidad o desactivar FX</div>
      <div id="perf-list" style="margin-top:10px;max-height:160px;overflow:auto;font-size:12px"></div>`; const btn=this._perfEl.querySelector('#perf-optimize'); if(btn)btn.addEventListener('click',()=>this.autoOptimize()); }, 2200);
  }

  _getHeavyElements() {
    const out = [];
    // inspect Three scene: collect meshes with vertex counts
    if (this.engine && this.engine.scene) {
      this.engine.scene.traverse((o) => {
        if (o.isMesh && o.geometry) {
          const pos = o.geometry.attributes && o.geometry.attributes.position;
          const verts = pos ? pos.count : 0;
          out.push({ type: 'three', label: o.name || `Mesh ${o.id}`, metric: verts, metricText: `${verts} verts`, ref: o, hint: `Three.js mesh` });
        }
      });
    }
    // inspect Pixi: count children sizes
    if (this.pixiParticles && this.pixiParticles.pixiRoot) {
      this.pixiParticles.pixiRoot.children.forEach((c, i) => {
        const cost = c.children ? c.children.length : 1;
        out.push({ type: 'pixi', label: c.name || `Sprite ${i}`, metric: cost, metricText: `${cost} sprites`, ref: c, hint: `Pixi display object` });
      });
    }

    // sort by metric desc and return top 8
    out.sort((a,b)=>b.metric - a.metric);
    return out.slice(0,8);
  }

  _removeHeavyElement(item) {
    if (!item) return;
    try {
      if (item.type === 'three' && item.ref && item.ref.parent) {
        item.ref.parent.remove(item.ref);
        if (item.ref.geometry) item.ref.geometry.dispose();
        if (item.ref.material) item.ref.material.dispose();
      }
      if (item.type === 'pixi' && item.ref && item.ref.parent) {
        item.ref.parent.removeChild(item.ref);
        try { item.ref.destroy && item.ref.destroy({ children: true }); } catch (e) {}
      }
      // refresh banner view
      if (this._perfEl && this._perfShown) this._showPerfBanner(parseFloat(this._perfEl.querySelector('#perf-fps').textContent) || 0);
    } catch (e) { console.warn('Could not remove heavy element', e); }
  }

  _showElementDetails(item) {
    if (!item) return;
    // show a small modal with details and optimizations
    const overlayId = 'perf-detail-overlay';
    let overlay = document.getElementById(overlayId);
    if (!overlay) {
      overlay = document.createElement('div'); overlay.id = overlayId; overlay.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(8,8,12,0.98);color:#fff;padding:16px;border-radius:8px;z-index:10000;max-width:480px;box-shadow:0 8px 30px rgba(0,0,0,0.6)';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><strong>Detalles: ${item.label}</strong><button id="perf-detail-close" class="btn">Cerrar</button></div>
      <div style="margin-top:8px;font-size:13px">Tipo: ${item.type}<br>Metric: ${item.metricText}<br>Hint: ${item.hint}</div>
      <div style="margin-top:12px;display:flex;gap:8px"><button id="perf-detail-opt" class="btn">Aplicar optimización</button><button id="perf-detail-remove" class="btn" style="background:#ff4d6d;color:#fff">Eliminar</button></div>
      <div style="margin-top:8px;font-size:12px;color:#ccc">Sugerencia automática: ${this._suggestOptimizations(item)}</div>
    `;
    overlay.querySelector('#perf-detail-close').addEventListener('click', () => { try{ overlay.remove(); } catch(e){} });
    overlay.querySelector('#perf-detail-remove').addEventListener('click', () => { this._removeHeavyElement(item); try{ overlay.remove(); } catch(e){} });
    overlay.querySelector('#perf-detail-opt').addEventListener('click', () => { this._applyQuickOptimization(item); try{ overlay.remove(); } catch(e){} });
  }

  _suggestOptimizations(item) {
    if (!item) return '';
    if (item.type === 'three') return 'Reducir subdivisión, usar LOD o reemplazar con proxy de baja resolución.';
    if (item.type === 'pixi') return 'Reducir sprites, usar spritesheets o reducir alpha/blend.';
    return 'Reducir complejidad o eliminar.';
  }

  _applyQuickOptimization(item) {
    if (!item) return;
    try {
      if (item.type === 'three' && item.ref) {
        // attempt to simplify by scaling down or removing heavy attributes
        item.ref.scale.multiplyScalar(0.6);
        if (item.ref.material) { item.ref.material.wireframe = true; }
      }
      if (item.type === 'pixi' && item.ref) {
        if (item.ref.children) {
          const toRem = Math.floor(item.ref.children.length / 2);
          for (let i = 0; i < toRem; i++) { try { const c = item.ref.children[0]; item.ref.removeChild(c); if (c.destroy) c.destroy(); } catch(e){} }
        }
      }
      // refresh banner
      if (this._perfEl && this._perfShown) this._showPerfBanner(parseFloat(this._perfEl.querySelector('#perf-fps').textContent) || 0);
    } catch (e) { console.warn('Optimization failed', e); }
  }
}
