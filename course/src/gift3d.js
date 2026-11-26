// Real-time 3D gift effects (Three.js / WebGL). Loaded on demand by GiftOverlay so the
// main bundle stays small. Every model is built from primitives here: no external assets.
import * as THREE from 'three';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOutBack = (x) => { const c = 1.70158; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25, ...extra });
}

// ---------- particles -------------------------------------------------------
function particleSystem(count, palette, size = 0.12) {
  const geometry = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) { c.set(palette[i % palette.length]); col.set([c.r, c.g, c.b], i * 3); }
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const material = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, map: sparkTexture() });
  const points = new THREE.Points(geometry, material);
  points.userData.vel = new Float32Array(count * 3);
  points.userData.life = new Float32Array(count);
  return points;
}

let spark;
function sparkTexture() {
  if (spark) return spark;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,.8)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  spark = new THREE.CanvasTexture(canvas);
  return spark;
}

function burst(points, origin, speed, from = 0, to = points.userData.life.length) {
  const p = points.geometry.attributes.position.array; const v = points.userData.vel; const life = points.userData.life;
  for (let i = from; i < to; i++) {
    const u = Math.random() * 2 - 1; const a = Math.random() * Math.PI * 2; const r = Math.sqrt(1 - u * u);
    const s = speed * (0.6 + Math.random() * 0.4);
    p.set([origin.x, origin.y, origin.z], i * 3);
    v.set([r * Math.cos(a) * s, u * s, r * Math.sin(a) * s], i * 3);
    life[i] = 1;
  }
  points.geometry.attributes.position.needsUpdate = true;
}

function stepParticles(points, dt, gravity = -2.5, fade = 0.5) {
  const p = points.geometry.attributes.position.array; const v = points.userData.vel; const life = points.userData.life;
  for (let i = 0; i < life.length; i++) {
    if (life[i] <= 0) continue;
    v[i * 3 + 1] += gravity * dt;
    p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
    life[i] -= dt * fade;
    if (life[i] <= 0) p[i * 3 + 1] = -999;
  }
  points.geometry.attributes.position.needsUpdate = true;
}

// ---------- models ------------------------------------------------------------
function heartShape(scale = 1) {
  const s = new THREE.Shape();
  s.moveTo(0, -1.1 * scale);
  s.bezierCurveTo(-0.2 * scale, -0.75 * scale, -1.4 * scale, -0.2 * scale, -1.2 * scale, 0.45 * scale);
  s.bezierCurveTo(-1.0 * scale, 1.1 * scale, -0.15 * scale, 1.15 * scale, 0, 0.55 * scale);
  s.bezierCurveTo(0.15 * scale, 1.15 * scale, 1.0 * scale, 1.1 * scale, 1.2 * scale, 0.45 * scale);
  s.bezierCurveTo(1.4 * scale, -0.2 * scale, 0.2 * scale, -0.75 * scale, 0, -1.1 * scale);
  return s;
}

function makeHeart() {
  const geo = new THREE.ExtrudeGeometry(heartShape(1), { depth: 0.55, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.18, bevelSegments: 8, curveSegments: 32 });
  geo.center();
  const heart = new THREE.Mesh(geo, std('#ff3d7f', { emissive: '#7a0030', emissiveIntensity: 0.35, roughness: 0.18, metalness: 0.15 }));
  const group = new THREE.Group(); group.add(heart);
  return { group, update(t) { heart.rotation.y = t * Math.PI * 4; const beat = 1 + Math.max(0, Math.sin(t * Math.PI * 10)) * 0.12; heart.scale.setScalar(beat); } };
}

