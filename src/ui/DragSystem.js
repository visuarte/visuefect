import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as PIXI from 'pixi.js';
import logger from '../utils/logger.js';

// lightweight debug helper (global toggle via window.__VISUEFECT.debug)
const _dbg = (...args) => { try { if (typeof window !== 'undefined' && window.__VISUEFECT && window.__VISUEFECT.debug) console.log(...args); } catch (e) {} };

/**
 * DragSystem — Smart parser for drag&drop with Ghost previews
 * - Infers target layer (Three / Pixi / Mojs) depending on files or UI items
 * - Shows translucent ghost preview in Three (3D) or Pixi (2D) during drag
 * - Loads GLTF/OBJ into Three, image sequences or particles json into Pixi,
 *   and UI shapes into mojs via mojsEffects trigger
 *
 * Usage: const ds = new DragSystem(engine, { pixiParticles, mojsEffects }); ds.init();
 */
export default class DragSystem {
  constructor(engine, { pixiParticles = null, mojsEffects = null } = {}) {
    if (!engine) throw new Error('DragSystem needs engine instance');
    this.engine = engine;
    this.viewport = engine.viewport;
    this.pixiParticles = pixiParticles;
    this.mojsEffects = mojsEffects;

    this._onDragOverBound = this._onDragOver.bind(this);
    this._onDragEnterBound = this._onDragEnter.bind(this);
    this._onDragLeaveBound = this._onDragLeave.bind(this);
    this._onDropBound = this._onDrop.bind(this);

    // ghost previews
    this._ghost3D = null; this._ghost2D = null;
    this._raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // z=0 plane

    // loaders
    this._gltfLoader = new GLTFLoader();
    this._objLoader = new OBJLoader();
  }

  init() {
    if (!this.viewport) return;
    if (this._inited) return; // idempotent init
    this._inited = true;
    _dbg('DragSystem: init, viewport found');
    this.viewport.addEventListener('dragenter', this._onDragEnterBound);
    this.viewport.addEventListener('dragover', this._onDragOverBound);
    this.viewport.addEventListener('dragleave', this._onDragLeaveBound);
    this.viewport.addEventListener('drop', this._onDropBound);

    // If user drags UI buttons (.btn with data-drag-item), enable them as draggable
    document.querySelectorAll('[data-drag-item]').forEach((el) => el.setAttribute('draggable', 'true'));
  }

  destroy() {
    if (!this.viewport) return;
    this.viewport.removeEventListener('dragenter', this._onDragEnterBound);
    this.viewport.removeEventListener('dragover', this._onDragOverBound);
    this.viewport.removeEventListener('dragleave', this._onDragLeaveBound);
    this.viewport.removeEventListener('drop', this._onDropBound);
    this._removeGhost();
    this._inited = false;
  }

  // ---------- Event Handlers ----------
  _onDragEnter(e) {
    e.preventDefault();
    _dbg('DragSystem: dragenter', { types: e.dataTransfer && Array.from(e.dataTransfer.types || []) });
    this.viewport.classList.add('ve-dragover');
    // when drag enters, we can inspect items
    const items = e.dataTransfer ? e.dataTransfer.items : null;
    this._lastDT = e.dataTransfer || null;
  }

  _onDragOver(e) {
    e.preventDefault();
    // maintain ghost preview following pointer
    const x = e.clientX; const y = e.clientY;
    // infer layer quickly and show appropriate ghost
    const inferred = this._inferFromDataTransfer(e.dataTransfer);
    _dbg('DragSystem: dragover inferred', inferred.layer);
    if (inferred.layer === 'three') {
      this._ensureGhost3D();
      this._updateGhost3D(x, y);
    } else if (inferred.layer === 'pixi') {
      this._ensureGhost2D();
      this._updateGhost2D(x, y);
    } else if (inferred.layer === 'mojs') {
      // mojs use simple cursor indicator on pixi layer or DOM overlay
      this._ensureGhost2D();
      this._updateGhost2D(x, y, { shape: 'star' });
    } else {
      this._removeGhost();
    }

    // Keep cursor feedback
    e.dataTransfer.dropEffect = 'copy';
  }

