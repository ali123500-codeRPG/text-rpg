// BV11, BV15: bakes each race's 3D figure model into a small file the game loads only when that figure is shown.
// Run `npm run figures` after changing a model or a map here; the output (assets/figures/*.json) is committed.
//
// Each source model (assets/figures/models/*.glb: already stripped of animations and textures) is posed at rest, split
// into the game's body parts by its skeleton's bone names (BV11 a), turned to face +x (humanoids face +z), normalised so
// its head-and-body length is 1 (tail and wings left out; a humanoid: its height is 1) and stood on y = 0. Positions are
// stored as 16-bit integers inside the model's box, indices as 16 or 32 bits, both base64. The figure code scales the
// unit model by the being's bodySize (BV3 a). Credits live in src/library/figureModels.ts (BV12).
import { writeFile, mkdir } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import { SHAPES, shapeTriangles } from './figureShapes.mjs';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const SRC = 'assets/figures/models', OUT = 'assets/figures';
/** a model with no neck bone: body surface nearer the head bone than this share of the hips-to-head distance is the neck */
const NECK_AT = 0.45;
/** 3ds Max Biped rigs (tiger, lion, leopard): front legs are the arm chain, hind legs the leg chain */
const BIPED = [[/Head|Ponytail|Mouth|Ear|Eye|Beard|^Bone0/, 'head'], [/Neck/, 'neck'], [/(Clavicle|UpperArm|Forearm|Hand|Finger)/, 'foreleg'], [/(Thigh|Calf|HorseLink|Foot|Toe)/, 'hind_leg'], [/Tail/, 'tail']];
const QUAD = [[/^(Head|Ear)/, 'head'], [/^Neck/, 'neck'], [/^Front(Upper|Lower)Leg/, 'foreleg'], [/^Back(Leg|UpperLeg|LowerLeg)/, 'hind_leg'], [/^Tail/, 'tail']];
const MIXAMO = [[/Left(Arm|ForeArm|Hand)/, 'left_arm'], [/Right(Arm|ForeArm|Hand)/, 'right_arm'],
  [/Left(UpLeg|Leg|Foot|Toe)/, 'left_leg'], [/Right(UpLeg|Leg|Foot|Toe)/, 'right_leg'], [/Head|Eye/, 'head'], [/Neck/, 'neck']];
/** python bone chain (Bone, Bone.001 … Bone.023): Bone and Bone.001 are at the head end, found by looking */
const PY = { head: 1, front: 5, tail: 19 };