function makeRose() {
  const group = new THREE.Group();
  const petalMat = std('#e8204f', { side: THREE.DoubleSide, emissive: '#5a0018', emissiveIntensity: 0.3, roughness: 0.5 });
  const bloom = new THREE.Group();
  for (let i = 0; i < 22; i++) {
    const ring = Math.floor(i / 6); const a = i * 2.39996;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16, 0, Math.PI), petalMat);
    petal.scale.set(0.75 + ring * 0.18, 1.05 + ring * 0.12, 0.35);
    petal.position.set(Math.cos(a) * 0.12 * ring, 0.05 * ring, Math.sin(a) * 0.12 * ring);
    petal.rotation.set(-0.35 - ring * 0.32, a, 0);
    bloom.add(petal);
  }
  bloom.position.y = 0.9;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 12), std('#2f9e55'));
  stem.position.y = -0.55;
  const leafGeo = new THREE.SphereGeometry(0.45, 16, 12); const leafMat = std('#3fc46d');
  const leaf1 = new THREE.Mesh(leafGeo, leafMat); leaf1.scale.set(1, 0.25, 0.5); leaf1.position.set(0.42, -0.6, 0); leaf1.rotation.z = 0.5;
  const leaf2 = leaf1.clone(); leaf2.position.set(-0.42, -0.2, 0); leaf2.rotation.z = -0.5;
  group.add(bloom, stem, leaf1, leaf2);
  return { group, update(t) { group.rotation.y = Math.sin(t * Math.PI * 2) * 0.9; group.rotation.z = Math.sin(t * Math.PI * 4) * 0.08; bloom.scale.setScalar(0.85 + easeOutBack(clamp01(t * 3)) * 0.15); } };
}

function makeRocket() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 2.0, 32), std('#e9f3ff', { metalness: 0.6, roughness: 0.25 }));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 32), std('#ff4d6d'));
  nose.position.y = 1.45;
  const window = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 12, 32), std('#3de0d0', { metalness: 0.8 }));
  window.position.set(0, 0.35, 0.47);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), std('#1a2d6b', { emissive: '#2b5bd9', emissiveIntensity: 0.6 }));
  glass.position.set(0, 0.35, 0.475);
  group.add(body, nose, window, glass);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.55), std('#ff4d6d'));
    const a = (i / 3) * Math.PI * 2; fin.position.set(Math.sin(a) * 0.5, -0.8, Math.cos(a) * 0.5); fin.rotation.y = a;
    group.add(fin);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.1, 24), new THREE.MeshBasicMaterial({ color: '#ffb23d', transparent: true, opacity: 0.9 }));
  flame.rotation.x = Math.PI; flame.position.y = -1.55;
  group.add(flame);
  const trail = particleSystem(260, ['#ffcf5a', '#ff7a3d', '#ffffff'], 0.22);
  let next = 0;
  return {
    group, extras: [trail],
    update(t, dt) {
      const y = -4.5 + easeInOut(t) * 9.5;
      group.position.set(Math.sin(t * Math.PI * 3) * 0.6, y, 0);
      group.rotation.y = t * Math.PI * 6;
      group.rotation.z = Math.sin(t * Math.PI * 3) * -0.15;
      flame.scale.set(1, 0.8 + Math.random() * 0.5, 1);
      const p = trail.geometry.attributes.position.array; const v = trail.userData.vel; const life = trail.userData.life;
      for (let k = 0; k < 6; k++) {
        const i = next++ % life.length;
        p.set([group.position.x + (Math.random() - 0.5) * 0.3, y - 1.6, (Math.random() - 0.5) * 0.3], i * 3);
        v.set([(Math.random() - 0.5) * 1.2, -2 - Math.random() * 2, (Math.random() - 0.5) * 1.2], i * 3); life[i] = 1;
      }
      stepParticles(trail, dt, 0, 1.4);
    },
  };
}

