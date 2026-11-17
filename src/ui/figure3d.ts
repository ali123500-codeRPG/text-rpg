// BV1-BV6, BV14: the 3D body figure. One shared WebGL renderer (browsers allow only a few live contexts) draws each
// figure into its own 2D canvas; a still figure is drawn once, a turnable one again on every drag. Each race's model is
// a small file (assets/figures/<key>.json, baked by scripts/figures.mjs) fetched only when a figure first needs it (BV15),
// split into the library's part ids (BV11) and scaled to the being's size (BV3 a). Ground: the being's footprint
// capsule (SZ4), rings, and a faint person of the human body type's size (BV6 a). It never turns by itself (BV5 a).
import {
  AmbientLight, Box3, BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, Group, HemisphereLight, Line, LineBasicMaterial,
  LineLoop, Mesh, MeshStandardMaterial, PerspectiveCamera, Raycaster, Scene, Sphere, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BodySize } from '../types';

/** a baked figure: its parts' geometry in unit size (head-and-body length 1, or height 1 when upright) */
type Unit = { parts: Record<string, BufferGeometry> };
type FigureFile = { v: number; box: number[]; parts: Record<string, [string, string, number]> };
const units = new Map<string, Promise<Unit | null>>();

const bytes = (b64: string): ArrayBuffer => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
function decode(f: FigureFile): Unit {
  const lo = f.box.slice(0, 3), span = [0, 1, 2].map((k) => f.box[k + 3] - f.box[k] || 1);
  const parts: Record<string, BufferGeometry> = {};
  for (const [id, [p, i, wide]] of Object.entries(f.parts)) {
    const q = new Int16Array(bytes(p)), pos = new Float32Array(q.length);
    for (let k = 0; k < q.length; k++) pos[k] = lo[k % 3] + ((q[k] + 32767) / 65534) * span[k % 3];
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setIndex(new BufferAttribute(wide ? new Uint32Array(bytes(i)) : new Uint16Array(bytes(i)), 1));
    g.computeVertexNormals();
    parts[id] = g;
  }
  return { parts };
}
/** the figure file, fetched once per page (null when it cannot load: the part list beside it still names every state) */
export function loadUnit(key: string): Promise<Unit | null> {
  let u = units.get(key);
  if (!u) {
    u = fetch(`assets/figures/${key}.json`).then((r) => (r.ok ? r.json() : null)).then((f: FigureFile | null) => (f ? decode(f) : null)).catch(() => null);
    units.set(key, u);
  }
  return u;
}

export type FigureSpec = {
  key: string; // figureKey(): the race's model or the body type's built shape
  upright: boolean; // a humanoid: sized by height, facing the viewer
  size: BodySize; // this being's (bodySize)
  raceSize: BodySize; // its race's own: each measure stretches by size ÷ raceSize (BV3 a)
  personSize: BodySize; // the human body type's, for the faint person (BV6 a)
  /** a part's colour as a CSS custom property name (--ok …), see-through when Destroyed */
  tint: (part: string) => { token: string; seeThrough?: boolean };
  label: string;
  width: number; height: number; // CSS pixels
  turnable: boolean; // BV1 b: turnable where it is drawn large; still in the side sheet
  ground?: boolean; // footprint, rings and the person (left out where the figure is very small)
  onPick?: (part: string | null, e: MouseEvent) => void;
};

/** BV6: past this many times the person's height the person is dropped and the rings carry the size */
const PERSON_DROP = 20;
const css = (token: string) => getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#888';

let shared: WebGLRenderer | null = null;
function renderer(): WebGLRenderer | null {
  if (shared) return shared;
  try { shared = new WebGLRenderer({ antialias: true, alpha: true }); } catch { return null; }
  shared.setClearColor(0x000000, 0);
  return shared;
}

