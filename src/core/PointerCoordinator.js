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

        // 1. Probar PixiJS (Capa superior 2D)
        try {
            const pixiPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
            const pixiHit = this.engine.pixi.renderer.plugins.interaction.hitTest(pixiPoint, this.engine.pixi.stage);
            if (pixiHit && pixiHit.interactive) {
                return { layer: 'pixi', object: pixiHit };
            }
        } catch (e) {
            // Interaction plugin might not be available or hitTest signature may vary
        }

        // 2. Probar Three.js (Capa fondo 3D)
        this.raycaster.setFromCamera(this.mouse, this.engine.camera);
        const intersects = this.raycaster.intersectObjects(this.engine.scene.children, true);

        if (intersects.length > 0) {
            return { layer: 'three', object: intersects[0] };
        }

        return null; // Clic al vacío
    }
}
