// The class tree (CT1-CT4): a full-screen pop-up from the class line on the character card. The
// background is one band per class tier, Common at the bottom and Legendary at the top; each class sits in its tier's
// band, arrows run from a class to the classes it opens, and a class nothing opens from is marked as a dead end. It
// shows the classes the character has and the next step from each (dimmed, with what unlocks it), never further ahead.
// Clicking a class opens its card, where the class the next level goes to is chosen.
// The links are read from the library's unlock rules (ClassDef.unlockPerk, unlockClass), so a new class links itself.
import type { Actor, ClassDef, GameState } from '../types';
import { getLibrary } from '../library';
import { CLASS_TIERS, type ClassTierKey } from '../scales';
import { classMaxLevel } from '../library/spawn';
import { levelTarget, spendXp } from '../engine/xp';
import { PK } from '../library/perkIds';
import { skillName } from './creation';
import { h } from './kit';
import { openPop, closePop } from './pop';

/** a class opening another: `via` says how ("its capstone", "level 5") */
export type ClassLink = { from: string; to: string; via: string };
export type ClassNode = {
  id: string; name: string; tier: ClassTierKey;
  /** have: the character has it; next: one link ahead of a class they have */
  shown: 'have' | 'next';
  level: number; top: number; state?: 'current' | 'unlocked' | 'previous';
  /** where the class comes from when no class opens it: skills, a start, a god's blessing, any class at its top level */
  source: string | null;
  /** nothing opens from it */
  deadEnd: boolean;
  /** its capstone can open every class (Write Your Own Ending) */
  opensAll: boolean;
  /** the class the next level goes to */
  target: boolean;
  /** it can take the next level now (had, not left behind, not at its top level) */
  pickable: boolean;
};

const perkOwner = (perk: string): { classId: string; via: string } | null => {
  for (const c of Object.values(getLibrary().classes)) {
    if (c.capstone?.includes(perk)) return { classId: c.id, via: `its capstone (level ${classMaxLevel(c.id)})` };
    for (const [lv, ids] of Object.entries(c.levelPerks ?? {})) if (ids.includes(perk)) return { classId: c.id, via: `its level ${lv} perk` };
  }
  return null;
};

/** every class-to-class link in the library */
export function classLinks(): ClassLink[] {
  const out: ClassLink[] = [];
  for (const c of Object.values(getLibrary().classes)) {
    const o = c.unlockPerk ? perkOwner(c.unlockPerk) : null;
    if (o) out.push({ from: o.classId, to: c.id, via: o.via });
    for (const [id, lv] of Object.entries(c.unlockClass ?? {})) out.push({ from: id, to: c.id, via: lv === 'max' ? 'its top level' : `level ${lv}` });
  }
  return out;
}

const orList = (g: Record<string, number>): string => {
  const e = Object.entries(g), same = e.every(([, n]) => n === e[0][1]);
  return same ? `${e.map(([k]) => skillName(k)).join(' or ')} ${e[0][1]}` : e.map(([k, n]) => `${skillName(k)} ${n}`).join(' or ');
};

/** where a class comes from other than another class: skills, a perk, a blessing, a start, any class topping out */
export function classSource(c: ClassDef): string | null {
  const lib = getLibrary(), bits: string[] = [];
  if (c.fallback) return 'any class at its top level';
  if (c.blessedBy) bits.push(`a blessing from ${lib.gods?.[c.blessedBy]?.name ?? c.blessedBy}`);
  bits.push(...Object.entries(c.unlock ?? {}).map(([k, n]) => `${skillName(k)} ${n}`), ...(c.unlockAny ?? []).map(orList));
  if (c.unlockPerkWith?.hearingDb) bits.push('a perk that sharpens hearing');
  if (c.unlockPerk && !perkOwner(c.unlockPerk)) bits.push(`the perk ${lib.perks[c.unlockPerk]?.name ?? c.unlockPerk}`);
  if (bits.length) return bits.join(' and ');
  // a start counts only for a class no other class opens (A Nobody opens from Commoner as well as starting one)
  if (Object.values(lib.starts ?? {}).some((st) => st.classId === c.id) && !(c.unlockPerk && perkOwner(c.unlockPerk)) && !c.unlockClass) return 'a start';
  return null;
}

const opensAll = (c: ClassDef) => !!(c.capstone?.includes(PK.write_your_own_ending) || c.capstones?.some((x) => x.perk === PK.write_your_own_ending));

