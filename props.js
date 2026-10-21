// Scene props for the promo site: magnetic dock (real CAD), analog watch, clay forearm, skin cross-section, light beams.
// Units mm, world z up. Every prop owns its materials, so each prop can be faded on its own.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const b64 = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
const std = (o) => new THREE.MeshStandardMaterial(o);
const glow = (hex, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
function meshFrom(b, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b64(b.pos).buffer), 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(b64(b.idx).buffer), 1));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
}
function shadows(o) { o.traverse((m) => { if (m.isMesh && !m.material.blending) { m.castShadow = m.receiveShadow = true; } }); return o; }
function collectMats(o) { const s = new Set(); o.traverse((m) => { if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => s.add(x)); }); return [...s]; }
export function fadeable(group) {
  const mats = collectMats(group).map((m) => ({ m, base: m.opacity, tr: m.transparent, dw: m.depthWrite }));
  let a = -1;
  return {
    group,
    set(alpha) {
      if (Math.abs(alpha - a) < 1e-3) return; a = alpha;
      group.visible = alpha > 0.005;
      for (const r of mats) {
        const solid = alpha > 0.995;
        r.m.opacity = r.base * alpha;
        const wantTr = r.tr || !solid;
        if (r.m.transparent !== wantTr) { r.m.transparent = wantTr; r.m.needsUpdate = true; }
        r.m.depthWrite = r.dw && solid;
      }
    },
  };
}

// ---------------- dock (CAD from tools/case/build_dock.py) ----------------
export function buildDock(D) {
  const DK = D.dock, DP = DK.fit.params;
  const g = new THREE.Group(); g.name = 'dock';
  const M = {
    shell: phys({ color: 0x2b2c30, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.6 }),
    pin: std({ color: 0xe9c27a, metalness: 1, roughness: 0.18 }),
    ring: std({ color: 0x1a2a20, roughness: 0.3, emissive: 0x3dff8a, emissiveIntensity: 0 }),
    usb: std({ color: 0xc9ccd1, metalness: 1, roughness: 0.28 }),
    foot: std({ color: 0x2a2a2c, roughness: 0.9 }),
    cable: phys({ color: 0x1f2023, roughness: 0.7, sheen: 0.4, sheenColor: 0x555555, envMapIntensity: 0.5 }),
  };
  const map = { dock_shell: M.shell, dock_pin: M.pin, dock_ring: M.ring, dock_usb: M.usb, dock_foot: M.foot };
  for (const [k, b] of Object.entries(DK.bodies)) if (map[k]) g.add(meshFrom(b, map[k]));
  const uz = DP.pcb.z0 + DP.pcb.t + DP.usb.h / 2, y0 = -DP.od / 2;
  const boot = new THREE.Mesh(new RoundedBoxGeometry(8.6, 14, 4.2, 4, 1.6), M.cable); boot.position.set(0, y0 - 7, uz); g.add(boot);
  const pts = [[0, y0 - 13.5, uz], [0, y0 - 24, uz - 0.8], [0, y0 - 40, 1.6], [10, y0 - 80, 1.6], [50, y0 - 150, 1.6], [120, y0 - 230, 1.6]].map((p) => new THREE.Vector3(...p));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 1.6, 18), M.cable));
  const halo = new THREE.Mesh(new THREE.RingGeometry(DP.ring.r_in - 0.6, DP.ring.r_out + 1.6, 128), glow(0x3dff8a, 1.6));
  halo.position.z = DP.h + 0.03; halo.material.opacity = 0; g.add(halo);
  shadows(g);
  return { group: g, floorZ: DK.fit.checks.pod_rest_z, top: DP.h, setGlow(k) { M.ring.emissiveIntensity = 1.6 * k; halo.material.opacity = 0.12 * k; } };
}

