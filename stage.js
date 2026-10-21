// Fixed WebGL stage behind the page. Each chapter is a keyframe (camera, pod pose, explode, props); the page scroll
// position blends between keyframes, so scrolling feels like moving through one continuous product film.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createPod } from './pod.js';
import { buildDock, buildWatch, buildWrist, buildSkin, buildBeams, fadeable } from './props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export async function createStage(canvas, D, boards, onProgress = () => {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  const DPR = Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setClearColor(0x0a0a0b, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0b);
  // studio environment: room env + extra soft boxes for long highlights on the metal and the black ceramic
  const envScene = new RoomEnvironment();
  const box = (w, h, x, y, z, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m); };
  box(12, 2.2, 0, 9, 3, 2.6); box(2.4, 10, -9, 2, 4, 1.4); box(10, 1.4, 4, -6, 8, 1.6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.03).texture;
  scene.environmentIntensity = 0.85;
  scene.environmentRotation = new THREE.Euler(Math.PI / 2, 0, 0);

  const camera = new THREE.PerspectiveCamera(26, 1, 1, 3000);
  camera.up.set(0, 0, 1);

  const key = new THREE.DirectionalLight(0xfff3e6, 2.6);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 9; key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.03;
  Object.assign(key.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 600 });
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xa9c8ff, 1.2); rim.position.set(-60, 80, 30); scene.add(rim);
  const fill = new THREE.HemisphereLight(0xffffff, 0x1a1a1c, 0.25); scene.add(fill);

  // floor: soft vignette disc that only shows shadows and a faint gradient
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.55 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(900, 96), floorMat); floor.receiveShadow = true; scene.add(floor);
  const vig = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
    const g = x.createRadialGradient(512, 512, 0, 512, 512, 512); g.addColorStop(0, 'rgba(255,255,255,0.018)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 1024); const t = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, dithering: true }));
    m.visible = false; scene.add(m); return m;
  })();

  // ---------------- models ----------------
  const POD = createPod(D);
  const P = D.params, H = P.H;
  onProgress(0.35, 'Building Pulse Pod…');
  await POD.loadAll(boards);
  onProgress(0.8, 'Almost there…');
  // promo finish: deep ceramic black skin cap with soft clearcoat; satin titanium lid
  Object.assign(POD.MAT.cup, { roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.25, specularIntensity: 0.25, envMapIntensity: 0.4, side: THREE.DoubleSide });
  POD.MAT.cup.color.set(0x0b0c0e);
  POD.MAT.lid.color.set(0x3c3f44); Object.assign(POD.MAT.lid, { metalness: 0.8, roughness: 0.42, envMapIntensity: 0.55 });
  POD.MAT.gold.roughness = 0.14;
  POD.MAT.cell.color.set(0x8e939b); POD.MAT.cell.envMapIntensity = 0.6;
  POD.bodies.attach.visible = false;
  POD.pod.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // pivot: the pod rotates about its own centre (case frame z from 0..H)
  const podRig = new THREE.Group(); podRig.add(POD.pod); POD.pod.position.z = -H / 2; scene.add(podRig);
  const beams = buildBeams(D, H); POD.pod.add(beams.group); beams.set(0);

  const dock = buildDock(D); scene.add(dock.group);
  const watch = buildWatch(); const wrist = buildWrist(watch, H); scene.add(wrist.group);
  const skin = buildSkin(); scene.add(skin.group);
  const F = { dock: fadeable(dock.group), wrist: fadeable(wrist.group), skin: fadeable(skin.group) };

  // cutaway materials for the pod in the "inside" + "sense" scenes
  const xrayMats = [POD.MAT.cup, POD.MAT.lid];
  function setXray(k) {
    for (const m of xrayMats) {
      const on = k > 0.001;
      if (m.transparent !== on) { m.transparent = on; m.needsUpdate = true; }
      m.opacity = 1 - 0.86 * k; m.depthWrite = k < 0.5;
    }
  }

  // ---------------- keyframes ----------------
  // pod pose: position of the pod centre + Euler (rad); explode 0..1; props alpha; extra effects.
  const WT = wrist.wristTop;
  const SK = { // skin-down pod on the skin: centre at H/2 above the skin top (z=0)
    pos: V(0, 0, H / 2), rot: [Math.PI, 0, 0],
  };
  const K = {
    hero:   { off: 0.2, cam: V(44, -84, 50), tgt: V(0, 0, 4), pos: V(0, 0, 9), rot: [Math.PI - 0.9, 0.15, 0.6], explode: 0, xray: 0, spin: 0.12, floor: -14, dock: 0, wrist: 0, skin: 0, beams: 0, glow: 0, fov: 26 },
    thin:   { off: 0.17, cam: V(0, -150, 4), tgt: V(0, 0, 4), pos: V(0, 0, 4), rot: [0, 0, 0.0], explode: 0, xray: 0, spin: 0, floor: -14, dock: 0, wrist: 0, skin: 0, beams: 0, glow: 0, fov: 16, annoThin: 1 },
    inside: { off: -0.2, cam: V(84, -118, 84), tgt: V(0, 0, 6), pos: V(0, 0, 6), rot: [-0.25, 0, 0.35], explode: 1, xray: 0, spin: 0.05, floor: -26, dock: 0, wrist: 0, skin: 0, beams: 0, glow: 0, fov: 26, annoInside: 1 },
    sense:  { off: 0.2, cam: V(16, -64, 9), tgt: V(0, 4, -1.6), pos: SK.pos, rot: SK.rot, explode: 0, xray: 1, spin: 0, floor: -12, dock: 0, wrist: 0, skin: 1, beams: 1, glow: 0, fov: 30 },
    sealed: { off: -0.2, cam: V(-40, -135, 60), tgt: V(0, 0, 4), pos: V(0, 0, 6), rot: [0.95, 0.0, 0.25], explode: 0, xray: 0, spin: 0.08, floor: -14, dock: 0, wrist: 0, skin: 0, beams: 0, glow: 0, fov: 24, annoSealed: 1 },
    charge: { off: 0.2, cam: V(90, -150, 105), tgt: V(0, -4, 4), pos: null, rot: [Math.PI, 0, 0], explode: 0, xray: 0, spin: 0, floor: -0.62, dock: 1, wrist: 0, skin: 0, beams: 0, glow: 1, fov: 26 },
    wrist:  { off: -0.2, cam: V(110, -170, 190), tgt: V(10, 0, 20), pos: V(0, 0, WT + H / 2), rot: [Math.PI, 0, 0], explode: 0, xray: 0, spin: 0, floor: -48, dock: 0, wrist: 1, skin: 0, beams: 0, glow: 0, fov: 24 },
  };
  const ORDER = ['hero', 'thin', 'inside', 'sense', 'sealed', 'charge', 'wrist'];
  const dockRestZ = dock.floorZ + H / 2;      // pod centre when seated, skin-down
  K.charge.pos = V(0, 0, dockRestZ);

  // ---------------- annotations (projected HTML labels) ----------------
  const annoBox = document.getElementById('annos');
  const annos = [];
  function anno(text, getWorld, key, lead = 0) { const el = document.createElement('div'); el.className = 'anno' + (lead ? ' lead' : ''); el.textContent = text; if (lead) el.style.setProperty('--lead', lead + 'px'); annoBox.appendChild(el); annos.push({ el, getWorld, key, lead }); }
  const tmp = new THREE.Vector3();
  // exploded-view labels: anchored on the right-hand rim of each layer (as seen by the camera), leader line to the label
  const camRight = new THREE.Vector3();
  const rimAt = (k, dz, r = 15.6) => () => POD.groups[k].localToWorld(tmp.set(0, 0, dz)).clone().addScaledVector(camRight, r);
  anno('Smooth skin-side shell', rimAt('cup', 2.0), 'annoInside', 60);
  anno('Sensor window', rimAt('glass', 2.55, 3.4), 'annoInside', 60);
  anno('Heart-rate sensor', rimAt('flex', 1.9, 9), 'annoInside', 60);
  anno('Brains + Bluetooth', rimAt('pcb', 1.2), 'annoInside', 60);
  anno('Rechargeable battery', rimAt('cell', 0.8, 11.5), 'annoInside', 60);
  anno('Sealed back', rimAt('lid', 0.06), 'annoInside', 60);
  anno('2.7 mm', () => podRig.localToWorld(tmp.set(0, 0, 0)).clone().addScaledVector(camRight, 15.6), 'annoThin', 40);
  anno('Gold charging dots', () => POD.pod.localToWorld(tmp.set(13, 0.6, H)).clone(), 'annoSealed', 60);
  anno('Window for the light', () => POD.pod.localToWorld(tmp.set(3, 0, H)).clone(), 'annoSealed', 120);

  // ---------------- composer ----------------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.25, 0.45, 1.6); composer.addPass(bloom);
  composer.addPass(new SMAAPass());
  composer.addPass(new OutputPass());

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  // ---------------- state blending ----------------
  const cur = { off: 0, cam: V(), tgt: V(), pos: V(), q: new THREE.Quaternion(), explode: 0, xray: 0, floor: 0, dock: 0, wrist: 0, skin: 0, beams: 0, glow: 0, fov: 26 };
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), e = new THREE.Euler();
  let scrollT = 0, hover = { x: 0, y: 0 }, hoverS = { x: 0, y: 0 }, annoState = {};
  const mobile = () => innerWidth < 900;

  function sample(t, time) {
    const i = Math.min(ORDER.length - 2, Math.floor(t)), f = smooth(clamp01(t - i));
    const A = K[ORDER[i]], B = K[ORDER[i + 1]];
    const out = {};
    for (const k of ['off', 'explode', 'xray', 'floor', 'dock', 'wrist', 'skin', 'beams', 'glow', 'fov']) out[k] = lerp(A[k], B[k], f);
    out.cam = A.cam.clone().lerp(B.cam, f); out.tgt = A.tgt.clone().lerp(B.tgt, f);
    out.pos = A.pos.clone().lerp(B.pos, f);
    const spin = lerp(A.spin, B.spin, f) * time;
    qa.setFromEuler(e.set(A.rot[0], A.rot[1], A.rot[2] + A.spin * time));
    qb.setFromEuler(e.set(B.rot[0], B.rot[1], B.rot[2] + B.spin * time));
    out.q = qa.clone().slerp(qb, f);
    // the dock drop: only when entering "charge", the pod falls the last few mm and snaps
    if (ORDER[i + 1] === 'charge' && f > 0.55) {
      const k = clamp01((f - 0.55) / 0.45);
      const snap = 1 - Math.pow(1 - k, 3);
      out.pos.z = dockRestZ + 9 * (1 - snap) + (k > 0.92 ? Math.sin((k - 0.92) * 120) * 0.12 * (1 - k) * 12 : 0);
    }
    for (const kk of ['annoThin', 'annoInside', 'annoSealed']) out[kk] = (A[kk] || 0) * (1 - f) + (B[kk] || 0) * f;
    out.spin = spin;
    return out;
  }

  const clock = new THREE.Clock();
  let ready = false;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
    const S = sample(scrollT, time);
    const k = 1 - Math.pow(0.0008, dt);     // critically damped follow
    cur.cam.lerp(S.cam, k); cur.tgt.lerp(S.tgt, k); cur.pos.lerp(S.pos, Math.min(1, k * 1.6)); cur.q.slerp(S.q, Math.min(1, k * 1.6));
    for (const p of ['off', 'explode', 'xray', 'floor', 'dock', 'wrist', 'skin', 'beams', 'glow', 'fov']) cur[p] = lerp(cur[p], S[p], k);
    // hero parallax with the mouse
    hoverS.x = lerp(hoverS.x, hover.x, 0.05); hoverS.y = lerp(hoverS.y, hover.y, 0.05);
    const par = Math.max(0, 1 - scrollT * 1.5);
    const mobileZoom = mobile() ? 1.45 : 1;
    const camPos = cur.cam.clone().sub(cur.tgt).multiplyScalar(mobileZoom).add(cur.tgt);
    camera.position.copy(camPos).add(V(hoverS.x * 8 * par, 0, -hoverS.y * 6 * par));
    camera.fov = cur.fov; camera.updateProjectionMatrix();
    camera.lookAt(cur.tgt);
    // frame the subject opposite the copy column (desktop); centred on mobile
    const W = innerWidth, Hh = innerHeight, off = mobile() ? 0 : cur.off;
    camera.setViewOffset(W, Hh, -off * W, mobile() ? Hh * 0.12 : 0, W, Hh);
    podRig.position.copy(cur.pos);
    podRig.quaternion.copy(cur.q);
    POD.setExplode(cur.explode);
    setXray(cur.xray);
    floor.position.z = cur.floor; vig.position.z = cur.floor + 0.01; vig.scale.setScalar(140 + 80 * cur.wrist);
    key.position.copy(cur.tgt).add(V(60, -50, 140)); key.target.position.copy(cur.tgt);
    const span = 60 + 140 * cur.wrist; Object.assign(key.shadow.camera, { left: -span, right: span, top: span, bottom: -span }); key.shadow.camera.updateProjectionMatrix();
    F.dock.set(cur.dock); F.wrist.set(cur.wrist); F.skin.set(cur.skin);
    const beat = (time * 1.15) % 1, pulse = Math.exp(-beat * 9) + 0.45 * Math.exp(-Math.abs(beat - 0.3) * 14);
    beams.set(cur.beams * (0.35 + 0.65 * Math.min(1, pulse)));
    skin.beat(pulse * cur.skin);
    POD.MAT.ledDie.emissiveIntensity = 0.4 + 3 * pulse;
    dock.setGlow(cur.glow * (0.55 + 0.45 * Math.sin(time * 2.4)));
    watch.tick();
    composer.render();
    // annotations
    const w = innerWidth, h = innerHeight;
    camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    for (const a of annos) {
      const v = a.getWorld().project(camera);
      const on = (S[a.key] || 0) > 0.6 && v.z < 1;
      a.el.style.left = ((v.x + 1) / 2 * w + a.lead) + 'px'; a.el.style.top = ((1 - v.y) / 2 * h) + 'px';
      a.el.classList.toggle('on', on);
    }
    if (!ready) { ready = true; }
    requestAnimationFrame(frame);
  }
  // snap the camera to the first keyframe so the hero does not fly in from the origin
  const S0 = sample(0, 0); cur.cam.copy(S0.cam); cur.tgt.copy(S0.tgt); cur.pos.copy(S0.pos); cur.q.copy(S0.q); cur.floor = S0.floor; cur.fov = S0.fov; cur.off = S0.off;
  requestAnimationFrame(frame);

  return {
    setScroll(t) { scrollT = Math.max(0, Math.min(ORDER.length - 1, t)); },
    setHover(x, y) { hover.x = x; hover.y = y; },
    scenes: ORDER,
  };
}
