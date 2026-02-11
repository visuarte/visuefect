/**
 * Interface.js — Manejador de UI: drag&drop, step manager y parameter mapper
 * - Uso: import Interface from './src/ui/Interface.js'
 * - Se asume que `engine` y los componentes (threeScene, pixiParticles, mojsEffects)
 *   pueden pasarse para que la interfaz actúe sobre ellos.
 */

export class Interface {
    constructor(engine) {
        this.engine = engine;
        this.currentStep = 1; // 1: Three (BG), 2: Pixi (FX), 3: Mojs (UI)
        this.initEventListeners();
    }

    initEventListeners() {
        document.querySelectorAll('.step-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.goToStep(parseInt(e.currentTarget.dataset.step)));
        });

        // Drag & Drop Listener
        const dropzone = document.querySelector('#viewport');
        dropzone.addEventListener('dragover', (e) => e.preventDefault());
        dropzone.addEventListener('drop', (e) => this.handleDrop(e));

        // Setup draggable items in the sidebar
        this._setupDragItems();
        this._renderPresets();
        this._bindCreateCustom();
    }

    _setupDragItems() {
        document.querySelectorAll('[data-drag-item]').forEach(el => {
            el.setAttribute('draggable', 'true');
            // ensure click doesn't immediately activate navigation/other effects
            el.addEventListener('dragstart', (ev) => {
                const type = el.getAttribute('data-drag-type') || 'generic';
                const item = el.getAttribute('data-drag-item') || '';
                try { ev.dataTransfer.setData('item-type', type); } catch (e) {}
                try { ev.dataTransfer.setData('item', item); } catch (e) {}
                // store preset payload if present
                try { const payload = el.getAttribute('data-preset'); if (payload) ev.dataTransfer.setData('preset', payload); } catch (e) {}
                // set a visible drag image if available
                if (ev.dataTransfer.setDragImage && el instanceof HTMLElement) {
                    const img = document.createElement('canvas'); img.width = 80; img.height = 32; const ctx = img.getContext('2d'); ctx.fillStyle = '#00f0ff'; ctx.fillRect(0,0,80,32); ctx.fillStyle = '#000'; ctx.fillText(item,8,20); ev.dataTransfer.setDragImage(img, 40,16);
                }
            });
            // also allow click to spawn for presets
            if (el.getAttribute('data-preset') && !el.__preset_click) {
                el.addEventListener('click', (e) => {
                    try {
                        const preset = JSON.parse(el.getAttribute('data-preset'));
                        const rect = this.engine.viewport.getBoundingClientRect();
                        const cx = rect.width/2; const cy = rect.height/2;
                        this.engine.addCustomEffect && this.engine.addCustomEffect(preset, cx, cy);
                    } catch (err) { console.warn('preset spawn failed', err); }
                });
                el.__preset_click = true;
            }
        });
    }

    getStepName(step) {
        if (step === 1) return 'ATMOSPHERE';
        if (step === 2) return 'DYNAMICS';
        if (step === 3) return 'ACCENTS';
        return 'EXPORT';
    }

    // Presets
    _renderPresets() {
        try {
            const presets = (window.__VISUEFECT_PRESETS && window.__VISUEFECT_PRESETS.loadPresets) ? window.__VISUEFECT_PRESETS.loadPresets() : [];
            const container = document.querySelector('.card [data-drag-item]')?.parentElement || document.querySelector('.card div[style*="flex-wrap"]');
            if (!container) return;
            // remove existing preset buttons
            container.querySelectorAll('[data-preset]').forEach(el => el.remove());
            presets.forEach(p => {
                const btn = document.createElement('button'); btn.className = 'btn'; btn.setAttribute('data-drag-item', p.id); btn.setAttribute('data-drag-type', p.layer === 'particle' ? 'particle' : (p.layer === 'fx' ? 'fx' : 'three')); btn.setAttribute('data-preset', JSON.stringify(p)); btn.textContent = p.name || 'Custom';
                container.appendChild(btn);
            });
            // reinitialize drag handlers
            this._setupDragItems();
        } catch (e) { console.warn('renderPresets failed', e); }
    }

    _bindCreateCustom() {
        const btn = document.getElementById('create-custom');
        if (!btn) return;
        if (btn.__bound) return; btn.__bound = true;
        btn.addEventListener('click', () => this._openCreateModal());
    }

    _openCreateModal() {
        // simple modal overlay
        try {
            if (document.getElementById('create-modal')) return; // already open
            const modal = document.createElement('div'); modal.id = 'create-modal'; modal.style.position = 'fixed'; modal.style.left = '0'; modal.style.top = '0'; modal.style.right = '0'; modal.style.bottom = '0'; modal.style.zIndex = '99999'; modal.style.display = 'flex'; modal.style.alignItems = 'center'; modal.style.justifyContent = 'center';
            const card = document.createElement('div'); card.style.width='560px'; card.style.padding='16px'; card.style.background='#0f1020'; card.style.borderRadius='8px'; card.style.border='1px solid rgba(255,255,255,0.03)';
            card.innerHTML = `
                <h3 style="margin-bottom:8px">Crear efecto personalizado</h3>
                <div style="display:flex;gap:8px;margin-bottom:8px">
                  <input id="preset-name" placeholder="Nombre del preset" style="flex:1;padding:8px;background:#05050a;border:1px solid rgba(255,255,255,0.03);color:#fff;border-radius:6px" />
                  <select id="preset-layer" style="width:160px;padding:8px;border-radius:6px;background:#05050a;border:1px solid rgba(255,255,255,0.03);color:#fff">
                    <option value="particle">Particles</option>
                    <option value="fx">FX (mojs)</option>
                    <option value="three">3D Mesh</option>
                  </select>
                </div>
                <div id="preset-params" style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px">
                  <label>Color <input id="preset-color" type="color" value="#00f0ff" style="margin-left:8px"/></label>
                  <label>Intensity <input id="preset-intensity" type="range" min="1" max="100" value="50"/></label>
                  <label>Count <input id="preset-count" type="range" min="1" max="200" value="24"/></label>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end">
                  <button id="preset-cancel" class="btn">Cancelar</button>
                  <button id="preset-save" class="btn">Guardar preset</button>
                </div>
            `;
            modal.appendChild(card); document.body.appendChild(modal);
            document.getElementById('preset-cancel').addEventListener('click', () => { modal.remove(); });
            document.getElementById('preset-save').addEventListener('click', () => {
                const name = document.getElementById('preset-name').value || 'Custom';
                const layer = document.getElementById('preset-layer').value;
                const color = document.getElementById('preset-color').value;
                const intensity = Number(document.getElementById('preset-intensity').value);
                const count = Number(document.getElementById('preset-count').value);
                const preset = { id: `preset-${Date.now()}`, name, layer, color, intensity, count };
                try { window.__VISUEFECT_PRESETS && window.__VISUEFECT_PRESETS.savePreset && window.__VISUEFECT_PRESETS.savePreset(preset); } catch (e) {}
                this._renderPresets();
                modal.remove();
            });
        } catch (e) { console.warn('openCreateModal failed', e); }
    }

    goToStep(step) {
        this.currentStep = step;
        console.log(`🚀 VISUEFECT - Paso ${step}: ${this.getStepName(step)}`);
        
        // Estirar (Stretch): Animamos la transición de la UI con Mo.js
        try { if (window.mojs) new window.mojs.Html({ el: document.body, duration: 350, scale: { 1: 1.01 } }).play(); } catch (e) {}
        this.updateControlPanel();
    }

    updateControlPanel() {
        document.querySelectorAll('[data-step]').forEach(el => {
            const step = Number(el.getAttribute('data-step')) || 1;
            el.style.opacity = (step === this.currentStep ? '1' : '0.35');
            el.disabled = step !== this.currentStep;
        });

        // quick diagnostic: ensure draggable items are active for the right step
        const dragItems = document.querySelectorAll('[data-drag-item]');
        dragItems.forEach(it => {
            if (this.currentStep === 2 && (it.getAttribute('data-drag-type') === 'particle' || it.getAttribute('data-drag-type') === 'fx')) {
                it.style.opacity = '1'; it.disabled = false;
            } else if (this.currentStep === 1 && it.getAttribute('data-drag-type') === 'three') {
                it.style.opacity = '1'; it.disabled = false;
            } else {
                it.style.opacity = '0.7';
            }
        });
    }

    handleDrop(e) {
        e.preventDefault();
        const type = e.dataTransfer.getData("item-type");
        const rect = document.querySelector('#viewport').getBoundingClientRect();
        const x = e.clientX - rect.left; const y = e.clientY - rect.top;
        
        // If a preset payload is present, spawn custom effect
        const presetPayload = e.dataTransfer.getData('preset');
        if (presetPayload) {
            try { const preset = JSON.parse(presetPayload); this.engine.addCustomEffect && this.engine.addCustomEffect(preset, x, y); return; } catch (err) { console.warn('spawn preset failed', err); }
        }

        // Inferencia inteligente de capa
        if (type === 'mesh' && typeof this.engine.addThreeMesh === 'function') this.engine.addThreeMesh();
        if (type === 'particles' && typeof this.engine.addPixiEmitter === 'function') this.engine.addPixiEmitter(x, y);
        if (type === 'burst' && typeof this.engine.addMojsBurst === 'function') this.engine.addMojsBurst(e.clientX, e.clientY);
    }
}

export default Interface;
