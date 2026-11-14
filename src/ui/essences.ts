// Essences on screen (growth proposal 2.5, 2.7): a pop-up the moment one is offered, with what it is, what it gives, and
// Take it / Let it go; and the Essences pop-up on the Character page, with the slots, what is held and what still waits.
// Both run the same /essence commands a player can type, so the rules stay in one place (src/engine/essence.ts).
import type { Actor, EssenceOffer, GameApi, GameState, HeldEssence } from '../types';
import { essenceSlots, removeCostText } from '../engine/essence';
import { getLibrary } from '../library';
import { ESSENCE_GRADES } from '../scales';
import { durationText, now } from '../time';
import { h } from './kit';
import { skillName } from './creation';
import { openPop } from './pop';

/** an offer's key while it waits: the same offer keeps it from turn to turn */
export const offerKey = (o: EssenceOffer): string => `${o.essence}:${o.turn}:${o.untilMin}`;

const nameOf = (e: HeldEssence) => getLibrary().essences?.[e.essence]?.name ?? e.essence;
const storyOf = (e: HeldEssence) => getLibrary().essences?.[e.essence]?.story ?? '';

/** "+1 Dodge", one chip per skill the essence raises, then its trait and quirk by name (FP8: owned once while held) */
export function essenceStats(e: HeldEssence): string[] {
  const row = getLibrary().essences?.[e.essence], perks = getLibrary().perks;
  return [...Object.entries(e.points).map(([k, v]) => `+${v} ${skillName(k)}`),
    ...(row?.trait ? [`Trait: ${perks[row.trait]?.name ?? row.trait}`] : []), ...(row?.quirk ? [`Quirk: ${perks[row.quirk]?.name ?? row.quirk}`] : [])];
}

function tile(e: HeldEssence, extra: (Node | string | null)[] = []): HTMLElement {
  return h('div', { class: 'ess-tile', title: storyOf(e) },
    h('div', { class: 'ess-top' }, h('span', { class: 'ess-gem', 'aria-hidden': 'true' }, '◆'), h('b', {}, nameOf(e)),
      h('span', { class: `ess-grade g-${e.grade}` }, ESSENCE_GRADES.name(e.grade))),
    h('div', { class: 'ess-stats' }, essenceStats(e).map((t) => h('span', { class: 'ess-stat' }, t))), ...extra);
}

/** the buttons for one offer: Take it (or, with every slot full, Take it in place of each held one), Let it go */
function offerButtons(s: GameState, p: Actor, i: number, run: (cmd: string) => void, later?: () => void): HTMLElement {
  const held = p.progression?.essences ?? [], full = held.length >= essenceSlots(p);
  return h('div', { class: 'ess-acts' },
    ...(full
      ? held.map((x, k) => h('button', { type: 'button', class: 'hs-btn-main', 'data-chip': 'essence-take', onclick: () => run(`/essence take ${i + 1} give ${k + 1}`) },
        `Take it, give up ${nameOf(x)}`))
      : [h('button', { type: 'button', class: 'hs-btn-main', 'data-chip': 'essence-take', onclick: () => run(`/essence take ${i + 1}`) }, 'Take it')]),
    h('button', { type: 'button', class: 'ess-pass', 'data-chip': 'essence-pass', title: 'Gone for good', onclick: () => run(`/essence pass ${i + 1}`) }, 'Let it go'),
    later ? h('button', { type: 'button', class: 'hs-btn-text', 'data-chip': 'essence-later', onclick: later }, 'Decide later') : null);
}

const waitText = (s: GameState, o: EssenceOffer, paired = false) => `Waits ${durationText(Math.max(0, o.untilMin - now(s)))} more${o.pair && !paired ? ' · one of two: taking one lets the other go' : ''}`;
const slotsText = (p: Actor) => `${(p.progression?.essences ?? []).length} of ${essenceSlots(p)} slots used`;

