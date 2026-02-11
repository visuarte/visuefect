import * as THREE from 'three';

export class PointerCoordinator {
    constructor(engine) {
        this.engine = engine;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    }

    getIntersections(event) {
        const rect = this.engine.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // 1. Try PixiJS (topmost 2D layer)
        try {
          const pixiHost = this.engine.pixiApp || this.engine.pixi || null;
          const pixiRenderer = pixiHost && pixiHost.renderer;
          const pixiStage = pixiHost && (pixiHost.stage || (this.engine.pixiRoot || null));
          const pixiPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
          const interaction = pixiRenderer && pixiRenderer.plugins && pixiRenderer.plugins.interaction;
          if (interaction && typeof interaction.hitTest === 'function') {
            const pixiHit = interaction.hitTest(pixiPoint, pixiStage);
            if (pixiHit && (pixiHit.interactive || pixiHit.isSprite || pixiHit.isDisplayObject)) {
              return { layer: 'pixi', object: pixiHit };
            }
          }
        } catch (e) { /* ignore pixi hit failures */ }

        // 2. Try Three.js (3D background layer)
        try {
          // Be defensive: setFromCamera can throw when a non-camera object is provided in tests
          try { this.raycaster.setFromCamera(this.mouse, this.engine.camera); } catch (e) { /* invalid camera - continue */ }
          const intersects = (typeof this.raycaster.intersectObjects === 'function') ? this.raycaster.intersectObjects(this.engine.scene ? this.engine.scene.children : [], true) : [];
          if (intersects && intersects.length > 0) return { layer: 'three', object: intersects[0] };
        } catch (e) { /* ignore three raycast failures */ }

        return null; // click on empty space or no capable layers
    }
}