// 'foreleg' and 'hind_leg' are split into left and right by which side of the body they lie on (BV7 a).
// Bone names as three.js reads them: '.', ':', '/', '[', ']' dropped, spaces turned into '_' (Ear1.L -> Ear1L).
export const MODELS = {
  human_man: { file: 'human-man.glb', upright: true, armsDown: ['upperarm_l', 'upperarm_r'],
    map: [[/^Head|^Eye/, 'head'], [/^neck/, 'neck'], [/^(upperarm|lowerarm|hand|index|middle|pinky|ring|thumb).*_l$/, 'left_arm'], [/^(upperarm|lowerarm|hand|index|middle|pinky|ring|thumb).*_r$/, 'right_arm'],
      [/^(thigh|calf|foot|ball).*_l$/, 'left_leg'], [/^(thigh|calf|foot|ball).*_r$/, 'right_leg']] },
  human_woman: { file: 'human-woman.glb', upright: true, map: MIXAMO, armsDown: [/LeftArm_/, /RightArm_/] },
  wolf: { file: 'wolf.glb', map: QUAD },
  dog: { file: 'dog.glb', map: QUAD },
  horse: { file: 'horse.glb', map: QUAD },
  boar: { file: 'boar.glb', neckCut: { from: 'Hips', to: 'Head', at: NECK_AT },
    map: [[/Head|Mouth|Ear|Eye/, 'head'], [/Leg.*F$|LegF$/, 'foreleg'], [/Leg.*B$|LegB$/, 'hind_leg'], [/^Tail/, 'tail']] },
  bear: { file: 'bear.glb', map: [[/RigHead|RigJaw|Tongue|Eyelid|Ear/, 'head'], [/RigNeck/, 'neck'], [/Rig[LR]F/, 'foreleg'], [/Rig[LR]B/, 'hind_leg'], [/RigTail/, 'tail']] },
  tiger: { file: 'tiger.glb', map: BIPED },
  lion: { file: 'lion.glb', map: BIPED },
  leopard: { file: 'leopard.glb', map: [[/Mane/, 'neck'], ...BIPED] },
  crocodile: { file: 'crocodile.glb', map: [[/^Head|Fang|Eye/, 'head'], [/^Spine4/, 'neck'], [/^Arm/, 'foreleg'], [/^(Leg|Foot)/, 'hind_leg'], [/^Tail/, 'tail']] },
  spider: { file: 'spider.glb', map: [[/^Cabeza/, 'head'], ...['a', 'b', 'c', 'd'].flatMap((x, i) => [[new RegExp(`^Lp${x}_`), `left_leg_${i + 1}`], [new RegExp(`^Rp${x}_`), `right_leg_${i + 1}`]])] },
  python: { file: 'python.glb', skip: /^Circle/, // the model stands on a base plate
    mapFn: (name) => { const m = /^Bone(\d*)_/.exec(name); if (!m) return 'general'; const n = +(m[1] || 0);
      return n <= PY.head ? 'head' : n <= PY.front ? 'general' : n >= PY.tail ? 'tail' : 'coils'; } },
  dragon: { file: 'dragon.glb', // no skeleton: its pieces are named
    map: [[/^Head/, 'head'], [/^Neck/, 'neck'], [/^Left_wing/, 'left_wing'], [/^Right_wing/, 'right_wing'], [/^Tail/, 'tail'], [/^(Left_arm|Right_leg001)/, 'foreleg'], [/^(Left_leg|Right_leg)/, 'hind_leg']] },
  // no skeleton and one piece: parts cut by position along the long axis (shares of length; legs below that share of height)
  hyena: { file: 'hyena.glb', map: [], cutBy: { head: 0.24, neck: 0.12, tail: 0.1, legs: 0.42 } },
  lizard: { file: 'monitor-lizard.glb', map: [], cutBy: { head: 0.1, neck: 0.06, tail: 0.45, legs: 0.33, legSplit: 0.66, flip: true } },
};

const partOfBone = (M, name) => (M.mapFn ? M.mapFn(name) : (M.map.find(([re]) => re.test(name)) ?? [0, 'general'])[1]);

function cutByPosition(tris, C) {
  const all = tris.general; if (!all) return;
  const box = new THREE.Box3(); for (let i = 0; i < all.length; i += 3) box.expandByPoint(new THREE.Vector3(all[i], all[i + 1], all[i + 2]));
  const ax = box.max.x - box.min.x >= box.max.z - box.min.z ? 0 : 2, lo = box.min.getComponent(ax), L = box.max.getComponent(ax) - lo;
  const H = box.max.y - box.min.y;
  delete tris.general;
  for (let t = 0; t < all.length; t += 9) {
    let cx = 0, cy = 0; for (let k = 0; k < 3; k++) { cx += all[t + k * 3 + ax]; cy += all[t + k * 3 + 1]; } cx /= 3; cy /= 3;
    let f = (cx - lo) / L; if (C.flip) f = 1 - f; // 1 = the head end
    const h = (cy - box.min.y) / H;
    const part = f > 1 - C.head ? 'head' : f > 1 - C.head - C.neck && h > C.legs ? 'neck' : f < C.tail && h > 0.05 ? 'tail'
      : h < C.legs ? (f > (C.legSplit ?? 0.5) ? 'foreleg' : 'hind_leg') : 'general';
    (tris[part] ??= []).push(...all.slice(t, t + 9));
  }
}

