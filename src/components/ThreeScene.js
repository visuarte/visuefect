import * as THREE from 'three';

/**
 * ThreeScene(engine, opts)
 * - Añade una malla procedural brillante (TorusKnot) a la escena del engine
 * - Registra un updater para animarla
 * - Devuelve { dispose } para limpiar
 */
export default function ThreeScene(engine, opts = {}) {
  const cfg = Object.assign({ color: 0x00f0ff }, opts);

  // create mesh
  const geo = new THREE.TorusKnotGeometry(0.7, 0.22, 128, 24);
  const mat = new THREE.MeshStandardMaterial({
    color: cfg.color,
    metalness: 0.8,
    roughness: 0.15,
    emissive: 0x001824,
    emissiveIntensity: 0.9,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  engine.scene.add(mesh);

  // subtle light
  const light = new THREE.PointLight(cfg.color, 0.8, 6);
  light.position.set(2, 2, 2);
  engine.scene.add(light);

  // updater
  let tTotal = 0;
  const updater = (dt, t) => {
    tTotal += dt * 0.001;
    mesh.rotation.y += 0.0006 * dt;
    mesh.rotation.x += 0.0003 * dt;

    // pulsating emissive
    const i = 0.6 + Math.sin(tTotal * 2.0) * 0.35;
    mat.emissiveIntensity = Math.max(0.1, i);

    // subtle vertex wobble (CPU, cost low for this geom)
    const pos = geo.attributes.position;
    const count = pos.count;
    for (let i2 = 0; i2 < count; i2++) {
      const ix = i2 * 3;
      const ox = pos.array[ix];
      // apply tiny noise-like displacement along normal using sin(time + index)
      const n = 1 + 0.01 * Math.sin(tTotal * 6 + i2);
      pos.array[ix] = ox * n; // apply slight stretch in x
    }
    pos.needsUpdate = true;
  };

  engine.addThreeUpdater(updater);

  return {
    mesh,
    material: mat,
    dispose() {
      // remove updater
      if (engine._threeUpdaters) engine._threeUpdaters = engine._threeUpdaters.filter(f => f !== updater);
      try { engine.scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); } catch (e) { /* swallow */ }
      try { engine.scene.remove(light); } catch (e) {}
    }
  };
}
