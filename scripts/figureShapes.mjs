// BV10 a: the built shape of each body type, for a race with no model (and a story body type's fallback). Simple
// shapes (balls, capsules, cones, thin sheets for wings), each tagged with the body type's part ids, in metres, y up,
// the being facing +x (a humanoid faces +z). scripts/figures.mjs bakes them like the models.
import * as THREE from 'three';

let G; // the group being built
const V = (a) => new THREE.Vector3(...a);
function add(part, geo) { const m = new THREE.Mesh(geo); m.userData.part = part; G.add(m); return m; }
/** an ellipsoid at p with radii r, turned by rot (radians about x, y, z) */
function ell(part, p, r, rot = [0, 0, 0]) { const m = add(part, new THREE.SphereGeometry(1, 20, 14)); m.scale.set(...r); m.rotation.set(...rot); m.position.set(...p); return m; }
/** a capsule from a to b, radius r */
function cap(part, a, b, r) {
  const A = V(a), B = V(b), m = add(part, new THREE.CapsuleGeometry(r, Math.max(0.001, A.distanceTo(B)), 4, 12));
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); return m;
}
/** a tapering chain of capsules, radius r0 to r1 */
function chain(part, pts, r0, r1) { for (let i = 0; i < pts.length - 1; i++) cap(part, pts[i], pts[i + 1], r0 + (r1 - r0) * (i / Math.max(1, pts.length - 2))); }
/** a tube along a smooth curve */
function tube(part, pts, r, seg = 90) { return add(part, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(V)), seg, r, 10, false)); }
/** a cone (tusk, horn, fang) from base a to tip b */
function cone(part, a, b, r) {
  const A = V(a), B = V(b), m = add(part, new THREE.ConeGeometry(r, A.distanceTo(B), 10));
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); return m;
}
/** a flat sheet through the points (a fan from the first) */
function membrane(part, pts) {
  const g = new THREE.BufferGeometry(), v = [];
  for (let i = 1; i < pts.length - 1; i++) v.push(...pts[0], ...pts[i], ...pts[i + 1]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); return add(part, g);
}

function humanoid() {
  ell('head', [0.01, 1.62, 0], [0.1, 0.12, 0.09]);
  cap('neck', [0, 1.44, 0], [0, 1.53, 0], 0.05);
  ell('general', [0, 1.2, 0], [0.19, 0.25, 0.12]);
  ell('general', [0, 0.98, 0], [0.17, 0.1, 0.11]);
  for (const [side, x] of [['right', -1], ['left', 1]]) { // facing +z: the being's left is +x
    chain(`${side}_arm`, [[0.21 * x, 1.38, 0], [0.25 * x, 1.1, 0], [0.25 * x, 0.86, 0.08]], 0.045, 0.038);
    ell(`${side}_arm`, [0.25 * x, 0.8, 0.1], [0.025, 0.06, 0.04]);
    chain(`${side}_leg`, [[0.1 * x, 0.9, 0], [0.11 * x, 0.5, 0.02], [0.11 * x, 0.08, 0]], 0.065, 0.05);
    ell(`${side}_leg`, [0.11 * x, 0.04, 0.06], [0.05, 0.04, 0.12]);
  }
}

/** one four-legged builder; the shape's proportions in metres */
function quadruped(r) {
  const { sh, len, girth, legR, head, neck = 0.25, tail, tailR } = r;
  const cy = sh - girth * 0.55, wide = r.wide ?? 0.85;
  ell('general', [0, cy, 0], [len / 2, girth, girth * wide]);
  const nA = [len * 0.4, cy + girth * 0.3, 0], up = r.neckUp ?? 0.6;
  const nB = [nA[0] + neck * Math.cos(up), nA[1] + neck * Math.sin(up), 0];
  cap('neck', nA, nB, girth * 0.55);
  const hx = nB[0] + head.l * 0.35, hy = nB[1];
  ell('head', [hx, hy, 0], [head.l * 0.4, head.r, head.r * 0.95]);
  cap('head', [hx, hy - head.r * 0.2, 0], [hx + head.l * 0.55, hy - head.r * 0.35, 0], head.r * 0.45);
  for (const z of [-1, 1]) cone('head', [hx - head.l * 0.1, hy + head.r * 0.8, z * head.r * 0.5], [hx - head.l * 0.15, hy + head.r * 1.6, z * head.r * 0.6], head.r * 0.25);
  // BV7 a: one part per leg (facing +x, the being's left is -z)
  for (const [pair, x] of [['foreleg', len * 0.32], ['hind_leg', -len * 0.32]]) for (const z of [-1, 1]) {
    const part = `${z < 0 ? 'left' : 'right'}_${pair}`, zz = z * girth * wide * 0.6;
    const knee = [x + (pair === 'hind_leg' ? -0.06 : 0.03) * sh, cy * 0.5, zz];
    cap(part, [x, cy - girth * 0.3, zz], knee, legR);
    cap(part, knee, [x + 0.02 * sh, legR, zz], legR * 0.8);
    ell(part, [x + 0.05 * sh, legR * 0.6, zz], [legR * 1.4, legR * 0.6, legR * 1.1]);
  }
  const tx = -len / 2 + girth * 0.1, ty = cy + girth * 0.35, droop = r.tailDroop ?? 0.6, pts = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([tx - tail * t, ty - tail * droop * t * t, Math.sin(t * 2.4) * tail * 0.08]); }
  chain('tail', pts, tailR, tailR * 0.35);
}

