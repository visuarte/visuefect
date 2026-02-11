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
        // Setup global debug flag (toggleable via Interface.setDebug)
        try { if (typeof window !== 'undefined') { window.__VISUEFECT = window.__VISUEFECT || {}; window.__VISUEFECT.debug = !!window.__VISUEFECT.debug; } } catch (e) {}
        this.initEventListeners();
    }

    initEventListeners() {
        if (this._listenersInit) return;
        this._listenersInit = true;
        if (typeof window !== 'undefined' && window.__VISUEFECT && window.__VISUEFECT.debug) console.log('Interface: initEventListeners');
        document.querySelectorAll('.step-btn').forEach(btn => {
            btn.addEventListener('click', (e) => { try { if (typeof window !== 'undefined' && window.__VISUEFECT && window.__VISUEFECT.debug) console.log('Interface: step-btn click', e.currentTarget.dataset.step); this.goToStep(parseInt(e.currentTarget.dataset.step)); } catch (err) { console.warn('Interface step click failed', err); } });
        });

        // Drag & Drop Listener
        const dropzone = document.querySelector('#viewport');
        // ensure defensive checks for missing element
        if (dropzone && dropzone.addEventListener) {
            dropzone.addEventListener('dragover', (e) => e.preventDefault());
            dropzone.addEventListener('drop', (e) => this.handleDrop(e));
        }

        // Debug toggle (UI) with localStorage persistence
        try {
            const dbgBtn = document.getElementById('debug-toggle');
            if (dbgBtn) {
                let init = false;
                try { const stored = (typeof localStorage !== 'undefined') ? localStorage.getItem('visuefect:debug') : null; if (stored !== null) init = (stored === '1'); else init = !!(typeof window !== 'undefined' && window.__VISUEFECT && window.__VISUEFECT.debug); } catch (e) { init = !!(typeof window !== 'undefined' && window.__VISUEFECT && window.__VISUEFECT.debug); }
                // set initial global flag
                try { if (typeof window !== 'undefined') { window.__VISUEFECT = window.__VISUEFECT || {}; window.__VISUEFECT.debug = init; } } catch (e) {}
                dbgBtn.textContent = 'Debug: ' + (init ? 'On' : 'Off');
                // style indicator
                dbgBtn.style.transition = 'background .18s ease, color .18s ease';
                dbgBtn.style.background = init ? 'linear-gradient(90deg,#00e676,#00c853)' : '';
                dbgBtn.style.color = init ? '#000' : '';
                dbgBtn.addEventListener('click', (ev) => {
                    try {
                        const enabled = !((typeof window !== 'undefined' && window.__VISUEFECT && window.__VISUEFECT.debug));
                        this.setDebug(enabled);
                        dbgBtn.textContent = 'Debug: ' + (enabled ? 'On' : 'Off');
                        dbgBtn.style.background = enabled ? 'linear-gradient(90deg,#00e676,#00c853)' : '';
                        dbgBtn.style.color = enabled ? '#000' : '';
                    } catch (e) { console.warn('debug toggle failed', e); }
                });
            }
        } catch (e) {}

        // Setup draggable items in the sidebar
        this._setupDragItems();
    }

    _setupDragItems() {
        document.querySelectorAll('[data-drag-item]').forEach(el => {
            el.setAttribute('draggable', 'true');
            // ensure click doesn't immediately activate navigation/other effects
            el.addEventListener('dragstart', (ev) => {
                const type = el.getAttribute('data-drag-type') || 'generic';
                const item = el.getAttribute('data-drag-item') || '';
                if (typeof window !== 'undefined' && window.__VISUEFECT && window.__VISUEFECT.debug) console.log('Interface: dragstart', { type, item });
                // normalize payload as JSON for cross-browser compatibility
                try { ev.dataTransfer.setData('application/json', JSON.stringify({ type, item })); } catch (e) {}
                // legacy keys for compatibility
                try { ev.dataTransfer.setData('item-type', type); } catch (e) {}
                try { ev.dataTransfer.setData('item', item); } catch (e) {}
                // set a visible drag image if available
                if (ev.dataTransfer.setDragImage && el instanceof HTMLElement) {
                    const img = document.createElement('canvas'); img.width = 80; img.height = 32; const ctx = img.getContext('2d'); ctx.fillStyle = '#00f0ff'; ctx.fillRect(0,0,80,32); ctx.fillStyle = '#000'; ctx.fillText(item,8,20); ev.dataTransfer.setDragImage(img, 40,16);
                }
            });
        });
    }

    getStepName(step) {
        if (step === 1) return 'ATMOSPHERE';
        if (step === 2) return 'DYNAMICS';
        if (step === 3) return 'ACCENTS';
        return 'EXPORT';
    }

    goToStep(step) {
        this.currentStep = step;
        if (typeof window !== 'undefined' && window.__VISUEFECT && window.__VISUEFECT.debug) console.log(`🚀 VISUEFECT - Paso ${step}: ${this.getStepName(step)}`);
        
        // Estirar (Stretch): Animamos la transición de la UI con Mo.js
        try { if (window.mojs) new window.mojs.Html({ el: document.body, duration: 350, scale: { 1: 1.01 } }).play(); } catch (e) {}
        this.updateControlPanel();
    }

    setDebug(enabled = true) {
        try { if (typeof window !== 'undefined') { window.__VISUEFECT = window.__VISUEFECT || {}; window.__VISUEFECT.debug = !!enabled; } } catch (e) {}
        try { if (typeof localStorage !== 'undefined') localStorage.setItem('visuefect:debug', enabled ? '1' : '0'); } catch (e) {}
        // update debug button style if present
        try {
            const dbgBtn = document.getElementById('debug-toggle');
            if (dbgBtn) {
                dbgBtn.style.background = enabled ? 'linear-gradient(90deg,#00e676,#00c853)' : '';
                dbgBtn.style.color = enabled ? '#000' : '';
            }
        } catch (e) {}
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
        // Prefer structured JSON payload
        let payload = null;
        try { const j = e.dataTransfer.getData('application/json'); if (j) payload = JSON.parse(j); } catch (err) { payload = null; }
        const legacyType = e.dataTransfer.getData('item-type') || e.dataTransfer.getData('type') || '';
        const type = (payload && payload.type) ? payload.type : legacyType;
        const rect = document.querySelector('#viewport').getBoundingClientRect();
        const x = e.clientX - rect.left; const y = e.clientY - rect.top;
        if (typeof window !== 'undefined' && window.__VISUEFECT && window.__VISUEFECT.debug) console.log('Interface: drop', { type, payload, x, y, types: Array.from(e.dataTransfer.types || []) });
        
        // Inferencia inteligente de capa — aceptamos varias etiquetas por compatibilidad
        if ((type === 'mesh' || type === 'three') && typeof this.engine.addThreeMesh === 'function') this.engine.addThreeMesh();
        if ((type === 'particles' || type === 'particle') && typeof this.engine.addPixiEmitter === 'function') this.engine.addPixiEmitter(x, y);
        if ((type === 'burst' || type === 'fx' || type === 'lines' || type === 'star') && typeof this.engine.addMojsBurst === 'function') this.engine.addMojsBurst(e.clientX, e.clientY);
    }
}

export default Interface;