/** the offer pop-up: one per new offer, shown once; Decide later closes it, and the offer stays on the Character page */
export function essenceOfferBody(s: GameState, o: EssenceOffer, i: number, run: (cmd: string) => void, later: () => void): (Node | string)[] {
  const p = s.player, full = (p.progression?.essences ?? []).length >= essenceSlots(p);
  return [
    tile(o, [storyOf(o) ? h('p', { class: 'ess-story' }, storyOf(o)) : null]),
    h('p', { class: 'ess-meta' }, `${slotsText(p)} · ${waitText(s, o)}`),
    full ? h('p', { class: 'hs-note' }, `Every slot is full: taking it means giving one up, which works only at rest and costs ${removeCostText(p)}.`) : '',
    offerButtons(s, p, i, run, later),
  ];
}

const shown = new Set<string>();

/** opens the pop-up for the first offer not shown yet; call it whenever the screen redraws and no turn is running */
export function maybeOfferPop(api: GameApi, s: GameState | null, after: () => void): boolean {
  const offers = s?.player.progression?.essenceOffers ?? [];
  const i = offers.findIndex((o) => !shown.has(offerKey(o)));
  if (!s || i < 0) return false;
  shown.add(offerKey(offers[i]));
  openEssencePop(api, s, i, after);
  return true;
}

export function openEssencePop(api: GameApi, s: GameState, i: number, after: () => void, opener?: HTMLElement | null): void {
  const o = s.player.progression?.essenceOffers?.[i];
  if (!o) return;
  let pop: HTMLElement | null = null;
  const close = () => { pop?.querySelector<HTMLButtonElement>('.dpop-x')?.click(); };
  const run = (cmd: string) => { close(); void api.submit(cmd, { aimed: false }).then(after); };
  pop = openPop({ title: 'An essence is offered', tone: 'essence', cls: 'ess-pop', opener, body: essenceOfferBody(s, o, i, run, close) });
}

/** the Character page's Essences pop-up (CP4): slots (held ones, then the empty ones), then the offers still waiting. Two
 * offers of a pair (EssenceOffer.pair) sit side by side as one choice: taking one lets the other go. */
export function essencesBody(api: GameApi, s: GameState, after: () => void): (Node | string | null)[] {
  const p = s.player, held = p.progression?.essences ?? [], offers = p.progression?.essenceOffers ?? [], slots = essenceSlots(p);
  const run = (cmd: string) => { void api.submit(cmd, { aimed: false }).then(after); };
  const offer = (o: EssenceOffer, i: number) => tile(o, [h('p', { class: 'ess-meta' }, waitText(s, o, true)), offerButtons(s, p, i, run)]);
  // each pair once, where its first offer stands; lone offers on their own
  const seen = new Set<string>();
  const groups = offers.flatMap((o, i) => {
    if (!o.pair) return [offer(o, i)];
    if (seen.has(o.pair)) return [];
    seen.add(o.pair);
    const both = offers.map((x, k) => [x, k] as const).filter(([x]) => x.pair === o.pair);
    return [h('div', { class: 'ess-pair', 'data-pair': o.pair }, h('p', { class: 'ess-pair-h' }, 'Take one: the other goes'),
      h('div', { class: 'ess-pair-row' }, both.map(([x, k]) => offer(x, k))))];
  });
  return [
    h('p', { class: 'ess-meta' }, slotsText(p)),
    h('p', { class: 'hs-note' }, 'An essence is a package of true skill points you take into a slot. They are offered by beaten foes and by scenarios you end well. You get one more slot every few character levels.'),
    h('div', { class: 'ess-grid' },
      ...held.map((e) => tile(e)),
      ...Array.from({ length: Math.max(0, slots - held.length) }, () => h('div', { class: 'ess-tile ess-empty' }, h('span', {}, 'Empty slot')))),
    offers.length ? h('div', { class: 'ess-offers' }, h('p', { class: 'hs-label' }, offers.length === 1 ? 'On offer' : `On offer · ${offers.length}`),
      h('div', { class: 'ess-grid' }, groups)) : null,
  ];
}

/** the Essences tile's line: slots used, and how many offers wait */
export function essencesSummary(p: Actor): { used: string; waiting: number } {
  return { used: `${(p.progression?.essences ?? []).length} of ${essenceSlots(p)}`, waiting: (p.progression?.essenceOffers ?? []).length };
}