function makeCar() {
  const group = new THREE.Group();
  const paint = std('#ff2e74', { metalness: 0.7, roughness: 0.2, emissive: '#4a0020', emissiveIntensity: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.55, 1.5), paint); body.position.y = 0.1;
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.5, 24, 1, false, 0, Math.PI), paint);
  nose.rotation.x = Math.PI / 2; nose.rotation.z = -Math.PI / 2; nose.position.set(1.7, 0.1, 0);
  const cabin = new THREE.Mesh(new THREE.SphereGeometry(0.85, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), std('#17324f', { metalness: 0.9, roughness: 0.05, emissive: '#2a7bd1', emissiveIntensity: 0.25 }));
  cabin.scale.set(1.35, 0.75, 0.85); cabin.position.set(-0.2, 0.35, 0);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.45, 1.5), paint); spoiler.position.set(-1.6, 0.55, 0);
  group.add(body, nose, cabin, spoiler);
  const wheels = [];
  for (const [x, z] of [[1.1, 0.78], [1.1, -0.78], [-1.1, 0.78], [-1.1, -0.78]]) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.14, 12, 24), std('#121722', { roughness: 0.8 }));
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 12), std('#d9e6f7', { metalness: 1, roughness: 0.2 }));
    rim.rotation.x = Math.PI / 2;
    wheel.add(tire, rim); wheel.position.set(x, -0.25, z); group.add(wheel); wheels.push(wheel);
  }
  for (const z of [0.5, -0.5]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff4b0' }));
    lamp.position.set(1.95, 0.2, z); group.add(lamp);
  }
  const lines = particleSystem(120, ['#7ef3ff', '#ffffff'], 0.15);
  return {
    group, extras: [lines],
    update(t, dt) {
      // Drive in (0–35%), showcase spin in the centre (35–70%), drive off (70–100%).
      const x = t < 0.35 ? -9 + easeInOut(t / 0.35) * 9 : t < 0.7 ? 0 : easeInOut((t - 0.7) / 0.3) * 10;
      const spin = t < 0.35 ? 0 : t < 0.7 ? easeInOut((t - 0.35) / 0.35) * Math.PI * 2 : Math.PI * 2;
      group.rotation.y = -0.35 + spin;
      group.position.set(x, -0.3 + Math.abs(Math.sin(t * 40)) * 0.05, 0);
      const moving = t < 0.35 || t > 0.7;
      for (const w of wheels) w.rotation.z -= dt * (moving ? 22 : 4);
      const p = lines.geometry.attributes.position.array; const v = lines.userData.vel; const life = lines.userData.life;
      for (let k = 0; k < (moving ? 3 : 0); k++) {
        const i = Math.floor(Math.random() * life.length);
        p.set([x - 1.8, -0.4 + Math.random() * 1.2, (Math.random() - 0.5) * 1.5], i * 3); v.set([-6, 0, 0], i * 3); life[i] = 1;
      }
      stepParticles(lines, dt, 0, 2.2);
    },
  };
}

function makeParty() {
  const group = new THREE.Group();
  const star = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), std('#ffd35a', { metalness: 0.9, roughness: 0.15, emissive: '#ff9b1f', emissiveIntensity: 0.5, flatShading: true }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.06, 12, 80), new THREE.MeshBasicMaterial({ color: '#79efff' }));
  group.add(star, ring);
  const fireworks = particleSystem(900, ['#ff4d88', '#ffe066', '#79efff', '#a98bff', '#ffffff'], 0.28);
  const shots = [0.05, 0.22, 0.4, 0.58, 0.75];
  let fired = 0;
  return {
    group, extras: [fireworks],
    update(t, dt) {
      star.rotation.set(t * 6, t * 8, 0); ring.rotation.set(Math.PI / 2.3 + Math.sin(t * 6) * 0.2, t * 3, 0);
      while (fired < shots.length && t >= shots[fired]) {
        const n = 180; burst(fireworks, new THREE.Vector3((Math.random() - 0.5) * 6, 0.5 + Math.random() * 2, (Math.random() - 0.5) * 2), 4.5, fired * n, fired * n + n); fired++;
      }
      stepParticles(fireworks, dt, -2.2, 0.55);
    },
  };
}

