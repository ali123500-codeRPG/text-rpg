// FR5: furniture on the map. One small line glyph per furniture kind (the FU table), drawn in a 12 × 12 box around its point
// and set on a disc so it reads over the floor. Kinds without a glyph of their own use the "other" diamond.
import { FU } from '../library/tableIds';

const SVG = 'http://www.w3.org/2000/svg';
const s = (tag: string, attrs: Record<string, string | number> = {}, ...kids: (Node | string)[]) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  e.append(...kids);
  return e;
};
type Part = [string, Record<string, number | string>];
const R = (x: number, y: number, width: number, height: number, rx = 0.5): Part => ['rect', { x, y, width, height, rx }];
const C = (cx: number, cy: number, r: number): Part => ['circle', { cx, cy, r }];
const P = (d: string): Part => ['path', { d }];
const FLAME = 'M0 1c-1.6-1-1.2-2.8 0-4.5c1.2 1.7 1.6 3.5 0 4.5z';

/** the glyph of each kind, around 0,0 */
export const FURN_GLYPH: Record<string, Part[]> = {
  [FU.counter]: [R(-6, -2, 12, 4)],
  [FU.hearth]: [P('M-5 5V0a5 5 0 0 1 10 0v5'), P('M0 4c-1.8-1.2-1.3-3.2 0-5c1.3 1.8 1.8 3.8 0 5z')],
  [FU.table]: [R(-5, -3.5, 10, 7, 1)],
  [FU.bench]: [R(-6, -1.5, 12, 3)],
  [FU.bed]: [R(-4, -6, 8, 12, 1), P('M-4 -2.5h8')],
  [FU.barrels]: [C(-2.8, -2, 2.6), C(2.8, -2, 2.6), C(0, 2.8, 2.6)],
  [FU.shelves]: [R(-6, -3, 12, 6), P('M-6 0h12')],
  [FU.crates]: [R(-5, -5, 10, 10), P('M-5 -5L5 5M5 -5L-5 5')],
  [FU.sacks]: [P('M-2 -4h4l-1 2c3 1 4 6 1 7h-4c-3-1-2-6 1-7z')],
  [FU.anvil]: [P('M-6 -3h12l-3 3h-1v2h2v2h-8v-2h2v-2h-1z')],
  [FU.forge]: [R(-5, 0, 10, 5), P(FLAME.replace('M0 1', 'M0 -0.5'))],
  [FU.rack]: [P('M-6 -3h12M-4 -5v10M0 -5v10M4 -5v10')],
  [FU.brazier]: [P('M-5 -0.5h10l-2 3.5h-6z'), P('M-2 3l-2 3M2 3l2 3'), P(FLAME.replace('M0 1', 'M0 -1'))],
  [FU.woodpile]: [C(-3, 2.2, 2), C(1, 2.2, 2), C(-1, -1.6, 2), C(3, -1.6, 2)],
  [FU.water_barrel]: [C(0, 0, 5), P('M-3 0q1.5-1.5 3 0t3 0')],
  [FU.stool]: [C(0, 0, 3.5)],
  [FU.chair]: [R(-3.5, -2, 7, 6), P('M-3.5 -4.5h7')],
  [FU.cupboard]: [R(-5, -5, 10, 10), P('M0 -5v10')],
  [FU.well]: [C(0, 0, 5), C(0, 0, 2.4)],
  [FU.cart]: [R(-6, -4, 12, 5), C(-3.5, 3.5, 2), C(3.5, 3.5, 2)],
  [FU.fence]: [P('M-6 -4v8M0 -4v8M6 -4v8M-6 -1.5h12M-6 1.5h12')],
  [FU.rail]: [P('M-6 -1h12M-6 1.5h12M-5 -1v5M5 -1v5')],
  [FU.altar]: [R(-5, 0, 10, 5), P('M-1 0v-3h2v3'), P(FLAME.replace('M0 1', 'M0 -3'))],
  [FU.other]: [P('M0 -4.5L4.5 0L0 4.5L-4.5 0z')],
};

/** a furniture icon at x, y (map pixels): a disc with the kind's glyph, named on hover */
export function furnIcon(kind: string, name: string, x: number, y: number, scale = 1): SVGElement {
  const parts = FURN_GLYPH[kind] ?? FURN_GLYPH[FU.other];
  return s('g', { class: 'map-furn', 'data-furn': kind, transform: `translate(${x} ${y}) scale(${scale})`, role: 'img', 'aria-label': name },
    s('circle', { class: 'disc', cx: 0, cy: 0, r: 9 }), ...parts.map(([tag, a]) => s(tag, a)), s('title', {}, name));
}

/** the map key's furniture mark */
export const furnKey = (): SVGElement =>
  s('svg', { class: 'k-furn', width: 20, height: 20, viewBox: '-10 -10 20 20', 'aria-hidden': 'true' }, furnIcon(FU.table, 'Furniture', 0, 0));