/** the rest pose baked into flat triangle lists per part (world space) */
function triangles(M, root) {
  const tris = {}, v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  // a T-posed figure: swing each upper arm down to the side
  for (const name of M.armsDown ?? []) {
    let bone = typeof name === 'string' ? root.getObjectByName(name) : null;
    if (!bone && name instanceof RegExp) root.traverse((o) => { if (!bone && o.isBone && name.test(o.name)) bone = o; });
    const child = bone?.children.find((c) => c.isBone);
    if (!child) throw new Error(`${M.file}: no arm bone ${name}`);
    const a = bone.getWorldPosition(new THREE.Vector3()), b = child.getWorldPosition(new THREE.Vector3());
    const cur = b.sub(a).normalize(), want = new THREE.Vector3(Math.sign(cur.x) * 0.22, -1, 0).normalize();
    const qWorld = new THREE.Quaternion().setFromUnitVectors(cur, want);
    const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()), bq = bone.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(pq.clone().invert().multiply(qWorld).multiply(bq));
    root.updateMatrixWorld(true);
  }
  let cut = null;
  if (M.neckCut) {
    const a = root.getObjectByName(M.neckCut.from).getWorldPosition(new THREE.Vector3()), h = root.getObjectByName(M.neckCut.to).getWorldPosition(new THREE.Vector3());
    cut = { h, r: h.distanceTo(a) * M.neckCut.at }; // a collar round the head's root
  }
  root.traverse((o) => {
    if (!o.isMesh || (M.skip && M.skip.test(o.name))) return;
    const g = o.geometry, pos = g.attributes.position, idx = g.index;
    const n = idx ? idx.count : pos.count, vi = (k) => (idx ? idx.getX(k) : k);
    const skin = o.isSkinnedMesh ? g.attributes.skinIndex : null, wt = o.isSkinnedMesh ? g.attributes.skinWeight : null;
    let anc = o.parent; while (anc && !anc.isBone) anc = anc.parent;
    let named = o; while (named && named !== root && !(M.map ?? []).some(([re]) => re.test(named.name))) named = named.parent;
    const fixed = partOfBone(M, (named && named !== root ? named.name : anc?.name) ?? '');
    const vPart = (i) => {
      if (!skin) return fixed;
      let best = 0, bw = -1; for (let c = 0; c < 4; c++) { const w = wt.getComponent(i, c); if (w > bw) { bw = w; best = skin.getComponent(i, c); } }
      return partOfBone(M, o.skeleton.bones[best].name);
    };
    for (let t = 0; t < n; t += 3) {
      const ids = [vi(t), vi(t + 1), vi(t + 2)], ps = ids.map(vPart);
      let part = ps[1] === ps[2] ? ps[1] : ps[0];
      const pts = ids.map((i) => { v.fromBufferAttribute(pos, i); if (o.isSkinnedMesh) o.applyBoneTransform(i, v); return v.clone().applyMatrix4(o.matrixWorld); });
      if (cut && part === 'general' && pts[0].clone().add(pts[1]).add(pts[2]).divideScalar(3).distanceTo(cut.h) < cut.r) part = 'neck';
      const arr = (tris[part] ??= []);
      for (const p of pts) arr.push(p.x, p.y, p.z);
    }
  });
  if (M.cutBy) cutByPosition(tris, M.cutBy);
  return tris;
}

const boxOf = (arrs) => { const b = new THREE.Box3(), p = new THREE.Vector3(); for (const a of arrs) for (let i = 0; i < a.length; i += 3) b.expandByPoint(p.set(a[i], a[i + 1], a[i + 2])); return b; };
const centre = (a) => (a ? boxOf([a]).getCenter(new THREE.Vector3()) : null);
const LEAVE_OUT = /^(tail|left_wing|right_wing)$/; // SZ2: length is head and body

/** the file format src/ui/figure3d.ts reads: { v, box: [min xyz, max xyz], parts: { id: [positions, indices, wide] } };
 * positions are Int16 in the box (-32767 … 32767), indices Uint16 (Uint32 when wide), each base64 */
