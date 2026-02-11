/**
 * CodeGenerator.js
 * - collectParameters(engine, threeScene, pixiParticles, mojsEffects)
 * - generateTemplate(params)
 * - generateExportCode(engine, threeScene, pixiParticles, mojsEffects)
 *
 * Produce un string JS que importa librerías desde CDN, recrea la configuración visual
 * y exporta 5s de video .webm usando MediaRecorder sobre un canvas combinado.
 */

export function collectParameters(engine = {}, threeScene = null, pixiParticles = null, mojsEffects = null) {
  const params = {};

  // Viewport size and DPR
  try {
    const rect = engine.viewport ? engine.viewport.getBoundingClientRect() : { width: 800, height: 600 };
    params.width = Math.max(1, Math.floor(rect.width));
    params.height = Math.max(1, Math.floor(rect.height));
    params.dpr = window.devicePixelRatio || 1;
  } catch (e) {
    params.width = 800; params.height = 600; params.dpr = 1;
  }

  // THREE: camera & material info
  if (engine && engine.camera) {
    params.camera = {
      fov: engine.camera.fov,
      near: engine.camera.near,
      far: engine.camera.far,
      position: engine.camera.position ? { x: engine.camera.position.x, y: engine.camera.position.y, z: engine.camera.position.z } : null,
    };
  }
  // try to get mesh/material visual params
  const mesh = (threeScene && threeScene.mesh) || engine.defaultCube || null;
  if (mesh) {
    const mat = mesh.material || {};
    let color = '#00f0ff';
    if (mat.color) {
      if (mat.color.getHexString) color = `#${mat.color.getHexString()}`;
      else color = mat.color;
    }
    let emissive = '#001824';
    if (mat.emissive) {
      if (mat.emissive.getHexString) emissive = `#${mat.emissive.getHexString()}`;
      else emissive = mat.emissive;
    }
    params.three = {
      meshType: mesh.geometry ? mesh.geometry.type : 'BoxGeometry',
      color,
      emissive,
      emissiveIntensity: mat.emissiveIntensity || 0.8,
      rotationSpeed: mesh.userData && mesh.userData.rotationSpeed ? mesh.userData.rotationSpeed : 1.0,
    };
  }

  // PIXI: try to sample first graphics child for color and capture spawnRadius if available
  const pixiSample = { color: '#ffffff', spawnRadius: 6 };
  try {
    if (pixiParticles && pixiParticles.config) {
      pixiSample.spawnRadius = pixiParticles.config.spawnRadius || pixiSample.spawnRadius;
      if (pixiParticles.config.color) pixiSample.color = pixiParticles.config.color;
    }
    const root = engine.pixiRoot || (engine.pixiApp && engine.pixiApp.stage);
    if (root && root.children && root.children.length > 0) {
      const g = root.children[0];
      // attempt to read graphics fill color
      if (g && g.graphicsData && g.graphicsData[0] && g.graphicsData[0].shape) {
        const gd = g.graphicsData[0];
        if (gd.fillStyle && gd.fillStyle.color) {
          pixiSample.color = `#${gd.fillStyle.color.toString(16).padStart(6, '0')}`;
        }
      }
    }
  } catch (e) { /* ignore */ }
  params.pixi = pixiSample;

  // MOJS: try to sample stroke/fill from the 'lines' effect or first available
  const mojsSample = { lines: '#00f0ff', star: '#ff00a0', ring: '#8b63ff' };
  try {
    const effects = (mojsEffects && mojsEffects.effects) || {};
    for (const k of ['lines', 'star', 'ring']) {
      if (effects[k]) {
        // many mojs objects expose `o` or `opts` with children config
        const e = effects[k];
        let stroke = null;
        if (e && e.children && e.children[0] && e.children[0].stroke) stroke = e.children[0].stroke;
        if (!stroke && e && e.o && e.o.children && e.o.children.stroke) stroke = e.o.children.stroke;
        if (!stroke && e && e.opts && e.opts.children && e.opts.children.stroke) stroke = e.opts.children.stroke;
        if (stroke) mojsSample[k] = Array.isArray(stroke) ? stroke[0] : stroke;
      }
    }
  } catch (e) {}
  params.mojs = mojsSample;

  return params;
}

