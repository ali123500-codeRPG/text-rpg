// The power rating on the Character page: power() as one number, and on click a pop-up listing each part it is made of,
// read from the same function (powerParts in src/engine/xp.ts), so the sheet never carries a second formula.
import type { Actor, GameState } from '../types';
import { CONFIG } from '../config';
import { groupName, ratingName } from '../library/functionNames';
import { GR, RT } from '../library/functionIds';
import { compoundRating, groupRating, type Rating } from '../ruleset/ratings';
import type { ShareRule } from '../engine/nonCombat';
import { powerParts } from '../engine/xp';
import { r1 } from '../words';
import { h } from './kit';
import { gmView, skillName } from './creation';
import { openPop } from './pop';
import { ICONS } from './itemIcons';

/** one line of the breakdown: what it is, how it is worked out, what it adds (or, for a rating, its value), and the lines under it */
export type PowerLine = { label: string; how: string; adds?: number; value?: string; sub?: PowerLine[] };

const pct = (x: number) => `${r1(100 * x)}%`;
/** GR34: what each non-combat share is, in words */
const SHARE_WORDS: Record<ShareRule, string> = {
  slip: 'gets past an equal watcher', catch: 'catches an equal sneaker', talk_down: 'talks an equal foe out of a fight', heal: 'of missing health one Heal gives back',
};

/** power() as lines: level, combat (the combat level), then each non-combat group; they add up to the total */
export function powerLines(s: GameState, p: Actor): { total: number; lines: PowerLine[] } {
  const parts = powerParts(s, p);
  const lines: PowerLine[] = [
    { label: `Level ${parts.level}`, how: `${CONFIG.LEVEL_RATING_SHARE * 100}% of the XP it takes to reach it`, adds: parts.levelAdds },
    { label: `Combat level ${r1(parts.combatLevel)}`, how: `fights a standard soldier of this level evenly${gmView() ? ' (placeholder)' : ''}`, adds: parts.combatAdds },
    ...parts.nonCombat.sort((a, b) => b.adds - a.adds).map((g) => ({
      label: `${groupName(g.group)} skills`, how: `rating ${r1(g.rating)}; ${pct(g.share)} ${SHARE_WORDS[g.rule]}`, adds: g.adds,
    })),
  ];
  return { total: parts.total, lines };
}

/** GR7: the ratings (skill points): every skill group and compound row with anything in it, with its gear portion (GR8) */
export function ratingLines(s: GameState, p: Actor): PowerLine[] {
  const row = (label: string, r: Rating): PowerLine => ({ label, how: r.gear > 0 ? `${r1(r.own)} own + ${r1(r.gear)} from gear` : r.parts.map((x) => skillName(x.skill)).join(', '), value: String(r1(r.rating)) });
  const groups = (Object.values(GR) as string[]).map((g) => [groupName(g), groupRating(s, p, g)] as const);
  const rows = Object.keys(CONFIG.RATINGS).map((id) => [ratingName(id), compoundRating(s, p, id)] as const);
  return [...rows, ...groups].filter(([, r]) => r.rating > 0).map(([label, r]) => row(label, r));
}

/** the six compound ratings on the character card: an icon and the number; the name and gear portion are its tip */
export function ratingIcons(s: GameState, p: Actor): HTMLElement {
  return h('div', { class: 'cs-ratings' }, (Object.entries(RT) as [keyof typeof RT, string][]).map(([key, id]) => {
    const r = compoundRating(s, p, id), tip = `${ratingName(id)} ${r1(r.rating)}${r.gear > 0 ? ` (${r1(r.own)} own + ${r1(r.gear)} from gear)` : ''}`;
    const icon = h('span', { class: 'mk-i' });
    icon.innerHTML = ICONS[key];
    return h('span', { class: 'cs-rt', role: 'img', title: tip, 'aria-label': tip, 'data-rating': id }, icon, h('b', {}, String(Math.round(r.rating))));
  }));
}

const plus = (n: number) => `+${r1(n)}`;

function line(l: PowerLine, depth: number): HTMLElement {
  const row = h('div', { class: `pw-line${depth ? ' pw-sub' : ''}` }, h('span', { class: 'pw-what' }, h('b', {}, l.label), h('span', {}, l.how)), h('span', { class: 'pw-adds' }, l.value ?? plus(l.adds ?? 0)));
  if (!l.sub?.length) return row;
  return h('details', { class: 'pw-group' }, h('summary', {}, row), ...l.sub.map((x) => line(x, depth + 1)));
}

/** the Power figure on the character card; a click opens the parts */
export function powerFigure(s: GameState, p: Actor): HTMLElement {
  const { total } = powerLines(s, p);
  const btn: HTMLElement = h('button', { type: 'button', class: 'cs-power', 'aria-haspopup': 'dialog', title: 'What your power is made of',
    onclick: () => openPowerPop(s, p, btn) }, h('b', {}, String(r1(total))), h('span', {}, 'Power'));
  return btn;
}

export function openPowerPop(s: GameState, p: Actor, opener?: HTMLElement | null): void {
  const { total, lines } = powerLines(s, p);
  const pop = openPop({ title: 'Power', cls: 'pw-pop', opener, body: [    h('div', { class: 'pw-list' }, ...lines.map((l) => line(l, 0))),
    h('div', { class: 'pw-line pw-total' }, h('span', { class: 'pw-what' }, h('b', {}, 'Power')), h('span', { class: 'pw-adds' }, String(r1(total)))),
    // the disclosure triangle says it opens; what the ratings are is the summary's tip
    h('details', { class: 'pw-group pw-ratings' }, h('summary', { title: 'Each skill group and stat as one number, in skill points' }, h('div', { class: 'pw-line' }, h('span', { class: 'pw-what' }, h('b', {}, 'Ratings')))),
      ...ratingLines(s, p).map((l) => line(l, 1))),
  ] });
  // SD4: what Power is, as the heading's tip
  pop.querySelector('.dpop-head .hs-label')?.setAttribute('title', 'How strong you are, the same measure foes are judged by: it sets the XP a defeat pays and which foes count as stronger. Your level, how you fight (the level of a reference fighter you beat as often as it beats you), and what your sneaking, spotting, filching, healing and talking settle without a fight.');
}