/** a figure is drawn at most a few hundred pixels tall: more triangles than this only add file size */
const MAX_TRIANGLES = 6000;
function encode(tris) {
  const total = Object.values(tris).reduce((n, a) => n + a.length / 9, 0), keep = Math.min(1, MAX_TRIANGLES / total);
  const box = boxOf(Object.values(tris)), lo = box.min.toArray(), span = box.getSize(new THREE.Vector3()).toArray().map((x) => x || 1);
  const parts = {};
  for (const [id, arr] of Object.entries(tris).sort(([a], [b]) => a.localeCompare(b))) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const w = mergeVertices(g, 1e-5); // weld equal points
    let idx = w.index.array;
    if (keep < 1) { // fewer triangles, the part's outline kept so parts still meet
      const target = Math.max(12, Math.floor((idx.length / 3) * keep) * 3);
      idx = MeshoptSimplifier.simplify(new Uint32Array(idx), w.attributes.position.array, 3, target, 0.01, ['LockBorder'])[0];
    }
    const fp = w.attributes.position.array;
    const used = [...new Set(idx)].sort((a, b) => a - b), at = new Map(used.map((o, n) => [o, n]));
    const pos = new Int16Array(used.length * 3);
    used.forEach((o, n) => { for (let k = 0; k < 3; k++) pos[n * 3 + k] = Math.round(((fp[o * 3 + k] - lo[k]) / span[k]) * 65534) - 32767; });
    idx = Uint32Array.from(idx, (o) => at.get(o));
    const wide = pos.length / 3 > 65535;
    const b64 = (ta) => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength).toString('base64');
    parts[id] = [b64(pos), b64(wide ? idx : Uint16Array.from(idx)), wide ? 1 : 0];
  }
  return { v: 1, box: [...lo, ...box.max.toArray()], parts };
}

async function modelTriangles(M) {
  // the figure is tinted by state, so textures are dropped (three.js cannot decode images outside a browser)
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(`${SRC}/${M.file}`);
  for (const t of doc.getRoot().listTextures()) t.dispose();
  const buf = await io.writeBinary(doc);
  const gltf = await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  return triangles(M, gltf.scene);
}

async function bake(key, M) {
  const tris = M.file ? await modelTriangles(M) : shapeTriangles(M.shape);
  // turn: a beast's head ahead (+x) of its body; a humanoid keeps the model's facing (+z)
  const m = new THREE.Matrix4();
  if (M.file && !M.upright) { // built shapes already face +x
    const hc = centre(tris.head), bc = centre(tris.general);
    m.makeRotationY(-Math.atan2(-(hc.z - bc.z), hc.x - bc.x));
  }
  const v = new THREE.Vector3();
  for (const a of Object.values(tris)) for (let i = 0; i < a.length; i += 3) { v.set(a[i], a[i + 1], a[i + 2]).applyMatrix4(m); a[i] = v.x; a[i + 1] = v.y; a[i + 2] = v.z; }
  // BV7 a: legs to left and right by side (facing +x with y up, the being's left is -z)
  const midZ = boxOf(Object.entries(tris).filter(([p]) => !/leg$/.test(p)).map(([, a]) => a)).getCenter(new THREE.Vector3()).z;
  for (const pair of ['foreleg', 'hind_leg']) {
    const all = tris[pair]; if (!all) continue; delete tris[pair];
    for (let t = 0; t < all.length; t += 9) {
      const z = (all[t + 2] + all[t + 5] + all[t + 8]) / 3;
      (tris[`${z < midZ ? 'left' : 'right'}_${pair}`] ??= []).push(...all.slice(t, t + 9));
    }
  }
  // normalise: head-and-body length 1 (humanoid: height 1), centred on that box, standing on y = 0
  const body = boxOf(Object.entries(tris).filter(([p]) => !LEAVE_OUT.test(p)).map(([, a]) => a)), all = boxOf(Object.values(tris));
  const c = body.getCenter(new THREE.Vector3()), size = body.getSize(new THREE.Vector3());
  const k = 1 / (M.upright ? size.y : size.x);
  for (const a of Object.values(tris)) for (let i = 0; i < a.length; i += 3) { a[i] = (a[i] - c.x) * k; a[i + 1] = (a[i + 1] - all.min.y) * k; a[i + 2] = (a[i + 2] - c.z) * k; }
  const out = encode(tris);
  await writeFile(`${OUT}/${key}.json`, JSON.stringify(out));
  const n = Object.values(tris).reduce((s, a) => s + a.length / 9, 0);
  console.log(`${key}: ${Object.keys(tris).sort().join(', ')} · ${Math.round(n)} triangles · ${Math.round(JSON.stringify(out).length / 1024)} KB`);
}

await MeshoptSimplifier.ready;
await mkdir(OUT, { recursive: true });
for (const [key, M] of Object.entries(MODELS)) await bake(key, M);
// BV10 a: every body type's built shape, for races with no model (files named by body type: shape_quadruped …)
for (const [id, S] of Object.entries(SHAPES)) await bake(`shape_${id}`, { shape: id, upright: S.upright });