  _onDragLeave(e) {
    this.viewport.classList.remove('ve-dragover');
    this._removeGhost();
  }

  async _onDrop(e) {
    e.preventDefault();
    _dbg('DragSystem: drop', { types: e.dataTransfer && Array.from(e.dataTransfer.types || []), files: (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) || 0 });
    this.viewport.classList.remove('ve-dragover');
    this._removeGhost();

    const dt = e.dataTransfer;
    const inferred = this._inferFromDataTransfer(dt);

    // compute drop position
    const rect = this.viewport.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // If files
    if (inferred.files && inferred.files.length) {
      const { files } = inferred;
      // prefer 3D if any gltf/obj
      const has3D = files.some((f) => /\.gltf$|\.glb$|\.obj$/i.test(f.name));
      if (has3D) return this._handle3DFiles(files, x, y);
      // images seq
      const isImageSeq = files.every((f) => /image\//i.test(f.type)) && files.length > 1;
      if (isImageSeq) return this._handleImageSequence(files, x, y);
      // json particle
      const jsonFile = files.find((f) => /\.json$/i.test(f.name));
      if (jsonFile) return this._handleParticleJSON(jsonFile, x, y);
    }

    // If no files, maybe a UI draggable element
    const plain = dt.getData('application/json') || dt.getData('text/plain') || '';
    let data = null;
    try { data = JSON.parse(plain); } catch (e) { data = { item: plain, type: 'generic' }; }

    if (data && data.type === 'fx') {
      const name = data.item || 'lines';
      if (this.mojsEffects && typeof this.mojsEffects.trigger === 'function') this.mojsEffects.trigger(name, e.clientX, e.clientY);
      return;
    }

    if (data && data.type === 'particle') {
      if (this.pixiParticles && typeof this.pixiParticles.spawnAt === 'function') this.pixiParticles.spawnAt(x, y);
      return;
    }

    // fallback: log via logger
    logger.warn('Dropped unknown payload', { data, x, y });
  }

  // ---------- Inference ----------
  _inferFromDataTransfer(dt) {
    if (!dt) return { layer: 'unknown', files: null };
    const files = Array.from(dt.files || []);
    if (files.length) {
      // check extensions
      const exts = files.map((f) => f.name.split('.').pop().toLowerCase());
      if (exts.some((e) => ['gltf', 'glb', 'obj'].includes(e))) return { layer: 'three', files };
      if (files.every((f) => /image\//i.test(f.type))) return { layer: 'pixi', files };
      if (files.some((f) => f.name.endsWith('.json'))) return { layer: 'pixi', files };
      return { layer: 'unknown', files };
    }

    const plain = dt.getData('application/json') || dt.getData('text/plain') || '';
    try {
      const data = JSON.parse(plain);
      if (data && data.type === 'fx') return { layer: 'mojs', data };
      if (data && data.type === 'particle') return { layer: 'pixi', data };
    } catch (e) { /* not json */ }

    // fallback: unknown
    return { layer: 'unknown', files: null };
  }

  // ---------- Handlers ----------
  async _handle3DFiles(files, x, y) {
    // pick first gltf/glb/obj
    const f = files.find((f) => /\.gltf$|\.glb$|\.obj$/i.test(f.name));
    if (!f) return;
    const url = URL.createObjectURL(f);
    try {
      if (/\.obj$/i.test(f.name)) {
        const obj = await this._objLoader.loadAsync(url);
        obj.position.set((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 0);
        this.engine.scene.add(obj);
        URL.revokeObjectURL(url);
        const ev = new CustomEvent('drag:imported', { detail: { type: 'obj', file: f } }); window.dispatchEvent(ev);
      } else {
        const gltf = await this._gltfLoader.loadAsync(url);
        const root = gltf.scene || gltf.scenes && gltf.scenes[0];
        if (root) {
          root.position.set(0, 0, 0);
          this.engine.scene.add(root);
        }
        URL.revokeObjectURL(url);
        const ev = new CustomEvent('drag:imported', { detail: { type: 'gltf', file: f } }); window.dispatchEvent(ev);
      }
    } catch (err) {
      console.error('3D import error', err);
      URL.revokeObjectURL(url);
    }
  }

  async _handleImageSequence(files, x, y) {
    // load first image as a sprite preview + optionally create AnimatedSprite
    try {
      const textures = [];
      for (const f of files) {
        const url = URL.createObjectURL(f);
        const tex = PIXI.Texture.from(url);
        textures.push(tex);
        URL.revokeObjectURL(url);
      }
      if (textures.length === 0) return;
      const sprite = new PIXI.AnimatedSprite(textures);
      sprite.animationSpeed = 0.2 + Math.random() * 0.6;
      sprite.play();
      sprite.x = x; sprite.y = y; sprite.anchor.set(0.5);
      this.pixiParticles && this.pixiParticles.pixiRoot && this.pixiParticles.pixiRoot.addChild(sprite);
      // auto remove after some seconds
      setTimeout(() => { try { sprite.parent && sprite.parent.removeChild(sprite); } catch (err) {} }, 8000);

      window.dispatchEvent(new CustomEvent('drag:imported', { detail: { type: 'image-sequence', count: textures.length } }));
    } catch (err) { console.error('Image seq error', err); }
  }

  async _handleParticleJSON(file, x, y) {
    try {
      const txt = await file.text();
      const data = JSON.parse(txt);
      // data expected { count, color, speed } or similar
      const count = data.count || 30;
      const color = data.color || 0xffffff;
      for (let i = 0; i < count; i++) {
        this.pixiParticles && this.pixiParticles.spawnAt && this.pixiParticles.spawnAt(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 120);
      }
      window.dispatchEvent(new CustomEvent('drag:imported', { detail: { type: 'particles-json', file: file.name } }));
    } catch (err) { console.error('Particle json error', err); }
  }

  // ---------- Ghost Preview helpers ----------
  _ensureGhost3D() {
    if (this._ghost3D) return;
    const geo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff, transparent: true, opacity: 0.18, depthTest: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 9999;
    this.engine.scene.add(mesh);
    this._ghost3D = mesh;
  }

  _updateGhost3D(clientX, clientY) {
    if (!this._ghost3D) return;
    const rect = this.viewport.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this._raycaster.setFromCamera(ndc, this.engine.camera);
    const pos = new THREE.Vector3();
    this._raycaster.ray.intersectPlane(this._plane, pos);
    if (pos) this._ghost3D.position.copy(pos);
  }

  _ensureGhost2D() {
    if (this._ghost2D) return;
    const g = new PIXI.Graphics();
    // Pixi v8 API: prefer fill() + circle(); fall back to deprecated methods when necessary
    try { g.fill({ color: 0x00f0ff, alpha: 0.12 }); g.circle(0, 0, 36); } catch (e) { g.beginFill(0x00f0ff, 0.12); g.drawCircle(0, 0, 36); g.endFill(); }
    g.alpha = 0.9; g.zIndex = 9999; g.renderable = true; g.blendMode = (PIXI.BLEND_MODES && PIXI.BLEND_MODES.ADD) || 0;
    if (this.pixiParticles && this.pixiParticles.pixiRoot) this.pixiParticles.pixiRoot.addChild(g); else if (this.engine.pixiApp) this.engine.pixiApp.stage.addChild(g);
    this._ghost2D = g;
  }

  _updateGhost2D(clientX, clientY, { shape = 'circle' } = {}) {
    if (!this._ghost2D) return;
    const rect = this.viewport.getBoundingClientRect();
    this._ghost2D.x = clientX - rect.left; this._ghost2D.y = clientY - rect.top;
    // simple scale animation for feedback
    this._ghost2D.scale.set(1 + Math.sin(Date.now() / 160));
  }

  _removeGhost() {
    if (this._ghost3D) {
      try { this.engine.scene.remove(this._ghost3D); this._ghost3D.geometry.dispose(); this._ghost3D.material.dispose(); } catch (e) {}
      this._ghost3D = null;
    }
    if (this._ghost2D) {
      try { this._ghost2D.parent && this._ghost2D.parent.removeChild(this._ghost2D); this._ghost2D.destroy(); } catch (e) {}
      this._ghost2D = null;
    }
  }
}
