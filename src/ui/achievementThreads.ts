// The Achievements page as threads (BG-215 follow-up): each chain is a gold thread with a knot per level. A held
// level is a tied knot, the next level a loose knot with the thread filled as far as the tally has come, and later levels
// not drawn: a short fading tail after the next knot says more follow (TB5: only the next row's count shows). A chain's branches hang from its trunk, one thread per kind
// (Sight, Influence…), and fold away under the trunk. Clicking a chain's name or a knot opens the side panel.
import type { AchievementDef, GameState } from '../types';
import { getLibrary } from '../library';
import { achXp, achievementInfo, achievementName, earnedAtText, kindName } from '../engine/xp';
import { branchLabel, chainRows, chainTag, endInSight, heldChains, isBareHead, type HeldChain } from '../ruleset/achChains';
import { ACH_HEAD_NAMES } from '../library/achievementIds';
import { h, openPanel, plural, type PanelRow } from './kit';
import { cap } from '../words';

export type Knot = { key: string; of?: string; level: string; label: string; name: string; state: 'held' | 'next' | 'later'; turn?: number };
export type Thread = { root: string; of?: string; kind?: string; knots: Knot[]; have?: number; need?: number; endless?: true };
export type ChainView = { id: string; tag: string; name: string; place: string; xp: number; turn: number; rows: number;
  trunk?: Thread; branches: { label: string; threads: Thread[] }[] };

const lib = (): Record<string, AchievementDef> => getLibrary().achievements ?? {};
const roman = (n: number): string => n < 1 || n > 39 ? String(n) : 'X'.repeat(Math.floor(n / 10)) + ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n % 10];
const fmt = (n: number) => n.toLocaleString('en');
const mine = (s: GameState) => s.player.progression?.achievements ?? [];

/** the tally a row counts against, as tally() keys it */
function tallyOf(s: GameState, d: AchievementDef, of?: string): number {
  const t = s.player.progression?.tally ?? {};
  return t[d.by && of ? `${d.rule}:${d.by}:${of}` : d.rule] ?? 0;
}

/** one chain (root, kind) as a thread of knots */
function threadOf(s: GameState, c: HeldChain): Thread {
  const L = lib(), root = L[c.root];
  if (root?.every) {
    // an every-N row: one knot per time it was earned, then the next multiple
    const got = mine(s).filter((m) => m.key === c.root && m.of).map((m) => ({ n: Number(m.of), m })).sort((a, b) => a.n - b.n);
    const knots: Knot[] = got.map(({ n, m }, i) => ({ key: c.root, of: m.of, level: roman(i + 1), label: fmt(n), name: achievementName(s, m), state: 'held', turn: m.turn }));
    const nextN = (got.length ? got[got.length - 1].n : root.count ?? 0) + (got.length ? root.every : 0);
    knots.push({ key: c.root, of: String(nextN), level: roman(got.length + 1), label: fmt(nextN), name: '', state: 'next' });
    return { root: c.root, knots, have: tallyOf(s, root), need: nextN, endless: true };
  }
  const knots = c.rows.map((k, i): Knot => {
    const d = L[k], held = c.held.includes(k), m = held ? mine(s).find((x) => x.key === k && (x.of ?? '') === (c.of ?? '')) : undefined;
    return { key: k, ...(c.of ? { of: c.of } : {}), level: roman(i + 1), label: d.count !== undefined ? fmt(d.count) : '', name: m ? achievementName(s, m) : '',
      state: held ? 'held' : k === c.next ? 'next' : 'later', ...(m ? { turn: m.turn } : {}) };
  });
  const nd = c.next ? L[c.next] : undefined;
  return { root: c.root, ...(c.of ? { of: c.of, kind: kindName(s, root, c.of) } : {}), knots,
    ...(nd?.count !== undefined ? { have: tallyOf(s, nd, c.of), need: nd.count } : {}) };
}

/** a branch's heading: its kind ("By function"), or, for a branch that counts no kind, what it counts ("Zones entered") */
function branchName(s: GameState, root: string): string {
  const d = lib()[root];
  if (d.by || d.only) return cap(branchLabel(d));
  return cap(earnedAtText(s, { ...d, count: 2 }).replace(/^[\d,]+ /, ''));
}

