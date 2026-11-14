// The class tree (CT1-CT4): a full-screen pop-up from the class line on the character card. The
// background is one band per class tier, side by side, Common on the left and Legendary on the right; each class sits in
// its tier's band, arrows run from a class to the classes it opens, and a class nothing opens from is marked as a dead end.
// It shows the classes the character has and the next step from each (dimmed, with what unlocks it), never further ahead.
// A gold thread, the character's own, joins the classes they levelled in the order they took them, from where they
// started; picking another class for the next level draws its next stretch, dashed until the level lands.
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
import { classIcon } from './itemIcons';
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

/** one stretch of the character's thread: from a class they levelled to the next; planned = the picked next class, no level yet */
export type ClassThread = { from: string; to: string; planned: boolean };

/** the character's own path: the classes they have levelled, in the order they first took a level in each (from the
 * level log); a class levelled before the log began (the start's class) comes first */
export function classPath(p: Actor): string[] {
  const had = p.core.classes.filter((c) => c.level > 0).map((c) => c.classId), seq: string[] = [];
  for (const x of p.progression?.xpLog ?? []) { const id = x.levelUp?.classId; if (id && had.includes(id) && !seq.includes(id)) seq.push(id); }
  return [...had.filter((id) => !seq.includes(id)), ...seq];
}

/** the thread's stretches: each class on the path to the next, and on to the picked class while its level waits */
export function classThread(p: Actor): ClassThread[] {
  const path = classPath(p), out = path.slice(1).map((to, i) => ({ from: path[i], to, planned: false }));
  const target = levelTarget(p)?.classId, last = path[path.length - 1];
  if (target && last && !path.includes(target)) out.push({ from: last, to: target, planned: true });
  return out;
}

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

/** the class tree's body: the tier bands with their classes, and the link arrows and the thread drawn over them once laid out */
export function classTreeView(s: GameState, after: () => void): HTMLElement {
  const el = h('section', { class: 'ct', 'aria-label': 'Class tree' });
  const p = s.player;
  const draw = () => {
    const { nodes, links } = classTree(p);
    const start = classPath(p)[0];
    const { lane, lanes: n } = lanes(nodes, links);
    const bands = CLASS_TIERS.keys.map((t) => [t, nodes.filter((x) => x.tier === t)] as const); // Common on the left
    const node = (x: ClassNode) => h('button', {
      type: 'button', class: `ct-node ${x.shown}${x.target ? ' target' : ''}${x.deadEnd ? ' dead' : ''}`, 'data-class': x.id, 'aria-haspopup': 'dialog',
      onclick: (e: Event) => openClassCard(s, x.id, e.currentTarget as HTMLElement, () => { draw(); after(); }),
    }, h('span', { class: 'ct-name' }, classIcon(x.id), h('b', {}, x.name)), h('span', { class: 'ct-st' }, statusText(x)),
      x.id === start ? h('span', { class: 'ct-chip start' }, 'Started here') : null,
      x.target ? h('span', { class: 'ct-chip next' }, 'Next level here') : null,
      x.shown === 'next' && x.source ? h('span', { class: 'ct-src' }, `From ${x.source}`) : null,
      x.deadEnd ? h('span', { class: 'ct-chip dead' }, 'Dead end') : x.opensAll ? h('span', { class: 'ct-chip all' }, 'Can open every class') : null);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ct-links');
    svg.setAttribute('aria-hidden', 'true');
    el.replaceChildren(
      h('div', { class: 'ct-h' }, h('h2', {}, 'Classes'),
        h('p', {}, 'Each band is a class tier, Common on the left. Arrows show which class opens which; a dead end opens nothing after it. The gold thread is your path, from where you started. Click a class for its card, and to choose where your next level goes.')),
      // a band with classes is twice as wide as an empty one, so every tier stays in view and the classes have room
      h('div', { class: 'ct-bands', style: `grid-template-columns: ${bands.map(([, col]) => (col.length ? 'minmax(min-content, 2fr)' : 'minmax(104px, 1fr)')).join(' ')}` }, svg, ...bands.map(([t, col]) => h('div', { class: 'ct-band', 'data-tier': t },
        h('span', { class: 'ct-tier' }, CLASS_TIERS.name(t)), h('div', { class: 'ct-col', style: `grid-template-rows: repeat(${n}, minmax(0, 1fr))` }, col.map((x) => { const b = node(x); b.style.gridRow = String(lane.get(x.id)! + 1); b.style.gridColumn = '1'; return b; }))))));
    requestAnimationFrame(() => drawLinks(el, links, classThread(p)));
  };
  draw();
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (el.isConnected) drawLinks(el, classTree(p).links, classThread(p)); }).observe(el);
  return el;
}

