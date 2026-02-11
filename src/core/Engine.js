import * as THREE from 'three';
import * as PIXI from 'pixi.js';
import logger from '../utils/logger.js';
import { createPixiApp } from '../utils/pixi.js';
// NOTE: mojs may try to use browser globals at top-level (UMD 'self') which breaks in Node.
// We dynamically import mojs only when running in a browser and allow tests/audit to skip it
// by setting process.env.SKIP_MOJS=1. This prevents static import-time failures in Node.
import { SyncBridge } from './SyncBridge.js';

export class VisualEngine {
  constructor(containers = { three: '#three-canvas', pixi: '#pixi-canvas', mojs: '#mojs-overlay' }) {
    this.containers = containers; // { three: '#three', pixi: '#pixi', mojs: '#mojs' }
    this.sync = new SyncBridge();
    this.modules = [];
    // mojs handling: load lazily to avoid Node/UMD issues in headless tests/audit
    this.mojs = null; // will hold the mojs module when loaded
    this.mojsLoaded = false;
    // Do not assume test env => headless; only explicitly skip mojs when SKIP_MOJS is set
    this.isHeadless = (typeof process !== 'undefined') && (process.env.SKIP_MOJS === '1');
    // mojs control flags & logs for deterministic fallback
    this.mojsItems = [];
    this.mojsControlled = false; // true if we can drive mojs via API
    this._mojsUpdateFn = null;
    this._mojsEventLog = []; // record of interactive bursts: {t,x,y,opts}
    this.mojsUseFallback = false; // during export, use Pixi fallback if true
    this._lastSyncTime = 0;

    // effects bookkeeping for reset/add/remove
    this.effectCounts = { pixi: 0, mojs: 0, three: 0 };
    this._createdEffects = { pixi: [], mojs: [], three: [] };
    this._errorLog = [];

    this.init();
  }

