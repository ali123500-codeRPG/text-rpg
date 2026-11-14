// The power rating on the Character page: power() as one number, and on click a pop-up listing each part it is made of,
// read from the same function (powerParts in src/engine/xp.ts), so the sheet never carries a second formula.
import type { Actor, GameState } from '../types';
import { CONFIG } from '../config';
import { itemDef } from '../library';
import { GROUP_NAMES } from '../library/functionNames';
import { powerParts } from '../engine/xp';
import { cap, r1 } from '../words';
import { h } from './kit';
import { skillName } from './creation';
import { openPop } from './pop';

/** one line of the breakdown: what it is, how it is worked out, what it adds, and the lines under it */
export type PowerLine = { label: string; how: string; adds: number; sub?: PowerLine[] };

const share = (x: number) => (x === 1 ? 'in full' : `at 1/${Math.round(1 / x)}`);
const factorText = (f: number) => (f === 1 ? 'counts in full' : f === 0 ? 'counts nothing' : `counts ×${f}`);

/** power() as lines: level, then each skill group that adds something (largest first), then gear; they add up to the total */
export function powerLines(s: GameState, p: Actor): { total: number; lines: PowerLine[] } {
  const parts = powerParts(s, p);
  const groups = parts.groups.filter((g) => g.skills.length && g.group).sort((a, b) => b.adds - a.adds);
  const lines: PowerLine[] = [
    { label: `Level ${parts.level}`, how: `${CONFIG.LEVEL_RATING_SHARE * 100}% of the XP it takes to reach it`, adds: parts.levelAdds },
    ...groups.map((g) => ({
      label: `${GROUP_NAMES[g.group as keyof typeof GROUP_NAMES] ?? g.group} skills`, how: `the group ${factorText(g.factor)}`, adds: g.adds,
      sub: g.skills.map((k) => ({ label: skillName(k.skill), how: `skill ${r1(k.value)}, worth ${r1(k.worth)}, counted ${share(k.share)}`, adds: k.adds })),
    })),
    { label: 'Gear held and worn', how: `${CONFIG.GEAR_RATING_FACTOR * 100}% of its coin value`, adds: parts.gear.reduce((n, g) => n + g.adds, 0),
      sub: parts.gear.map((g) => ({ label: cap(itemDef(s, g.itemId).name), how: `${r1(g.coin)} coin`, adds: g.adds })) },
  ];
  return { total: parts.total, lines };
}

const plus = (n: number) => `+${r1(n)}`;

function line(l: PowerLine, depth: number): HTMLElement {
  const row = h('div', { class: `pw-line${depth ? ' pw-sub' : ''}` }, h('span', { class: 'pw-what' }, h('b', {}, l.label), h('span', {}, l.how)), h('span', { class: 'pw-adds' }, plus(l.adds)));
  if (!l.sub?.length) return row;
  return h('details', { class: 'pw-group' }, h('summary', {}, row), ...l.sub.map((x) => line(x, depth + 1)));
}

/** the Power figure on the character card; a click opens the parts */
export function powerFigure(s: GameState, p: Actor): HTMLElement {
  const { total } = powerLines(s, p);
  const btn: HTMLElement = h('button', { type: 'button', class: 'cs-power', 'aria-haspopup': 'dialog', title: 'What your power is made of',
    onclick: () => openPowerPop(s, p, btn) }, h('b', {}, String(r1(total))), h('span', {}, 'Power · click for its parts'));
  return btn;
}

export function openPowerPop(s: GameState, p: Actor, opener?: HTMLElement | null): void {
  const { total, lines } = powerLines(s, p);
  openPop({ title: 'Power', cls: 'pw-pop', opener, body: [
    h('p', { class: 'hs-note' }, 'How strong you are, the same measure foes are judged by: it sets the XP a defeat pays and which foes count as stronger. In each skill group your best skill counts in full, the next at 1/2, then 1/4 and so on. Open a line to see its parts.'),
    h('div', { class: 'pw-list' }, ...lines.map((l) => line(l, 0))),
    h('div', { class: 'pw-line pw-total' }, h('span', { class: 'pw-what' }, h('b', {}, 'Power')), h('span', { class: 'pw-adds' }, String(r1(total)))),
  ] });
}