/** the footprint capsule (SZ4): its long measure as the axis, the short one as the ends' diameter */
function capsule(len: number, wid: number, alongX: boolean, mat: LineBasicMaterial): LineLoop {
  const r = Math.min(len, wid) / 2, half = Math.max(len, wid) / 2 - r, pts: Vector3[] = [];
  for (const side of [1, -1]) for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + (i / 24) * Math.PI, x = side * (half + r * Math.cos(a)), z = side * r * Math.sin(a);
    pts.push(alongX === len >= wid ? new Vector3(x, 0.002, z) : new Vector3(z, 0.002, x));
  }
  return new LineLoop(new BufferGeometry().setFromPoints(pts), mat);
}
function rings(radius: number, mat: LineBasicMaterial): { g: Group; step: number } {
  const g = new Group(), step = [0.5, 1, 2, 5, 10, 50, 100].find((s) => radius / s <= 4) ?? 500;
  for (let r = step; r <= radius + 1e-6; r += step) {
    const pts: Vector3[] = []; for (let i = 0; i <= 72; i++) { const a = (i / 72) * Math.PI * 2; pts.push(new Vector3(Math.cos(a) * r, 0.001, Math.sin(a) * r)); }
    g.add(new Line(new BufferGeometry().setFromPoints(pts), mat));
  }
  return { g, step };
}

type Live = { scene: Scene; camera: PerspectiveCamera; body: Group; mats: Record<string, MeshStandardMaterial>; draw: () => void };
/** the figure's element: its live scene once built, and a promise of it (null when it could not load) */
type Wrap = HTMLElement & { f3d?: Live; f3dReady?: Promise<Live | null> };

/** a 3D figure element; it draws once its file has loaded. el.dataset.parts lists the parts it shows. */
export function figure3d(spec: FigureSpec): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'f3d' + (spec.turnable ? ' f3d-turn' : '');
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(spec.width * dpr); canvas.height = Math.round(spec.height * dpr);
  canvas.style.width = `${spec.width}px`; canvas.style.height = `${spec.height}px`;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', spec.label);
  wrap.appendChild(canvas);
  (wrap as Wrap).f3dReady = loadUnit(spec.key).then((unit) => {
    const live = unit ? build(wrap, canvas, spec, unit, dpr) : null;
    if (!live) wrap.classList.add('f3d-none');
    return live;
  });
  return wrap;
}