export function generateTemplate(params = {}) {
  const width = params.width || 800;
  const height = params.height || 600;
  const dpr = params.dpr || 1;

  const threeColor = params.three && params.three.color ? params.three.color : '#00f0ff';
  const threeEmissive = params.three && params.three.emissive ? params.three.emissive : '#001824';
  const rotationSpeed = params.three && params.three.rotationSpeed ? params.three.rotationSpeed : 1.0;

  const pixiColor = params.pixi && params.pixi.color ? params.pixi.color : '#ffffff';
  const pixiRadius = params.pixi && params.pixi.spawnRadius ? params.pixi.spawnRadius : 6;

  const mojsLines = params.mojs && params.mojs.lines ? params.mojs.lines : '#00f0ff';
  const mojsStar = params.mojs && params.mojs.star ? params.mojs.star : '#ff00a0';
  const mojsRing = params.mojs && params.mojs.ring ? params.mojs.ring : '#8b63ff';

  // Template string
  return `// Generated VISUEFECT snapshot
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as PIXI from 'pixi.js';
import mojs from '@mojs/core';

// Containers
const viewport = document.querySelector('#viewport') || (function(){ const d=document.createElement('div'); d.id='viewport'; document.body.appendChild(d); return d; })();
const threeCanvas = document.createElement('canvas'); threeCanvas.id = 'three-canvas'; viewport.appendChild(threeCanvas);
const pixiCanvas = document.createElement('canvas'); pixiCanvas.id = 'pixi-canvas'; viewport.appendChild(pixiCanvas);
const mojsOverlay = document.createElement('div'); mojsOverlay.id = 'mojs-overlay'; viewport.appendChild(mojsOverlay);

// Size
function fit() {
  const rect = viewport.getBoundingClientRect();
  const W = Math.max(1, Math.floor(rect.width));
  const H = Math.max(1, Math.floor(rect.height));
  threeCanvas.style.width = pixiCanvas.style.width = W + 'px';
  threeCanvas.style.height = pixiCanvas.style.height = H + 'px';
  threeRenderer.setSize(W,H,false); camera.aspect = W/H; camera.updateProjectionMatrix();
  pixiApp.renderer.resize(W,H);
}

// --- THREE ---
const threeRenderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true, alpha: true });
threeRenderer.setPixelRatio(${dpr});
threeRenderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, ${width}/${height}, 0.1, 1000);
camera.position.set(0,0,3);
const controls = new OrbitControls(camera, threeCanvas);
controls.enableDamping = true;
const geo = new THREE.TorusKnotGeometry(0.7,0.22,128,24);
const mat = new THREE.MeshStandardMaterial({ color: '${threeColor}', emissive: '${threeEmissive}', emissiveIntensity: ${rotationSpeed > 0 ? 0.9 : 0.6}, metalness: 0.8, roughness: 0.15, toneMapped:false });
const mesh = new THREE.Mesh(geo, mat);
scene.add(mesh);
scene.add(new THREE.HemisphereLight(0xffffff, 0x080820, 0.9));
const dir = new THREE.DirectionalLight(0xffffff, 0.5); dir.position.set(4,6,5); scene.add(dir);

// --- PIXI ---
const pixiApp = new PIXI.Application({ view: pixiCanvas, backgroundAlpha: 0, antialias: true, resolution: ${dpr}, autoDensity: true });
pixiApp.stage.sortableChildren = true;
const pixiRoot = new PIXI.Container(); pixiApp.stage.addChild(pixiRoot);

function spawnParticle(x,y){
  const g=new PIXI.Graphics(); try { g.fill({ color: Number('0x' + '${pixiColor}'.replace('#','')), alpha: 1 }); g.circle(0,0,${pixiRadius}); } catch (e) { g.beginFill(Number('0x' + '${pixiColor}'.replace('#','')),1); g.drawCircle(0,0,${pixiRadius}); g.endFill(); } g.x=x; g.y=y; g.vx=(Math.random()-0.5)*2; g.vy=(Math.random()-0.5)*2-0.6; g.life=80+Math.floor(Math.random()*60); g.alpha=1; g.scale.set(0.8+Math.random()*0.6); pixiRoot.addChild(g); return g;
}

// --- MOJS ---
const mojsParent = mojsOverlay;
const burstLines = new mojs.Burst({ parent: mojsParent, left:0, top:0, radius:{0:120}, count:18, children:{ shape:'line', stroke:'${mojsLines}', strokeWidth:{6:0}, duration:700, angle:{0:360}, easing:'cubic.out' } });
const burstStar  = new mojs.Burst({ parent: mojsParent, left:0, top:0, radius:{0:90}, count:24, children:{ shape:'line', stroke:'${mojsStar}', strokeWidth:{4:0}, duration:850, angle:{0:260}, easing:'quint.out' } });
const burstRing  = new mojs.Burst({ parent: mojsParent, left:0, top:0, radius:{0:150}, count:32, children:{ shape:'line', stroke:'${mojsRing}', strokeWidth:{2:0}, duration:900, easing:'cubic.out' } });

function trigger(name, cx, cy) {
  const pos = viewport.getBoundingClientRect();
  const x = cx - pos.left; const y = cy - pos.top;
  if (name === 'lines') burstLines.tune({x,y}).replay();
  if (name === 'star') burstStar.tune({x,y}).replay();
  if (name === 'ring') burstRing.tune({x,y}).replay();
}

// Animation loop
let last = performance.now();
function animate(now){
  const dt = now - last; last = now;
  mesh.rotation.y += 0.001 * dt * ${rotationSpeed};
  mesh.rotation.x += 0.0006 * dt * ${rotationSpeed};
  controls.update();
  threeRenderer.render(scene, camera);
  // pixi update: simple lifespan decay
  for (let i = pixiRoot.children.length-1; i>=0; i--){ const p=pixiRoot.children[i]; p.vy+=0.03; p.x+=p.vx*dt*0.06; p.y+=p.vy*dt*0.06; p.life-=Math.max(1,dt*0.06); p.alpha=Math.max(0,p.life/120); p.scale.x=p.scale.y=Math.max(0.2,p.life/140); if(p.life<=0||p.y>pixiApp.renderer.height+30){ try{pixiRoot.removeChild(p);}catch(e){} } }
  pixiApp.render();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// --- Export to Video ---
export async function exportToVideo(durationSeconds = 5, fps = 30) {
  const rect = viewport.getBoundingClientRect();
  const W = Math.max(1, Math.floor(rect.width)); const H = Math.max(1, Math.floor(rect.height));
  const off = document.createElement('canvas'); off.width = W; off.height = H; const ctx = off.getContext('2d');
  const stream = off.captureStream(fps);
  const recorded = [];
  const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
  mr.ondataavailable = (e) => { if (e.data && e.data.size) recorded.push(e.data); };
  mr.start();

  const start = performance.now();
  await new Promise((resolve) => {
    function tick() {
      // composite current frames
      ctx.clearRect(0,0,W,H);
      try { ctx.drawImage(document.getElementById('three-canvas'), 0, 0, W, H); } catch (e) {}
      try { ctx.drawImage(document.getElementById('pixi-canvas'), 0, 0, W, H); } catch (e) {}
      // attempt to draw mojs if it has a canvas child
      const mojsCanvas = mojsParent.querySelector('canvas');
      if (mojsCanvas) try { ctx.drawImage(mojsCanvas, 0, 0, W, H); } catch (e) {}

      if ((performance.now() - start) < durationSeconds * 1000) requestAnimationFrame(tick);
      else setTimeout(resolve, 200);
    }
    tick();
  });

  mr.stop();

  return await new Promise((resolve) => { mr.onstop = () => {
    const blob = new Blob(recorded, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'visuefect_capture.webm'; a.click(); URL.revokeObjectURL(url);
    resolve(blob);
  }; });
}
`;
}

/** Convenience: generate a JS string snapshot from live instances */
export function generateExportCode(engine, threeScene = null, pixiParticles = null, mojsEffects = null) {
  const params = collectParameters(engine, threeScene, pixiParticles, mojsEffects);
  return generateTemplate(params);
}
