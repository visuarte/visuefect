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
        
        // Inferencia inteligente de capa
        if (type === 'mesh' && typeof this.engine.addThreeMesh === 'function') this.engine.addThreeMesh();
        if (type === 'particles' && typeof this.engine.addPixiEmitter === 'function') this.engine.addPixiEmitter(x, y);
        if (type === 'burst' && typeof this.engine.addMojsBurst === 'function') this.engine.addMojsBurst(e.clientX, e.clientY);
    }
}

export default Interface;