function build(wrap: HTMLElement, canvas: HTMLCanvasElement, spec: FigureSpec, unit: Unit, dpr: number): Live | null {
  const gl = renderer();
  if (!gl) return null;
  const scene = new Scene();
  scene.add(new HemisphereLight(0xdfe8ff, 0x1a2244, 1.6), new AmbientLight(0xffffff, 0.15));
  const sun = new DirectionalLight(0xffffff, 1.8); sun.position.set(3, 6, 4); scene.add(sun);
  const rim = new DirectionalLight(0x93c5ff, 0.9); rim.position.set(-4, 3, -5); scene.add(rim);
  // BV3 a: one even scale from the race's length (upright: height), then each measure by this being's size ÷ its race's
  const { size: s, raceSize: r } = spec;
  const fit = spec.upright ? r.heightM : r.lengthM;
  const body = new Group();
  if (spec.upright) body.scale.set(fit * s.widthM / r.widthM, s.heightM, fit * s.lengthM / r.lengthM);
  else body.scale.set(s.lengthM, fit * s.heightM / r.heightM, fit * s.widthM / r.widthM);
  const mats: Record<string, MeshStandardMaterial> = {};
  for (const [id, g] of Object.entries(unit.parts)) {
    const t = spec.tint(id);
    const m = (mats[id] = new MeshStandardMaterial({ color: new Color(css(t.token)), roughness: 0.7, flatShading: true, side: DoubleSide,
      transparent: !!t.seeThrough, opacity: t.seeThrough ? 0.28 : 1, depthWrite: !t.seeThrough }));
    const mesh = new Mesh(g, m); mesh.userData.part = id; body.add(mesh);
  }
  wrap.dataset.parts = Object.keys(unit.parts).join(' ');
  scene.add(body);
  const box = new Box3().setFromObject(body), fitBox = box.clone(), sz = box.getSize(new Vector3());
  if (spec.ground !== false) {
    const line = new LineBasicMaterial({ color: new Color(css('--rule')), transparent: true, opacity: 0.9 });
    const foot = new LineBasicMaterial({ color: new Color(css('--muted')), transparent: true, opacity: 0.9 });
    // the footprint: length along the facing (+x; an upright being faces +z, so its width lies along x)
    scene.add(capsule(s.lengthM, s.widthM, !spec.upright, foot));
    const reach = Math.max(sz.x, sz.z) / 2 + 0.2;
    const rg = rings(Math.ceil(reach * 2) / 2, line); scene.add(rg.g);
    // the faint person beside a non-person, dropped past PERSON_DROP times its height
    if (!spec.upright && Math.max(s.heightM, s.lengthM) <= PERSON_DROP * spec.personSize.heightM) {
      void loadUnit('shape_humanoid').then((p) => {
        if (!p) return;
        const ghost = new Group(), gm = new MeshStandardMaterial({ color: new Color(css('--muted')), transparent: true, opacity: 0.16, depthWrite: false });
        for (const g of Object.values(p.parts)) ghost.add(new Mesh(g, gm));
        ghost.scale.setScalar(spec.personSize.heightM); // the built person is one unit tall
        ghost.position.set(-(sz.x / 2 + 0.45), 0, sz.z / 2 + 0.3);
        scene.add(ghost); fitBox.expandByObject(ghost); frame(); live.draw();
      });
    }
  }
  const camera = new PerspectiveCamera(30, spec.width / spec.height, 0.01, 1000);
  const controls = spec.turnable ? new OrbitControls(camera, canvas) : null;
  const frame = () => {
    const sphere = fitBox.getBoundingSphere(new Sphere());
    const dist = (sphere.radius / Math.sin((camera.fov / 2) * Math.PI / 180)) * 0.95 / Math.min(1, spec.width / spec.height);
    camera.position.copy(sphere.center).addScaledVector(new Vector3(0.75, 0.42, 1).normalize(), dist);
    camera.near = dist / 100; camera.far = dist * 10; camera.updateProjectionMatrix();
    camera.lookAt(sphere.center);
    if (controls) { controls.target.copy(sphere.center); controls.minDistance = dist * 0.35; controls.maxDistance = dist * 2; controls.update(); }
  };
  const ctx = canvas.getContext('2d')!;
  const live: Live = {
    scene, camera, body, mats,
    draw: () => {
      gl.setPixelRatio(dpr); gl.setSize(spec.width, spec.height, false);
      gl.render(scene, camera);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(gl.domElement, 0, 0, canvas.width, canvas.height);
    },
  };
  (wrap as Wrap).f3d = live;
  frame(); live.draw();
  if (controls) {
    controls.enablePan = false; controls.minPolarAngle = 0.15; controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.addEventListener('change', live.draw);
    canvas.addEventListener('dblclick', () => { frame(); live.draw(); });
  }
  if (spec.onPick) {
    let down: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('click', (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) { e.stopPropagation(); return; } // a drag turned it: not a pick
      const rect = canvas.getBoundingClientRect();
      const ray = new Raycaster(); ray.setFromCamera(new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
      const hit = ray.intersectObject(body, true)[0];
      spec.onPick!((hit?.object.userData.part as string) ?? null, e);
    });
  }
  return live;
}

/** M-30: a part whose state changed this turn shows its old colour, then turns and dips once at the beat (a figure
 * still loading pulses once it is drawn) */
export function figurePulse(wrap: Element | null, part: string, fromToken: string, toToken: string, delay: number, dur: number): void {
  const w = wrap as Wrap | null;
  if (w && !w.f3d) { void w.f3dReady?.then((l) => { if (l) pulse(l, part, fromToken, toToken, delay, dur); }); return; }
  if (w?.f3d) pulse(w.f3d, part, fromToken, toToken, delay, dur);
}
function pulse(live: Live, part: string, fromToken: string, toToken: string, delay: number, dur: number): void {
  const m = live.mats[part];
  if (!m) return;
  const from = new Color(css(fromToken)), to = new Color(css(toToken)), base = m.opacity;
  m.color.copy(from); live.draw();
  const start = performance.now() + delay;
  const step = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - start) / dur));
    m.color.copy(from).lerp(to, Math.min(1, t / 0.35));
    m.transparent = true; m.opacity = base * (t < 0.35 ? 1 - 0.65 * (t / 0.35) : 0.35 + 0.65 * ((t - 0.35) / 0.65));
    live.draw();
    if (t < 1) requestAnimationFrame(step); else { m.opacity = base; m.transparent = base < 1; live.draw(); }
  };
  requestAnimationFrame(step);
}