/** every chain the player has started, one view per chain head, with its trunk and its branches grouped by kind of branch */
export function chainViews(s: GameState, scars: boolean): ChainView[] {
  const L = lib();
  return [...heldChains(s, scars)].map(([id, chains]): ChainView => {
    const head = id.split(':')[0];
    const trunkC = chains.find((c) => c.root === head);
    // a chain started only through a branch still shows its trunk, bare, with the trunk's first count as the next knot (TB5)
    const rows0 = !trunkC && !isBareHead(head) && L[head] ? chainRows(head) : [];
    const trunk = trunkC ? threadOf(s, trunkC) : rows0.length ? threadOf(s, { root: head, rows: rows0, held: [], current: '', next: rows0[0] }) : undefined;
    const byRoot = new Map<string, HeldChain[]>();
    for (const c of chains.filter((x) => x !== trunkC)) byRoot.set(c.root, [...(byRoot.get(c.root) ?? []), c]);
    const branches = [...byRoot].map(([root, cs]) => ({ label: branchName(s, root), threads: cs.map((c) => threadOf(s, c)) }));
    const earned = mine(s).filter((m) => chains.some((c) => c.held.includes(m.key ?? '') && (L[c.root]?.every || (m.of ?? '') === (c.of ?? ''))));
    const latest = earned.reduce((a, b) => (b.turn > a.turn ? b : a), earned[0]);
    const cur = trunk ? [...trunk.knots].reverse().find((k) => k.state === 'held') : undefined;
    const name = isBareHead(head) ? ACH_HEAD_NAMES[head].name : cur?.name || achievementName(s, latest);
    const heldN = trunk ? trunk.knots.filter((k) => k.state === 'held').length : 0;
    const place = !trunkC ? '' : !L[head]?.every ? `${roman(heldN)} of ${endInSight(trunkC) ? roman(trunk!.knots.length) : '?'}` : plural(heldN, 'time', 'times');
    return { id, tag: chainTag(head), name, place, xp: earned.reduce((n, m) => n + achXp(L[m.key!], m.of), 0), turn: latest.turn, rows: earned.length,
      ...(trunk ? { trunk } : {}), branches };
  });
}

// ---------- drawing ----------

/** a knot's side panel: how it is earned, and, when held, when and what it paid */
function knotPanel(s: GameState, k: Knot, scars: boolean) {
  const d = lib()[k.key];
  const m = mine(s).find((x) => x.key === k.key && (x.of ?? '') === (k.of ?? ''));
  const rows: PanelRow[] = [{ k: 'Level', v: k.level }, { k: 'How it is earned', v: cap(earnedAtText(s, d, k.of)) }];
  if (m) {
    const info = achievementInfo(s, m);
    rows.unshift({ k: 'Name', v: info.name });
    rows.push({ k: 'You earned it', v: info.why }, { k: 'Reward', v: [`${info.xp} XP`, ...info.rewards].join(' · ') });
  } else rows.push({ k: 'Not yet', v: k.state === 'next' ? 'This is the next level of the chain.' : "A later level."});
  openPanel(scars ? 'Scar' : 'Achievement', rows);
}

/** one thread: its held knots and the next one on a line, the stretch to the next knot filled as far as the tally has come;
 * later levels are not drawn, only a short fading tail after the next knot says the chain goes on */