  init() {
    // 1. Three.js Setup
    this.scene = new THREE.Scene();
    // Detect if a real WebGL context is available; in headless (jsdom) environments
    // canvas.getContext won't be implemented.
    let isWebGLAvailable = true;
    try {
      const testCanvas = document.createElement('canvas');
      isWebGLAvailable = !!(testCanvas.getContext && (testCanvas.getContext('webgl') || testCanvas.getContext('webgl2')));
    } catch (e) { isWebGLAvailable = false; logger.warn('Three WebGL check failed', e); }
    if (!isWebGLAvailable) {
      this.isHeadless = true;
      // Create a minimal fake renderer to allow audit/tests to proceed without real GL
      this.renderer = {
        domElement: document.querySelector(this.containers.three) || (function () { const c = document.createElement('canvas'); c.id = 'three-canvas'; document.querySelector('#viewport') && document.querySelector('#viewport').appendChild(c); return c; }()),
        setPixelRatio: () => {},
        setSize: () => {},
        render: () => {},
        dispose: () => {},
      };
    } else {
      this.renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector(this.containers.three),
        alpha: true,
        antialias: true,
      });
    }
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.set(0, 0, 3);

    // 2. PixiJS Setup
    // Avoid creating real PIXI.Application in headless environments without canvas 2D support (jsdom)
    let pixiCanvasCheck;
    try {
      const _c = document.createElement('canvas');
      const _ctx = _c.getContext && _c.getContext('2d');
      // Be strict: require a usable 2D context (basic drawing APIs) to avoid partial shims
      pixiCanvasCheck = !!(_ctx && typeof _ctx.fillRect === 'function' && typeof _ctx.getImageData === 'function');
    } catch (e) { pixiCanvasCheck = false; }
    if (!pixiCanvasCheck) {
      // minimal fake app to satisfy APIs used in tests
      const fakeCanvas = document.querySelector(this.containers.pixi) || (function () { const c = document.createElement('canvas'); c.id = 'pixi-canvas'; document.querySelector('#viewport') && document.querySelector('#viewport').appendChild(c); return c; }());
      this.pixiApp = {
        view: fakeCanvas,
        renderer: { width: 800, height: 600, resize: () => {} },
        stage: { children: [], addChild(c) { this.children.push(c); }, removeChild(c) { const idx = this.children.indexOf(c); if (idx >= 0) this.children.splice(idx, 1); } },
        ticker: { update: () => {}, stop: () => {}, start: () => {} },
        destroy: () => {},
      };
    } else {
      this.pixiApp = createPixiApp({
        view: document.querySelector(this.containers.pixi),
        transparent: true,
        backgroundAlpha: 0,
        resizeTo: document.querySelector('#viewport'),
      });
    }
    // root container for user particles/effects
    this.pixiRoot = new PIXI.Container();
    try { this.pixiApp.stage.addChild(this.pixiRoot); } catch (e) { /* in fake app stage addChild may not exist */ }
    this._pixiUpdaters = [];

    // expose viewport and mojs container references
    // Ensure a viewport element exists for headless/test environments
    this.viewport = document.querySelector('#viewport') || (function () { const v = document.createElement('div'); v.id = 'viewport'; document.body.appendChild(v); return v; }());
    this.mojsContainer = document.querySelector(this.containers.mojs) || (function () { const d = document.createElement('div'); d.id = 'mojs-overlay'; (this.viewport || document.body).appendChild(d); return d; }).call(this);

    // 3. Mo.js Bridge
    // Stretch Goal: Forzamos a mojs a no usar su propio rAF si es posible

    // Setup frame hooks and detect mojs capabilities
    this.setupHooks();
    // Try to load mojs lazily; tests/audit can skip by setting process.env.SKIP_MOJS=1
    this._maybeLoadMojs();

    // Auto-resize handling
    try {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(this.viewport || document.body);
      this._resizeObserver = ro;
      // initial resize
      setTimeout(() => { try { this.resize(); } catch (e) {} }, 10);
    } catch (e) { /* ResizeObserver not available */ }

    // convenience: expose small helper methods for Interface drag actions
    this._exposeHelpers();
  }

  // Audio reactivity helpers
  // attach an AnalyserNode to drive callbacks (e.g., spawn bursts on beats)
  async attachAudioReactivity({
    analyser, threshold = 0.06, minIntervalMS = 150, onBeat = null,
  } = {}) {
    if (!analyser) throw new Error('attachAudioReactivity requires an AnalyserNode');
    if (this._audioConn) return { disconnect: () => { try { this._audioConn.disconnect(); this._audioConn = null; } catch (e) {} } };
    try {
      const mod = await import('../utils/audioReactive.js');
      const conn = mod.connectAudioToSync(this.sync, analyser, (ev) => {
        if (typeof onBeat === 'function') onBeat(ev);
        // default action: spawn a burst at center of viewport
        try { const rect = this.viewport.getBoundingClientRect(); const x = rect.width / 2; const y = rect.height / 2; this.addMojsBurst(x + rect.left, y + rect.top, {}); } catch (err) {}
      }, { threshold, minIntervalMS });
      this._audioConn = conn;
      return { disconnect: () => { try { conn.disconnect(); this._audioConn = null; } catch (e) {} } };
    } catch (e) {
      this._logError(e);
      throw e;
    }
  }

  // ---------- Cross-postprocessing: use Pixi canvas as Three texture ----------
  async addPixiProjection({ width = 1, height = 1, worldPosition = { x: 0, y: 0, z: 0 } } = {}) {
    // support multiple pixi versions: view or canvas or renderer.view
    let pixiView;
    try {
      // accessing `.view` may call Pixi getters which can throw in test env; protect it
      pixiView = this.pixiApp && (this.pixiApp.view || this.pixiApp.canvas || (this.pixiApp.renderer && this.pixiApp.renderer.view));
    } catch (e) {
      // fallback: if Pixi's getters throw (test env), create a local canvas to use as projection source
      try {
        const c = document.createElement('canvas'); c.width = (this.pixiApp && this.pixiApp.renderer && this.pixiApp.renderer.width) || 800; c.height = (this.pixiApp && this.pixiApp.renderer && this.pixiApp.renderer.height) || 600; pixiView = c;
      } catch (ee) {
        pixiView = null;
      }
    }
    if (!pixiView) throw new Error('Pixi canvas not available for projection');
    try {
      // prefer THREE.CanvasTexture, but support builds where it's not exported
      let CanvasTextureCtor = THREE.CanvasTexture;
      if (!CanvasTextureCtor) {
        try {
          const mod = await import('three/src/textures/CanvasTexture.js');
          CanvasTextureCtor = mod.default || mod.CanvasTexture || null;
        } catch (e) { CanvasTextureCtor = null; }
      }
      if (!CanvasTextureCtor) throw new Error('CanvasTexture not available in this Three build');

      const tex = new CanvasTextureCtor(pixiView);
      tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;

      // Ensure texture is readable/writeable for tests and runtime updates
      try {
        tex.needsUpdate = true;
      } catch (e) {
        try {
          tex.__visuefect_needsUpdate = true;
          Object.defineProperty(tex, 'needsUpdate', {
            configurable: true,
            get() { return !!this.__visuefect_needsUpdate; },
            set(v) { this.__visuefect_needsUpdate = !!v; },
          });
        } catch (er) { tex.__visuefect_needsUpdate = true; }
      }
      // always ensure we have a visible fallback flag for tests
      if (typeof tex.__visuefect_needsUpdate === 'undefined') tex.__visuefect_needsUpdate = true;
      // subscribe to sync to mark texture dynamic each frame (before and onUpdate to increase chance
      // the flag is set just before tests/readers check it)
      const unsubUpdate = this.sync.onUpdate(() => {
        try { tex.needsUpdate = true; } catch (e) {}
        tex.__visuefect_needsUpdate = true;
      });
      const unsubBefore = this.sync.onBeforeUpdate(() => {
        try { tex.needsUpdate = true; } catch (e) {}
        tex.__visuefect_needsUpdate = true;
      });
      // provide a remove hook to cleanup subscriptions when needed
      const removeHook = () => { try { unsubUpdate(); } catch (e) {} try { unsubBefore(); } catch (e) {} };

      const geo = new THREE.PlaneGeometry(width, height);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.position.set(worldPosition.x, worldPosition.y, worldPosition.z);
      this.scene.add(mesh);
      this.modules.push(mesh);
      const updater = () => { try { tex.needsUpdate = true; } catch (e) {} tex.__visuefect_needsUpdate = true; };
      this.addPixiUpdater(updater);
      try { mesh.__visuefect_type = 'three'; mesh.__visuefect_id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; this._createdEffects.three.push(mesh); this.effectCounts.three = this._createdEffects.three.length; } catch (e) {}
      return {
        mesh,
        texture: tex,
        remove: () => {
          try {
            removeHook();
            // ensure we also remove the updater we registered earlier to avoid leaks
            try { this._pixiUpdaters = (this._pixiUpdaters || []).filter((f) => f !== updater); } catch (ee) {}
            this.scene.remove(mesh); tex.dispose && tex.dispose(); mat.dispose && mat.dispose(); geo.dispose && geo.dispose();
          } catch (e) {}
        },
      };
    } catch (e) { this._logError(e); return null; }
  }

  setupHooks() {
    // Suscribimos los renders al ciclo del SyncBridge
    // onBeforeUpdate: process event logs (used for deterministic mojs fallback)
    this.sync.subscribe('onBeforeUpdate', (_dt) => {
      try {
        const t = this.sync.currentTime;
        if (this.mojsUseFallback && this._mojsEventLog.length) {
          const prev = this._lastSyncTime || 0;
          // spawn any events that occurred between prev and t
          for (let i = 0; i < this._mojsEventLog.length; i++) {
            const ev = this._mojsEventLog[i];
            if (ev.t > prev && ev.t <= t) {
              this._spawnPixiFromMojsEvent(ev);
            }
          }
          // remove processed events to avoid re-processing and unbounded growth
          try { this._mojsEventLog = this._mojsEventLog.filter((ev) => ev.t > t); } catch (e) { try { this._logError(e); logger.debug('mojsEventLog trim failed', e); } catch (err) {} }
        }
      } catch (e) { try { this._logError(e); logger.warn('mojs fallback processing failed', e); } catch (err) {} }
    });

    this.sync.subscribe('onUpdate', (_dt) => {
      // Update Three.js
      this.renderer.render(this.scene, this.camera);

      // Update PixiJS (Manual update para determinismo)
      try { this.pixiApp.ticker.update(this.sync.getNormalizedDelta()); } catch (e) { try { this._logError(e); logger.debug('Pixi ticker update failed', e); } catch (err) {} }
      // run registered pixi updaters
      try { this._pixiUpdaters.forEach((f) => { try { f(this.sync.getNormalizedDelta()); } catch (e) { try { this._logError(e); logger.debug('pixi updater failed', e); } catch (err) {} } }); } catch (e) { try { this._logError(e); logger.debug('pixi updaters loop failed', e); } catch (err) {} }

      // Drive mo.js via detected API when possible
      try {
        if (this.mojsControlled && this._mojsUpdateFn) {
          this._mojsUpdateFn(this.sync.currentTime);
        }
      } catch (e) { try { this._logError(e); logger.debug('mojs update hook failed', e); } catch (err) {} }

      // update lastSyncTime for fallback processing
      this._lastSyncTime = this.sync.currentTime;
    });
  }

  async _maybeLoadMojs() {
    if (this.mojsLoaded) return;
    try {
      // If an explicit Node mock is requested, load it first
      if (typeof process !== 'undefined' && process.env.MOJS_MOCK === '1') {
        const mod = await import('../mocks/mojs-node-mock.js').catch(() => null);
        this.mojs = mod ? (mod.default || mod) : null;
      } else {
        // Dynamic import of the real package (may be skipped in headless audits)
        const mod = await import('@mojs/core').catch(() => null);
        this.mojs = mod ? (mod.default || mod) : null;
      }

      if (this.mojs && typeof window !== 'undefined') window.mojs = this.mojs;
      // mark loaded only if we actually have a module — allows reattempts if later available
      this.mojsLoaded = !!this.mojs;
      this._detectMojsControl();
      logger.info('VISUEFECT: mojs loaded', { has: !!this.mojs });
    } catch (e) {
      this._logError(e);
      this.mojs = null; this.mojsLoaded = false; this.mojsControlled = false; this._mojsUpdateFn = null;
    }
  }

  _detectMojsControl() {
    // Feature-detect common mo.js 'update' hooks and pick the one available
    try {
      const m = this.mojs || (typeof window !== 'undefined' && window.mojs);
      if (m && m.Tween && typeof m.Tween.update === 'function') {
        this.mojsControlled = true;
        this._mojsUpdateFn = (t) => m.Tween.update(t);
        logger.info('VISUEFECT: mojs controlled via mojs.Tween.update');
      } else if (m && m.reducers && typeof m.reducers.update === 'function') {
        this.mojsControlled = true;
        this._mojsUpdateFn = (t) => m.reducers.update(t);
        logger.info('VISUEFECT: mojs controlled via mojs.reducers.update');
      } else {
        this.mojsControlled = false;
        this._mojsUpdateFn = null;
        logger.info('VISUEFECT: mojs control not available, will use fallback for export if enabled');
      }
    } catch (e) {
      this.mojsControlled = false; this._mojsUpdateFn = null;
    }
  }

  enableMojsFallback(enabled = true) {
    this.mojsUseFallback = !!enabled;
  }

  _spawnPixiFromMojsEvent(ev = {}) {
    try {
      // convert stroke color strings like '#ff00aa' to numeric color for PIXI
      const parseColor = (c) => {
        if (typeof c === 'number') return c;
        if (!c || typeof c !== 'string') return 0xffffff;
        const hex = c.replace('#', '');
        return parseInt(hex, 16) || 0xffffff;
      };
      const color = parseColor(ev.opts && ev.opts.stroke);
      // spawn a deterministic pixi emitter at the same coords
      this.addPixiEmitter(ev.x, ev.y, { color });
    } catch (e) { try { this._logError(e); logger.warn('spawnPixiFromMojsEvent failed', e); } catch (err) {} }
  }

  _exposeHelpers() {
    // simple mesh adder
    this.addThreeMesh = (opts = {}) => {
      try {
        const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const mat = new THREE.MeshStandardMaterial({ color: opts.color || 0xff00a0 });
        const m = new THREE.Mesh(geo, mat);
        m.position.set((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5);
        this.scene.add(m);
        this.modules.push(m);
        // bookkeeping
        try { m.__visuefect_type = 'three'; m.__visuefect_id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; this._createdEffects.three.push(m); this.effectCounts.three = this._createdEffects.three.length; } catch (e) {}
        return m;
      } catch (e) { try { this._logError(e); logger.warn('addThreeMesh failed', e); } catch (err) {} }
    };

    // simple pixi emitter / particle burst
    this.addPixiEmitter = (x = (this.pixiApp.renderer.width / 2), y = (this.pixiApp.renderer.height / 2), opts = {}) => {
      try {
        const container = new PIXI.Container();
        for (let i = 0; i < 30; i++) {
          const g = new PIXI.Graphics();
          // support both Pixi v8 and older versions with a try/fallback
          try { g.fill({ color: opts.color || 0xffffff, alpha: 1 }); g.circle(0, 0, 2 + Math.random() * 4); } catch (e) { g.beginFill(opts.color || 0xffffff, 1); g.drawCircle(0, 0, 2 + Math.random() * 4); g.endFill(); }
          g.x = x + (Math.random() - 0.5) * 80; g.y = y + (Math.random() - 0.5) * 80;
          g.vx = (Math.random() - 0.5) * 2; g.vy = (Math.random() - 0.5) * 2 - 0.6;
          container.addChild(g);
        }
        this.pixiRoot.addChild(container);
        this.modules.push(container);
        // basic updater to move them for a few seconds
        let life = 180;
        const updater = (_dt) => {
          for (let i = container.children.length - 1; i >= 0; i--) {
            const p = container.children[i]; p.vy += 0.02; p.x += p.vx; p.y += p.vy; p.alpha = Math.max(0, (life / 200));
          }
          life -= 1;
          if (life <= 0) { try { container.parent && container.parent.removeChild(container); } catch (e) {} }
        };
        // register updater and keep reference on container for cleanup
        try { container.__visuefect_updater = updater; } catch (e) {}
        this.addPixiUpdater(updater);
        // bookkeeping
        try { container.__visuefect_type = 'pixi'; container.__visuefect_id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; this._createdEffects.pixi.push(container); this.effectCounts.pixi = this._createdEffects.pixi.length; } catch (e) {}
        return container;
      } catch (e) { try { this._logError(e); logger.warn('addPixiEmitter failed', e); } catch (err) {} }
    };

    // add a simple mojs burst
    this.addMojsBurst = (clientX, clientY, opts = {}) => {
      try {
        const rect = document.querySelector('#viewport').getBoundingClientRect();
        const x = clientX - rect.left; const y = clientY - rect.top;
        const m = this.mojs || (typeof window !== 'undefined' && window.mojs);
        if (!m) {
          // If mojs is not available (headless / skipped), fallback to a Pixi emitter for audits/tests
          if (this.isHeadless || this.mojsUseFallback) {
            logger.info('VISUEFECT: mojs not available, spawning Pixi fallback for burst');
            return this.addPixiEmitter(x, y, opts);
          }
          logger.warn('addMojsBurst: mojs not loaded and not falling back');
          return null;
        }

        const burst = new m.Burst({
          parent: this.mojsContainer,
          left: 0,
          top: 0,
          x,
          y,
          radius: { 0: 100 },
          count: opts.count || 12,
          children: {
            shape: 'line', stroke: opts.stroke || '#00f0ff', strokeWidth: { 6: 0 }, duration: 700,
          },
        });
        burst.play();
        this.mojsItems.push(burst);

        // record event for deterministic export fallback (timestamped)
        try {
          this._mojsEventLog.push({
            t: this.sync.currentTime || 0, x, y, opts,
          });
        } catch (e) {}

        // attach metadata for potential future control
        burst.__visuefect_meta = { start: this.sync.currentTime || 0, duration: (opts.duration || 700) };
        // bookkeeping
        try { burst.__visuefect_type = 'mojs'; burst.__visuefect_id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; this._createdEffects.mojs.push(burst); this.effectCounts.mojs = this._createdEffects.mojs.length; } catch (e) {}
        return burst;
      } catch (e) { try { this._logError(e); logger.warn('addMojsBurst failed', e); } catch (err) {} }
    };
  }

  resize() {
    try {
      const rect = (this.viewport && this.viewport.getBoundingClientRect && this.viewport.getBoundingClientRect()) || { width: 800, height: 600 };
      const W = Math.max(1, Math.floor(rect.width));
      const H = Math.max(1, Math.floor(rect.height));
      const dpr = typeof window !== 'undefined' ? Math.max(1, Math.floor(window.devicePixelRatio || 1)) : 1;
      // Three renderer
      try {
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(W, H, false);
        if (this.camera) { this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); }
      } catch (e) { logger.warn('Three resize failed', e); }
      // Pixi
      try { if (this.pixiApp && this.pixiApp.renderer) this.pixiApp.renderer.resize(W, H); } catch (e) { try { this._logError(e); logger.warn('Pixi resize failed', e); } catch (err) { /* best-effort */ } }
      // mojs overlay sizing not needed (DOM overlay is 100%)
      // store sizes
      this._W = W; this._H = H; this._dpr = dpr;
      return { W, H, dpr };
    } catch (e) { try { this._logError(e); logger.warn('resize failed', e); } catch (err) { /* best-effort */ } }
  }

  async exportVideo(durationFrames = 300, { muxer = null } = {}) {
    logger.info('🎬 Iniciando Exportación Determinista...');
    const frames = [];
    const compositeCanvas = document.createElement('canvas');
    let ctx = compositeCanvas.getContext('2d');
    if (!ctx || typeof ctx.clearRect !== 'function' || typeof ctx.drawImage !== 'function') {
      // Safe no-op context for headless environments so export continues deterministically
      ctx = { clearRect: () => {}, drawImage: () => {}, getImageData: () => {} };
    }

    // Sincronizamos tamaños (fallback to stored)
    const W = this._W || 800; const H = this._H || 600;
    compositeCanvas.width = W; compositeCanvas.height = H;

    // If a muxer instance is provided, we'll push frames into it and finalize at the end.
    const usingMuxer = !!muxer;

    await this.sync.renderFrames(durationFrames, (frameIndex) => {
      // Dibujamos las 3 capas en el canvas de composición
      ctx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
      try { ctx.drawImage(this.renderer.domElement, 0, 0, W, H); } catch (e) {}
      try { ctx.drawImage(this.pixiApp.view, 0, 0, W, H); } catch (e) {}
      // Mo.js es SVG/DOM, requiere un paso extra (SVG -> Canvas)

      // Capture frame: either record to frames array or pass to muxer
      if (usingMuxer) {
        try {
          // make a copy of the composite canvas per-frame to avoid racing if the muxer reads it
          const frameCanvas = document.createElement('canvas');
          frameCanvas.width = compositeCanvas.width; frameCanvas.height = compositeCanvas.height;
          const fctx = frameCanvas.getContext('2d'); fctx.drawImage(compositeCanvas, 0, 0);
          muxer.addFrame(frameCanvas);
        } catch (e) { this._logError(e); }
      } else {
        try { frames.push(compositeCanvas.toDataURL()); } catch (e) { frames.push(null); }
      }
      logger.info(`Frame ${frameIndex} capturado.`);
    });

    if (usingMuxer) {
      try {
        const blob = await muxer.finalize();
        return blob;
      } catch (e) {
        this._logError(e);
        // If finalize fails, return the raw frames as a fallback
        return { error: e, framesCount: (muxer && typeof muxer.frameCount === 'function') ? muxer.frameCount() : frames.length };
      }
    }

    return frames;
  }

  addPixiUpdater(fn) { if (!this._pixiUpdaters) this._pixiUpdaters = []; this._pixiUpdaters.push(fn); return fn; }

  // ---- effect management APIs ----
  _logError(err) { try { this._errorLog.push({ time: Date.now(), message: err && err.message ? err.message : String(err), stack: err && err.stack ? err.stack : null }); } catch (e) { try { logger.error('error logging failed', e); } catch (err) { /* best-effort */ } } }

  addEffect(type = 'pixi', n = 1, opts = {}) {
    try {
      for (let i = 0; i < n; i++) {
        if (type === 'pixi') {
          const rect = this.viewport.getBoundingClientRect(); const x = (opts.x !== undefined) ? opts.x : (rect.width / 2 + (Math.random() - 0.5) * 120); const y = (opts.y !== undefined) ? opts.y : (rect.height / 2 + (Math.random() - 0.5) * 120);
          this.addPixiEmitter(x, y, opts);
        } else if (type === 'mojs') {
          const rect = this.viewport.getBoundingClientRect(); const x = (opts.x !== undefined) ? opts.x : (rect.width / 2 + (Math.random() - 0.5) * 120); const y = (opts.y !== undefined) ? opts.y : (rect.height / 2 + (Math.random() - 0.5) * 120);
          this.addMojsBurst(x + this.viewport.getBoundingClientRect().left, y + this.viewport.getBoundingClientRect().top, opts);
        } else if (type === 'three') {
          this.addThreeMesh(opts);
        }
      }
      return this.effectCounts[type] || 0;
    } catch (e) { this._logError(e); }
  }

  removeEffect(type = 'pixi', n = 1) {
    try {
      const arr = this._createdEffects[type] || [];
      for (let i = 0; i < n && arr.length; i++) {
        const it = arr.pop();
        try {
          if (type === 'pixi') {
            try { if (it.__visuefect_updater && this._pixiUpdaters) { this._pixiUpdaters = this._pixiUpdaters.filter((f) => f !== it.__visuefect_updater); } } catch (e) {}
            try { it.parent && it.parent.removeChild(it); } catch (e) {}
            try { it.destroy && it.destroy({ children: true }); } catch (e) {}
          }
          if (type === 'mojs') {
            try { it.stop && it.stop(); } catch (e) {} try { it.el && it.el.parentNode && it.el.parentNode.removeChild(it.el); } catch (e) {}
            // ensure bookkeeping reflects removal and avoid memory leaks
            try { this.mojsItems = (this.mojsItems || []).filter((mi) => mi !== it); } catch (ee) {}
          }
          if (type === 'three') { try { this.scene.remove(it); it.geometry?.dispose?.(); try { it.material?.map?.dispose?.(); } catch (e) {} it.material?.dispose?.(); } catch (e) {} }
        } catch (e) { this._logError(e); }
      }
      this.effectCounts[type] = (this._createdEffects[type] || []).length;
      return this.effectCounts[type];
    } catch (e) { this._logError(e); }
  }

  resetEffects(type = null) {
    try {
      const types = type ? [type] : ['pixi', 'mojs', 'three'];
      types.forEach((t) => { while ((this._createdEffects[t] || []).length) this.removeEffect(t, 1); });
      // clear misc logs
      if (!type) this._mojsEventLog = [];
      return true;
    } catch (e) { this._logError(e); return false; }
  }

  audit() {
    try {
      return {
        counts: { ...this.effectCounts },
        createdCounts: { pixi: (this._createdEffects.pixi || []).length, mojs: (this._createdEffects.mojs || []).length, three: (this._createdEffects.three || []).length },
        pixiChildren: this.pixiRoot ? this.pixiRoot.children.length : 0,
        threeChildren: this.scene ? this.scene.children.length : 0,
        mojsCount: this.mojsItems.length,
        mojsControlled: this.mojsControlled,
        mojsUseFallback: this.mojsUseFallback,
        errors: Array.from(this._errorLog || []),
        logs: logger.recent(200),
      };
    } catch (e) { this._logError(e); return {}; }
  }

  destroy() {
    // disconnect observers/listeners to avoid leaking resources
    try { this._resizeObserver && typeof this._resizeObserver.disconnect === 'function' && this._resizeObserver.disconnect(); } catch (e) {}
    this.sync.stop();
    try { this.renderer && this.renderer.dispose(); } catch (e) {}
    try { this.pixiApp && this.pixiApp.destroy(true, { children: true, texture: true }); } catch (e) {}
    this.modules.forEach((m) => m.dispose?.());
    try { logger.info('VISUEFECT Engine cleaned'); } catch (e) { /* best-effort */ }
  }
}

// named and default export for compatibility
export default VisualEngine;