/** the classes the tree shows for this character, with the links between them */
export function classTree(p: Actor): { nodes: ClassNode[]; links: ClassLink[] } {
  const lib = getLibrary(), all = classLinks();
  const have = new Map(p.core.classes.map((x) => [x.classId, x]));
  const next = new Set(all.filter((l) => have.has(l.from) && !have.has(l.to)).map((l) => l.to));
  // Commoner (the fallback) is always one step ahead: any class reaching its top level opens it
  for (const c of Object.values(lib.classes)) if (c.fallback && !have.has(c.id) && have.size) next.add(c.id);
  const target = levelTarget(p)?.classId;
  const nodes: ClassNode[] = Object.values(lib.classes).filter((c) => have.has(c.id) || next.has(c.id)).map((c) => {
    const e = have.get(c.id), top = classMaxLevel(c.id);
    return {
      id: c.id, name: c.name, tier: c.tier, shown: e ? 'have' : 'next', level: e?.level ?? 0, top, state: e?.state,
      source: classSource(c), deadEnd: !all.some((l) => l.from === c.id) && !opensAll(c), opensAll: opensAll(c),
      target: c.id === target, pickable: !!e && e.state !== 'previous' && e.level < top,
    };
  });
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, links: all.filter((l) => ids.has(l.from) && ids.has(l.to)) };
}

const statusText = (n: ClassNode): string =>
  n.shown === 'next' ? 'Not open yet'
    : n.level >= n.top ? `Level ${n.level} · its top level`
      : `Level ${n.level} of ${n.top}${n.state === 'current' ? ' · current' : n.state === 'previous' ? ' · left behind' : ''}`;

/** the class tree's body: the tier bands with their classes, and the link arrows drawn over them once laid out */
export function classTreeView(s: GameState, after: () => void): HTMLElement {
  const el = h('section', { class: 'ct', 'aria-label': 'Class tree' });
  const p = s.player;
  const draw = () => {
    const { nodes, links } = classTree(p);
    const tiers = [...CLASS_TIERS.keys].reverse(); // Legendary at the top, Common at the bottom
    const { col, cols } = columns(nodes, links);
    const bands = tiers.map((t) => [t, nodes.filter((n) => n.tier === t)] as const);
    const node = (n: ClassNode) => h('button', {
      type: 'button', class: `ct-node ${n.shown}${n.target ? ' target' : ''}${n.deadEnd ? ' dead' : ''}`, 'data-class': n.id, 'aria-haspopup': 'dialog',
      onclick: (e: Event) => openClassCard(s, n.id, e.currentTarget as HTMLElement, () => { draw(); after(); }),
    }, h('b', {}, n.name), h('span', { class: 'ct-st' }, statusText(n)),
      n.target ? h('span', { class: 'ct-chip next' }, 'Next level here') : null,
      n.shown === 'next' && n.source ? h('span', { class: 'ct-src' }, `From ${n.source}`) : null,
      n.deadEnd ? h('span', { class: 'ct-chip dead' }, 'Dead end') : n.opensAll ? h('span', { class: 'ct-chip all' }, 'Can open every class') : null);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ct-links');
    svg.setAttribute('aria-hidden', 'true');
    el.replaceChildren(
      h('div', { class: 'ct-h' }, h('h2', {}, 'Classes'),
        h('p', {}, 'Each band is a class tier. Arrows show which class opens which; a dead end opens nothing after it. Click a class for its card, and to choose where your next level goes.')),
      // a band with classes gets twice the height of an empty one, so the tiers stay in view and the classes have room
      h('div', { class: 'ct-bands', style: `grid-template-rows: ${bands.map(([, row]) => (row.length ? 'minmax(min-content, 2fr)' : 'minmax(32px, 1fr)')).join(' ')}` }, svg, ...bands.map(([t, row]) => h('div', { class: 'ct-band', 'data-tier': t },
        h('span', { class: 'ct-tier' }, CLASS_TIERS.name(t)), h('div', { class: 'ct-row', style: `grid-template-columns: repeat(${cols}, minmax(0, 240px))` }, row.map((n) => { const b = node(n); b.style.gridColumn = String(col.get(n.id)! + 1); b.style.gridRow = '1'; return b; }))))));
    requestAnimationFrame(() => drawLinks(el, links));
  };
  draw();
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (el.isConnected) drawLinks(el, classTree(p).links); }).observe(el);
  return el;
}

/** one column for each class, shared by every band, so a link mostly runs straight up: a class takes the column of the class
 * that opens it when that is free, else the nearest free one; a link that skips a band keeps its column clear in the bands
 * between. Bands are placed from Common up. */