function wingedQuadruped() {
  quadruped({ sh: 1.8, len: 3.4, girth: 0.75, legR: 0.17, head: { l: 1.0, r: 0.3 }, neck: 1.9, neckUp: 0.75, tail: 4.2, tailR: 0.32, tailDroop: 0.15 });
  for (const [side, z] of [['right', 1], ['left', -1]]) {
    const sho = [0.9, 2.0, z * 0.45], elb = [0.5, 2.8, z * 1.8], wr = [0.3, 3.1, z * 3.2], tip = [-0.6, 2.8, z * 5.0];
    const f2 = [-1.6, 2.3, z * 4.0], f3 = [-1.8, 1.95, z * 2.4], root = [-0.9, 1.85, z * 0.5];
    chain(`${side}_wing`, [sho, elb, wr], 0.12, 0.08);
    cap(`${side}_wing`, wr, tip, 0.05); cap(`${side}_wing`, wr, f2, 0.045); cap(`${side}_wing`, wr, f3, 0.04);
    membrane(`${side}_wing`, [wr, tip, f2, f3, root, sho, elb]);
  }
}

function serpent(R = 0.1) {
  // the raised front is body, the loops on the ground are coils, the last metre is tail (BV9 a)
  tube('general', [[-0.3, R, 0.75], [0.25, R * 1.2, 0.7], [0.7, 0.35, 0.45], [0.85, 0.65, 0.15], [1.05, 0.8, 0]], R);
  const loops = []; for (let i = 0; i <= 60; i++) { const t = i / 60, a = Math.PI * 0.5 + t * Math.PI * 3.2, rr = 0.75 - t * 0.35; loops.push([Math.cos(a) * rr - 0.3, R + t * 0.02, Math.sin(a) * rr]); }
  tube('coils', loops, R * 1.02);
  const last = loops.at(-1), tailPts = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; tailPts.push([last[0] + 0.15 * t, R * (1 - 0.5 * t), last[2] - 0.9 * t]); }
  chain('tail', tailPts, R * 0.95, R * 0.3);
  ell('head', [1.2, 0.84, 0], [0.13, 0.065, 0.085], [0, 0, -0.25]);
}

function eightLegged() {
  ell('general', [-0.3, 0.42, 0], [0.32, 0.25, 0.27]); // abdomen
  ell('general', [0.08, 0.36, 0], [0.18, 0.12, 0.16]); // front body
  ell('head', [0.26, 0.37, 0], [0.09, 0.08, 0.1]);
  for (const z of [-1, 1]) cone('head', [0.33, 0.32, z * 0.04], [0.36, 0.2, z * 0.035], 0.025); // fangs
  [0.7, 0.25, -0.25, -0.7].forEach((a, i) => {
    for (const z of [-1, 1]) {
      const base = [0.1 + Math.sin(a) * 0.08, 0.36, z * 0.12];
      chain(`${z < 0 ? 'left' : 'right'}_leg_${i + 1}`, [base, [base[0] + Math.sin(a) * 0.35, 0.72, z * (0.12 + Math.cos(a) * 0.35)], [base[0] + Math.sin(a) * 0.95, 0.02, z * (0.12 + Math.cos(a) * 0.85)]], 0.045, 0.025);
    }
  });
}

/** a smooth gel dome (the slime model's eyes were sculpted into it, so it is built) */
function amorphous() {
  const dome = add('general', new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)); dome.scale.set(0.3, 0.42, 0.355); dome.position.set(0, 0.03, 0);
  ell('general', [0, 0.04, 0], [0.315, 0.05, 0.37]);
}

/** body type id → builder; upright figures face +z and are sized by height */
export const SHAPES = {
  humanoid: { build: humanoid, upright: true },
  quadruped: { build: () => quadruped({ sh: 0.8, len: 1.0, girth: 0.2, legR: 0.055, head: { l: 0.3, r: 0.1 }, neck: 0.2, tail: 0.45, tailR: 0.06, tailDroop: 1.2 }) },
  winged_quadruped: { build: wingedQuadruped },
  serpent: { build: serpent },
  eight_legged: { build: eightLegged },
  amorphous: { build: amorphous },
};

/** a shape's triangles per part, world space */
export function shapeTriangles(id) {
  G = new THREE.Group(); SHAPES[id].build(); G.updateMatrixWorld(true);
  const tris = {}, v = new THREE.Vector3();
  for (const m of G.children) {
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry, pos = g.attributes.position, arr = (tris[m.userData.part] ??= []);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); arr.push(v.x, v.y, v.z); }
  }
  return tris;
}