function makeCarnival() {
  const group = new THREE.Group();
  const wheel = new THREE.Group();
  const gold = std('#ffd77a', { metalness: 0.8, roughness: 0.25, emissive: '#7a4b00', emissiveIntensity: 0.25 });
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(2, 0.07, 10, 96), gold));
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.05, 10, 72), gold));
  const cabins = [];
  const colors = ['#ff7ab6', '#69e4e8', '#a98bff', '#ffe066'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2, 6), gold);
    spoke.position.set(Math.cos(a), Math.sin(a), 0); spoke.rotation.z = a - Math.PI / 2; wheel.add(spoke);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), std(colors[i % 4], { emissive: colors[i % 4], emissiveIntensity: 0.35 }));
    cabin.position.set(Math.cos(a) * 2, Math.sin(a) * 2, 0); wheel.add(cabin); cabins.push(cabin);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff6c8' }));
    bulb.position.set(Math.cos(a + 0.26) * 2, Math.sin(a + 0.26) * 2, 0.05); wheel.add(bulb);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 24), gold); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  wheel.position.y = 0.6;
  const legMat = std('#d784b0');
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.2, 8), legMat);
    leg.position.set(s * 0.8, -0.85, 0.3); leg.rotation.z = s * 0.45; group.add(leg);
    const leg2 = leg.clone(); leg2.position.z = -0.3; group.add(leg2);
  }
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.08, 48), std('#2a2160', { emissive: '#3b1e7a', emissiveIntensity: 0.4 }));
  ground.position.y = -2.45;
  group.add(wheel, ground);
  const sky = particleSystem(1200, ['#ff4d88', '#ffe066', '#79efff', '#a98bff', '#ffffff', '#ffb46b'], 0.26);
  const shots = [0.08, 0.2, 0.32, 0.44, 0.56, 0.68];
  let fired = 0;
  return {
    group, extras: [sky], orbit: true,
    update(t, dt) {
      wheel.rotation.z = t * Math.PI * 2.2;
      for (const c of cabins) c.rotation.z = -wheel.rotation.z;
      while (fired < shots.length && t >= shots[fired]) {
        const n = 200; burst(sky, new THREE.Vector3((Math.random() - 0.5) * 8, 2 + Math.random() * 1.5, -1 - Math.random() * 2), 4, fired * n, fired * n + n); fired++;
      }
      stepParticles(sky, dt, -1.8, 0.5);
    },
  };
}

export const BUILDERS = { heart: makeHeart, rose: makeRose, rocket: makeRocket, car: makeCar, party: makeParty, carnival: makeCarnival };
// Models that fly across the stage manage their own position; the rest pop in at the centre.
const TRAVELS = new Set(['rocket', 'car']);

export function supportsWebGL() {
  try { const c = document.createElement('canvas'); return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
  catch { return false; }
}

// Plays one gift inside `container` for `duration` ms; returns a stop() function.
// A fresh canvas is created per gift because its WebGL context is released afterwards.
export function playGift3D(container, kind, duration) {
  const build = BUILDERS[kind] || makeHeart;
  const canvas = document.createElement('canvas');
  canvas.className = 'gift-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0.4, 9);
  scene.add(new THREE.HemisphereLight('#ffffff', '#3a2a6b', 1.2));
  const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(3, 5, 6); scene.add(key);
  const rim = new THREE.PointLight('#7ef3ff', 30, 20); rim.position.set(-4, 2, -2); scene.add(rim);
  const warm = new THREE.PointLight('#ff6fb1', 25, 20); warm.position.set(4, -2, 3); scene.add(warm);
  const model = build();
  scene.add(model.group);
  for (const e of model.extras || []) scene.add(e);

  function resize() {
    const w = canvas.clientWidth || 640; const h = canvas.clientHeight || 360;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.position.z = w / h < 1 ? 13 : 9; // portrait phones: pull back so the model fits
    camera.updateProjectionMatrix();
  }
  resize();
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(canvas);

  const start = performance.now(); let last = start; let frame = 0; let stopped = false;
  function tick(now) {
    if (stopped) return;
    const t = clamp01((now - start) / duration); const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const enter = easeOutBack(clamp01(t / 0.18)); const exit = 1 - clamp01((t - 0.86) / 0.14);
    if (!TRAVELS.has(kind)) { model.group.scale.setScalar(Math.max(0.001, enter * exit)); model.group.position.y = Math.sin(t * Math.PI * 4) * 0.12; }
    model.update(t, dt);
    if (model.orbit) { camera.position.x = Math.sin(t * Math.PI) * 2.5; camera.lookAt(0, 0.3, 0); }
    for (const e of model.extras || []) e.material.opacity = exit;
    renderer.render(scene, camera);
    if (t < 1) frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);

  return function stop() {
    stopped = true; cancelAnimationFrame(frame); observer?.disconnect();
    scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
    renderer.dispose();
    renderer.forceContextLoss(); // browsers cap live WebGL contexts; free it for the next gift
    canvas.remove();
  };
}