function threadEl(s: GameState, t: Thread, scars: boolean): HTMLElement {
  const pct = t.need ? Math.max(0, Math.min(100, Math.round(100 * (t.have ?? 0) / t.need))) : 0;
  const more = t.endless || t.knots.some((k) => k.state === 'later');
  const knots = t.knots.filter((k) => k.state !== 'later').flatMap((k, i) => {
    const title = k.state === 'held' ? `${k.name}, level ${k.level}` : `Next level: ${k.label}${t.need ? ` (${fmt(t.have ?? 0)} of ${fmt(t.need)})` : ''}`;
    const knot = h('button', { type: 'button', class: `th-knot ${k.state}`, 'aria-label': title, title, onclick: () => knotPanel(s, k, scars) },
      h('span', { class: 'th-bead', 'aria-hidden': 'true' }, k.level),
      h('span', { class: 'th-at' }, k.state === 'next' && t.need ? `${fmt(t.have ?? 0)} / ${fmt(t.need)}` : k.label));
    // the stretch of thread before this knot: whole when this knot is held, part-filled up to the next knot
    const fill = k.state === 'held' ? 100 : pct;
    return [i ? h('span', { class: 'th-seg', style: `--fill:${fill}%`, 'aria-hidden': 'true' }) : null, knot];
  });
  return h('div', { class: 'th-thread' },
    h('div', { class: 'th-line', role: 'group', 'aria-label': more ? 'Levels so far; more levels follow' : 'Levels' }, knots,
      more ? h('span', { class: 'th-tail', title: 'More levels follow', 'aria-hidden': 'true' }) : null));
}

const OPEN_KEY = 'ach-open';
const loadOpen = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]')); } catch { return new Set(); } };
const saveOpen = (o: Set<string>) => { try { localStorage.setItem(OPEN_KEY, JSON.stringify([...o])); } catch { /* a convenience only */ } };
export const openChains = loadOpen();

/** one chain card: its name and place, the trunk thread, and its branches folded under a toggle */
export function chainCard(s: GameState, v: ChainView, scars: boolean, redraw: () => void, detail: () => void): HTMLElement {
  const nBranch = v.branches.length;
  const always = !v.trunk; // a head with no trunk of its own is its branches: nothing to fold
  const open = always || openChains.has(v.id);
  const toggle = () => { if (open) openChains.delete(v.id); else openChains.add(v.id); saveOpen(openChains); redraw(); };
  const bid = `th-br-${v.id.replace(/[^a-z0-9]/gi, '_')}`;
  return h('article', { class: `th-chain${scars ? ' scar' : ''}${open ? ' open' : ''}`, 'data-chain': v.id },
    h('header', { class: 'th-head' },
      // the title sits centred over the trunk; the fold toggle keeps to the right
      h('div', { class: 'th-title' },
        h('button', { type: 'button', class: 'th-name', onclick: detail }, v.name),
        h('div', { class: 'th-sub' }, v.place ? h('span', { class: 'th-place' }, v.place) : null,
          h('span', { class: 'th-meta' }, `${fmt(v.xp)} XP · turn ${v.turn}`))),
      nBranch && !always ? h('button', { type: 'button', class: 'th-fold', 'aria-expanded': String(open), 'aria-controls': bid, onclick: toggle },
        h('span', { class: 'th-chev', 'aria-hidden': 'true' }), plural(nBranch, 'branch', 'branches')) : null),
    v.trunk ? threadEl(s, v.trunk, scars) : null,
    nBranch ? h('div', { class: 'th-branches', id: bid, hidden: !open },
      // every branch thread is its own section headed like a plain branch: "By race · Human", then its thread under it
      v.branches.flatMap((b) => b.threads.map((t) => h('section', { class: 'th-branch' },
        h('h4', { class: 'th-blabel' }, t.kind ? [h('span', { class: 'th-bgroup' }, `${b.label} · `), h('span', { class: 'th-bkind' }, t.kind)] : b.label),
        threadEl(s, t, scars))))) : null);
}

/** Expand all / Collapse all, for the chains that have branches */
export function foldAll(views: ChainView[], redraw: () => void): HTMLElement | null {
  const withB = views.filter((v) => v.branches.length && v.trunk);
  if (!withB.length) return null;
  const allOpen = withB.every((v) => openChains.has(v.id));
  return h('button', { type: 'button', class: 'hs-btn-text th-all', onclick: () => {
    for (const v of withB) if (allOpen) openChains.delete(v.id); else openChains.add(v.id);
    saveOpen(openChains); redraw();
  } }, allOpen ? 'Collapse all branches' : 'Expand all branches');
}