// ---------------- analog watch: back at z=0, dial faces +z ----------------
export function buildWatch() {
  const g = new THREE.Group(); g.name = 'watch';
  const R = 20, H = 10.4;
  const M = {
    steel: std({ color: 0x9a9da2, metalness: 1, roughness: 0.32, envMapIntensity: 0.4 }),
    polish: std({ color: 0xb0b3b8, metalness: 1, roughness: 0.2, envMapIntensity: 0.4 }),
    back: phys({ color: 0x9fa3a8, metalness: 1, roughness: 0.3 }),
    dial: std({ roughness: 0.75, metalness: 0, envMapIntensity: 0.2 }),
    hand: std({ color: 0xe8e6df, metalness: 0.3, roughness: 0.35, envMapIntensity: 0.3 }),
    sec: std({ color: 0x3dff8a, emissive: 0x1aff6a, emissiveIntensity: 0.6, roughness: 0.3 }),
    crystal: phys({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.05, envMapIntensity: 0.25, depthWrite: false }),
  };
  const prof = [[15.5, 0], [17.6, 0.25], [19.2, 1.0], [20.1, 2.4], [R + 0.35, 4.6], [R + 0.2, 7.0], [19.7, 8.6], [19.3, 9.1], [19.1, 9.6], [18.4, 9.9], [17.9, 9.9]]
    .map(([r, z]) => new THREE.Vector2(r, z));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 160).rotateX(Math.PI / 2), M.steel); g.add(body);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(18.6, 0.75, 24, 160), M.polish); bezel.position.z = 9.7; g.add(bezel);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(15.4, 15.8, 0.7, 120).rotateX(Math.PI / 2), M.back); back.position.z = 0.1; g.add(back);
  // dial
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024; const c = cv.getContext('2d');
  const grd = c.createRadialGradient(470, 420, 30, 512, 512, 520); grd.addColorStop(0, '#1c2a26'); grd.addColorStop(0.7, '#0e1513'); grd.addColorStop(1, '#070a09');
  c.fillStyle = grd; c.fillRect(0, 0, 1024, 1024);
  c.translate(512, 512);
  for (let i = 0; i < 60; i++) {
    c.save(); c.rotate((i / 60) * Math.PI * 2);
    c.fillStyle = i % 5 ? 'rgba(230,230,225,.55)' : '#f3f1ea';
    if (i % 5) c.fillRect(-2, -470, 4, 22); else c.fillRect(-9, -470, 18, 92);
    c.restore();
  }
  c.fillStyle = '#e9e7e0'; c.textAlign = 'center';
  c.font = '600 34px Inter, system-ui, sans-serif'; c.fillText('GUNNARSSON', 0, -230);
  c.font = '500 20px Inter, system-ui, sans-serif'; c.fillStyle = 'rgba(233,231,224,.6)'; c.fillText('AUTOMATIC', 0, -196);
  c.beginPath(); c.arc(0, 230, 92, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,.35)'; c.fill();
  c.strokeStyle = 'rgba(233,231,224,.35)'; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#3dff8a'; c.font = '600 54px Inter, system-ui, sans-serif'; c.fillText('\u2665 68', 0, 248);
  c.fillStyle = 'rgba(233,231,224,.6)'; c.font = '500 20px Inter, system-ui, sans-serif'; c.fillText('BPM', 0, 284);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  M.dial.map = tex;
  const dial = new THREE.Mesh(new THREE.CircleGeometry(17.9, 128), M.dial); dial.position.z = 8.2; g.add(dial);
  const hand = (len, w, mat, z) => { const h = new THREE.Group(); const m = new THREE.Mesh(new RoundedBoxGeometry(w, len, 0.25, 2, w * 0.45), mat); m.position.y = len / 2 - len * 0.12; h.add(m); h.position.z = z; g.add(h); return h; };
  const hh = hand(10.5, 1.3, M.hand, 8.45), mh = hand(15.5, 0.95, M.hand, 8.75), sh = hand(16.5, 0.28, M.sec, 9.05);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.6, 32).rotateX(Math.PI / 2), M.polish); cap.position.z = 9.2; g.add(cap);
  const RS = 70, rr = 18.2, th = Math.asin(rr / RS);
  const crystal = new THREE.Mesh(new THREE.SphereGeometry(RS, 128, 12, 0, Math.PI * 2, 0, th).rotateX(Math.PI / 2), M.crystal);
  crystal.position.z = 9.9 - RS * Math.cos(th); crystal.castShadow = false; g.add(crystal);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.4, 40), M.polish);
  crown.rotation.z = Math.PI / 2; crown.position.set(R + 1.9, 0, 5.2); g.add(crown);
  for (const sy of [1, -1]) for (const sx of [1, -1]) {
    const lug = new THREE.Mesh(new RoundedBoxGeometry(3.6, 9, 3.4, 3, 1.2), M.steel);
    lug.position.set(sx * 8.2, sy * (R + 2.6), 4.4); lug.rotation.x = sy * 0.22; g.add(lug);
  }
  shadows(g); crystal.castShadow = false;
  return {
    group: g, H,
    tick(date = new Date()) {
      const s = date.getSeconds() + date.getMilliseconds() / 1000, m = date.getMinutes() + s / 60, h = (date.getHours() % 12) + m / 60;
      sh.rotation.z = -(s / 60) * Math.PI * 2; mh.rotation.z = -(m / 60) * Math.PI * 2; hh.rotation.z = -(h / 12) * Math.PI * 2;
    },
  };
}