export function columns(nodes: ClassNode[], links: ClassLink[]): { col: Map<string, number>; cols: number } {
  const col = new Map<string, number>(), taken = new Map<number, Set<number>>();
  const tierPos = (id: string) => CLASS_TIERS.pos(nodes.find((n) => n.id === id)!.tier);
  const use = (t: number, c: number) => { if (!taken.has(t)) taken.set(t, new Set()); taken.get(t)!.add(c); };
  const free = (t: number, c: number) => c >= 0 && !taken.get(t)?.has(c);
  for (let t = 0; t < CLASS_TIERS.keys.length; t++) {
    const row = nodes.filter((n) => CLASS_TIERS.pos(n.tier) === t);
    const want = (n: ClassNode) => { const f = links.filter((l) => l.to === n.id && col.has(l.from)).map((l) => col.get(l.from)!); return f.length ? Math.min(...f) : null; };
    row.sort((a, b) => (want(a) ?? 1e3) - (want(b) ?? 1e3) || (a.shown === b.shown ? 0 : a.shown === 'have' ? -1 : 1));
    for (const n of row) {
      const w = want(n) ?? 0;
      let c = w;
      for (let d = 1; !free(t, c); d++) c = free(t, w + d) ? w + d : w - d; // nearest free column, right before left
      col.set(n.id, c);
      use(t, c);
      // keep this column clear in the bands a link from here skips
      for (const l of links.filter((x) => x.from === n.id)) for (let k = t + 1; k < tierPos(l.to); k++) use(k, c);
    }
  }
  return { col, cols: Math.max(1, ...[...col.values()].map((c) => c + 1)) };
}

/** the arrows: from the top of a class to the bottom of the class it opens (side to side within one band) */
function drawLinks(el: HTMLElement, links: ClassLink[]): void {
  const svg = el.querySelector<SVGSVGElement>('.ct-links'), box = el.querySelector<HTMLElement>('.ct-bands');
  if (!svg || !box) return;
  const b = box.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
  const at = (id: string) => el.querySelector<HTMLElement>(`[data-class="${id}"]`)?.getBoundingClientRect();
  const paths = links.flatMap((l) => {
    const f = at(l.from), t = at(l.to);
    if (!f || !t) return [];
    const same = Math.abs(f.top - t.top) < 4;
    const [x1, y1, x2, y2] = same
      ? [f.right - b.left, f.top + f.height / 2 - b.top, t.left - b.left - 6, t.top + t.height / 2 - b.top]
      : [f.left + f.width / 2 - b.left, f.top - b.top, t.left + t.width / 2 - b.left, t.bottom - b.top + 6];
    const d = same ? `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`
      : `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
    return [`<path class="ct-link" d="${d}"><title>${l.via}</title></path>`, same
      ? `<path class="ct-head" d="M${x2},${y2 - 5} L${x2 + 6},${y2} L${x2},${y2 + 5} Z"/>`
      : `<path class="ct-head" d="M${x2 - 5},${y2} L${x2},${y2 - 6} L${x2 + 5},${y2} Z"/>`];
  });
  svg.innerHTML = paths.join('');
}

/** a class's card: its story, tier, level, class perks and capstone, how it opens and what it opens, and "Next level goes here" */
export function openClassCard(s: GameState, id: string, opener: HTMLElement | null, after: () => void): void {
  const lib = getLibrary(), c = lib.classes[id], p = s.player;
  if (!c) return;
  const n = classTree(p).nodes.find((x) => x.id === id);
  const links = classLinks();
  const name = (cid: string) => lib.classes[cid]?.name ?? cid;
  const perkNames = (ids: string[] = []) => ids.map((x) => lib.perks[x]?.name ?? x).join(', ');
  const hidden = (cid: string) => !p.core.classes.some((x) => x.classId === cid) && !classTree(p).nodes.some((x) => x.id === cid);
  const from = links.filter((l) => l.to === id), to = links.filter((l) => l.from === id);
  const row = (k: string, v: string) => [h('dt', {}, k), h('dd', {}, v)];
  openPop({ title: c.name, cls: 'ct-pop', opener, body: [
    c.story ? h('p', { class: 'ct-story' }, c.story) : null,
    h('dl', { class: 'gp-rows' },
      ...row('Tier', CLASS_TIERS.name(c.tier)),
      ...(n ? row('Level', statusText(n)) : []),
      ...Object.entries(c.levelPerks ?? {}).flatMap(([lv, ids]) => row(`Level ${lv} perk`, perkNames(ids))),
      ...(c.capstone?.length ? row('Capstone', `${perkNames(c.capstone)} at level ${classMaxLevel(id)}`) : []),
      ...row('Opens from', [...from.map((l) => `${name(l.from)} (${l.via})`), ...(n?.source ? [n.source] : [])].join('; ') || 'Only where a start begins'),
      ...row('Leads to', to.length ? to.map((l) => (hidden(l.to) ? `a class not shown yet (${l.via})` : `${name(l.to)} (${l.via})`)).join('; ')
        : opensAll(c) ? 'Its capstone can open every class' : 'Nothing: a dead end')),
    n?.pickable ? (n.target
      ? h('p', { class: 'ct-now' }, 'Your next level goes here.')
      : h('button', { type: 'button', class: 'hs-btn-main', 'data-pick': id, onclick: () => {
        p.progression!.nextClass = id;
        spendXp(s);
        closePop();
        after();
      } }, 'Next level goes here'))
      : n?.shown === 'have' && n.level >= n.top ? h('p', { class: 'hs-note' }, 'At its top level: it takes no more levels.') : null,
  ] });
}