/** one lane (row) for each class, shared by every band, so a link mostly runs straight across: a class takes the lane of
 * the class that opens it when that is free, else the nearest free one; a link that skips a band keeps its lane clear in
 * the bands between. Bands are placed from Common on. */
export function lanes(nodes: ClassNode[], links: ClassLink[]): { lane: Map<string, number>; lanes: number } {
  const lane = new Map<string, number>(), taken = new Map<number, Set<number>>();
  const tierPos = (id: string) => CLASS_TIERS.pos(nodes.find((n) => n.id === id)!.tier);
  const use = (t: number, c: number) => { if (!taken.has(t)) taken.set(t, new Set()); taken.get(t)!.add(c); };
  const free = (t: number, c: number) => c >= 0 && !taken.get(t)?.has(c);
  for (let t = 0; t < CLASS_TIERS.keys.length; t++) {
    const band = nodes.filter((n) => CLASS_TIERS.pos(n.tier) === t);
    const want = (n: ClassNode) => { const f = links.filter((l) => l.to === n.id && lane.has(l.from)).map((l) => lane.get(l.from)!); return f.length ? Math.min(...f) : null; };
    band.sort((a, b) => (want(a) ?? 1e3) - (want(b) ?? 1e3) || (a.shown === b.shown ? 0 : a.shown === 'have' ? -1 : 1));
    for (const n of band) {
      const w = want(n) ?? 0;
      let c = w;
      for (let d = 1; !free(t, c); d++) c = free(t, w + d) ? w + d : w - d; // nearest free lane, below before above
      lane.set(n.id, c);
      use(t, c);
      // keep this lane clear in the bands a link from here skips
      for (const l of links.filter((x) => x.from === n.id)) for (let k = t + 1; k < tierPos(l.to); k++) use(k, c);
    }
  }
  return { lane, lanes: Math.max(1, ...[...lane.values()].map((c) => c + 1)) };
}

/** the arrows, from the right of a class to the left of the class it opens (top to bottom within one band), and the
 * thread: a link it follows turns gold, and a stretch no link carries gets a gold line of its own */
function drawLinks(el: HTMLElement, links: ClassLink[], thread: ClassThread[]): void {
  const svg = el.querySelector<SVGSVGElement>('.ct-links'), box = el.querySelector<HTMLElement>('.ct-bands');
  if (!svg || !box) return;
  const b = box.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
  const at = (id: string) => el.querySelector<HTMLElement>(`[data-class="${id}"]`)?.getBoundingClientRect();
  const curve = (from: string, to: string, cls: string, title: string) => {
    const f = at(from), t = at(to);
    if (!f || !t) return [];
    const same = Math.abs(f.left - t.left) < 4, down = t.top > f.top;
    const [x1, y1, x2, y2] = same
      ? [f.left + f.width / 2 - b.left, (down ? f.bottom : f.top) - b.top, t.left + t.width / 2 - b.left, (down ? t.top - 6 : t.bottom + 6) - b.top]
      : [f.right - b.left, f.top + f.height / 2 - b.top, t.left - b.left - 6, t.top + t.height / 2 - b.top];
    const d = same ? `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`
      : `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
    const head = same ? (down ? `M${x2 - 5},${y2} L${x2},${y2 + 6} L${x2 + 5},${y2} Z` : `M${x2 - 5},${y2} L${x2},${y2 - 6} L${x2 + 5},${y2} Z`)
      : `M${x2},${y2 - 5} L${x2 + 6},${y2} L${x2},${y2 + 5} Z`;
    return [`<path class="ct-link${cls}" d="${d}"><title>${title}</title></path>`, `<path class="ct-head${cls}" d="${head}"/>`];
  };
  const on = (l: { from: string; to: string }) => thread.find((x) => x.from === l.from && x.to === l.to);
  svg.innerHTML = [
    ...links.flatMap((l) => { const th = on(l); return curve(l.from, l.to, th ? (th.planned ? ' gold planned' : ' gold') : '', l.via); }),
    ...thread.filter((x) => !links.some((l) => l.from === x.from && l.to === x.to)).flatMap((x) => curve(x.from, x.to, x.planned ? ' gold planned' : ' gold', 'your path')),
  ].join('');
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