// ---------------- clay forearm (along x), with the watch on its strap ----------------
// Wrist cross-section ellipse a (y) x b (z). Returns wristTop (z of the dorsal surface at x=0).
export function buildWrist(watch, podH) {
  const g = new THREE.Group(); g.name = 'wrist';
  const WR = { a: 30, b: 21.5 };
  const M = {
    clay: std({ color: 0x6e5244, roughness: 0.75, envMapIntensity: 0.12 }),
    strap: std({ color: 0x1c1a18, roughness: 0.8, envMapIntensity: 0.5 }),
    buckle: phys({ color: 0xd6d8db, metalness: 1, roughness: 0.25 }),
  };
  // loft: x stations with (a, b); dorsal side slightly flattened
  const st = [[-320, 41, 35], [-220, 39, 32], [-130, 35, 27], [-60, 32, 23.5], [-15, WR.a, WR.b], [15, WR.a, WR.b], [45, 33, 19], [85, 40, 16], [130, 44, 15.5], [230, 45, 15]];
  const seg = 96, rows = [];
  const N = 120;
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let i = 0; i <= N; i++) {
    const x = lerp(st[0][0], st[st.length - 1][0], i / N);
    let k = 0; while (k < st.length - 2 && x > st[k + 1][0]) k++;
    const t = (x - st[k][0]) / (st[k + 1][0] - st[k][0]), s = t * t * (3 - 2 * t);
    rows.push([x, lerp(st[k][1], st[k + 1][1], s), lerp(st[k][2], st[k + 1][2], s)]);
  }
  const pos = [], idx = [];
  for (const [x, a, b] of rows) for (let j = 0; j <= seg; j++) {
    const th = (j / seg) * Math.PI * 2, sn = Math.sin(th);
    const flat = sn > 0 ? 1 - 0.07 * sn * sn : 1 + 0.03 * sn * sn;
    pos.push(x, a * Math.cos(th), b * sn * flat);
  }
  const rn = seg + 1;
  for (let r = 0; r < rows.length - 1; r++) for (let j = 0; j < seg; j++) { const a0 = r * rn + j; idx.push(a0, a0 + rn, a0 + 1, a0 + 1, a0 + rn, a0 + rn + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, M.clay));
  const wristTop = WR.b * (1 - 0.07);
  // watch + strap
  const backZ = wristTop + podH + 0.05;
  watch.group.position.set(0, 0, backZ);
  g.add(watch.group);
  const A = WR.a + 1.9, B = WR.b + 1.9, cz = -backZ, N2 = 140, pts = [];
  const ly = 20 + 6.5, lz = 4.0;
  pts.push(new THREE.Vector3(0, ly, lz), new THREE.Vector3(0, ly + 3.5, lz - 5));
  for (let i = 0; i <= N2; i++) { const t = (38 - (i / N2) * 256) * Math.PI / 180; pts.push(new THREE.Vector3(0, A * Math.cos(t), cz + B * Math.sin(t) * (Math.sin(t) > 0 ? 0.93 : 1))); }
  pts.push(new THREE.Vector3(0, -ly - 3.5, lz - 5), new THREE.Vector3(0, -ly, lz));
  const sh = new THREE.Shape(); const sw = 20, stt = 3.0, r = 1.3;
  sh.moveTo(-sw / 2 + r, -stt / 2); sh.lineTo(sw / 2 - r, -stt / 2); sh.quadraticCurveTo(sw / 2, -stt / 2, sw / 2, -stt / 2 + r); sh.lineTo(sw / 2, stt / 2 - r);
  sh.quadraticCurveTo(sw / 2, stt / 2, sw / 2 - r, stt / 2); sh.lineTo(-sw / 2 + r, stt / 2); sh.quadraticCurveTo(-sw / 2, stt / 2, -sw / 2, stt / 2 - r);
  sh.lineTo(-sw / 2, -stt / 2 + r); sh.quadraticCurveTo(-sw / 2, -stt / 2, -sw / 2 + r, -stt / 2);
  const strap = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { steps: 260, bevelEnabled: false, extrudePath: new THREE.CatmullRomCurve3(pts) }), M.strap);
  watch.group.add(strap);
  const buckle = new THREE.Mesh(new THREE.TorusGeometry(11, 0.9, 12, 4, Math.PI * 2), M.buckle);
  buckle.visible = false;
  shadows(g);
  return { group: g, wristTop, backZ };
}

// ---------------- skin cross-section + light paths ----------------
export function buildSkin() {
  const g = new THREE.Group(); g.name = 'skin';
  const L = 58, W = 34, Y0 = 0.5;
  const M = {
    top: phys({ color: 0x6e4535, roughness: 0.7, sheen: 0.4, sheenColor: 0xc08a70, sheenRoughness: 0.7, envMapIntensity: 0.35 }),
    epi: std({ color: 0x9a6a55, roughness: 0.8, envMapIntensity: 0.3 }),
    derm: std({ color: 0x7a3434, roughness: 0.85, envMapIntensity: 0.3 }),
    fat: std({ color: 0x6b5634, roughness: 0.9, envMapIntensity: 0.25 }),
    vessel: phys({ color: 0xa3192b, roughness: 0.35, clearcoat: 0.6, emissive: 0x5a0010, emissiveIntensity: 0.4 }),
  };
  const layer = (z0, z1, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(L, W, z1 - z0), mat); m.position.set(0, Y0 + W / 2, (z0 + z1) / 2); g.add(m); };
  layer(-0.15, 0, M.top); layer(-0.6, -0.15, M.epi); layer(-3.0, -0.6, M.derm); layer(-9, -3.0, M.fat);
  const v1 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, L, 32), M.vessel); v1.rotation.z = Math.PI / 2; v1.position.set(0, Y0 + 0.2, -1.9); g.add(v1);
  const v2 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, L, 24), M.vessel); v2.rotation.z = Math.PI / 2; v2.position.set(0, Y0 + 0.15, -1.1); g.add(v2);
  shadows(g);
  return { group: g, beat(k) { for (const v of [v1, v2]) v.scale.set(1 + 0.22 * k, 1, 1 + 0.22 * k); M.vessel.emissiveIntensity = 0.3 + 0.9 * k; } };
}

// beams live in the pod frame (pod z=H is the skin face); they arc out of the skin face and back
export function buildBeams(D, H) {
  const g = new THREE.Group(); g.name = 'beams';
  const mat = glow(0x22ff6a, 1.4), cone = glow(0x3dff8a, 0.5);
  mat.depthTest = false; cone.depthTest = false;
  const led = D.parts.filter((p) => p.kind === 'led').map((p) => [(p.lo[0] + p.hi[0]) / 2, (p.lo[1] + p.hi[1]) / 2]);
  const pd = D.parts.find((p) => p.kind === 'photodiode');
  const pc = pd ? [(pd.lo[0] + pd.hi[0]) / 2, (pd.lo[1] + pd.hi[1]) / 2] : [0.26, 0];
  for (const [lx, ly] of (led.length ? led : [[-3.7, 0], [3.7, 0]])) {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(lx, ly, H - 0.3), new THREE.Vector3(lx * 0.92, ly, H + 1.3),
      new THREE.Vector3((lx + pc[0]) / 2, (ly + pc[1]) / 2 + 0.8, H + 2.1), new THREE.Vector3(pc[0] * 0.85 + lx * 0.15, pc[1], H + 1.2), new THREE.Vector3(pc[0], pc[1], H - 0.3)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 90, 0.22, 12), mat));
    const cn = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 40, 1, true), cone); cn.rotation.x = -Math.PI / 2; cn.position.set(lx, ly, H + 1.2); g.add(cn);
  }
  g.traverse((m) => { m.renderOrder = 10; });
  return { group: g, set(k) { mat.opacity = k; cone.opacity = k * 0.2; } };
}
