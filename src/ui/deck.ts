// The action deck (AD1–AD16): every action the code allows the player right now, one entry per action, built from
// PlayerView (and the player's own sheet) only, so nothing the character doesn't know can show. An action that needs a
// target, a thing, a body part or words lists its steps; the screen asks them in order (a pick with only one choice is
// taken for you) and `play` builds the order as the Parser would write it (AD7), so a clicked action never goes through
// the Parser. Typed text still does.
import { PK } from '../library/perkIds';
import { SK } from '../library/skillIds';
import { skillName } from '../library/skillNames';
import { CONFIG } from '../config';
import type { GameState, Intent, Personality, PlayerView } from '../types';
import { HEALTH_LEVELS } from '../scales';
import { isDownLevel, othersHealthWord } from '../ruleset';
import { canHeal } from '../ruleset/body';
import { isHeld } from '../ruleset/slots';
import { actorBody, perkName } from '../library';
import { cantSteady } from '../engine/steady';
import { minutesSinceRest } from '../engine/heal';
import { cantExtract } from '../engine/extract';
import { walksAway } from '../engine/nerve';
import type { WayOp } from '../engine/barriers';
import { distText, wallsView, zoneView } from '../views';
import { lootSources } from './loot';
import { pullOf, type IdeaGroup, type IdeaKind } from './ideaLeans';
import { healItems, partName } from './healing';
import { cap, r1, theItem } from '../words';
import { FU } from '../library/tableIds';
import { durationText, secondsSince } from '../time';
import { orderCost } from '../engine/resolve';
import { ridesBeside } from '../engine/beside';
import { fromIntent } from '../engine/merge';
import { pathM, spotPoint } from '../engine/position';
import { zoneById } from '../engine/relations';
import { furnitureRecord } from '../engine/furniture';
import { sleepersOn } from '../engine/sleep';
import { mendable } from '../engine/repair';
import { missingPts } from '../ruleset/value';
import { SV } from '../library/serviceIds';

export const DECK_GROUPS = ['getaway', 'fight', 'talk', 'move', 'stealth', 'use', 'perks'] as const;
export type DeckGroup = (typeof DECK_GROUPS)[number];
export const DECK_GROUP_NAME: Record<DeckGroup, string> = { getaway: 'Your nerve is broken', fight: 'Fight', talk: 'Talk', move: 'Move', stealth: 'Stealth', use: 'Use', perks: 'Perks' };

/** one choice in a step: an id the order uses, and how it reads */
export type Pick = { id: string; label: string; note?: string; hot?: true; part?: true /* drawn as the part's icon (id), label its tip */ };
export type Choice = { target?: string; item?: string; part?: string; words?: string; time?: string };
export type StepKey = 'target' | 'item' | 'part' | 'time';
/** a step asks one thing: a pick (from a list made from what was chosen before), or words typed in the Say box */
export type Step = { key: StepKey; title: string; picks: (c: Choice) => Pick[] } | { key: 'words'; title: string };
export type Order = { intent: Intent; line: string };
/** A3: a move with a limit that can't be used now: used this fight, or waiting (share: how much of the wait is gone, 0-1).
 * It stays in its group, shown by a mark, not words; the words are its tip */
export type DeckLimit = { used: true; tip: string } | { share: number; tip: string };
export type DeckAction = {
  kind: DeckKind; group: DeckGroup; label: string; note?: string; hot?: true; limit?: DeckLimit; against?: true; free?: true; time?: string; // against: the character is pulled away from it; free: beside your action, not it; time: how long it takes, for its hover
  steps: Step[]; play(c: Choice): Order;
};
export type DeckCtx = { pv: PlayerView; s?: GameState; aim?: boolean; broken?: boolean; cowering?: boolean; self?: Personality }; // cowering: BF79, below Broken

/** every kind of action the deck can offer; the completeness test checks these cover every Parser action, gear op and
 * way op the game knows (DECK_LEFT_OUT says why the rest are not listed) */
export const DECK_KINDS = ['attack', 'finish', 'restrain', 'steady', 'yield', 'stand_down', 'extract', 'heal', 'talk', 'persuade', 'deceive', 'intimidate',
  'barter', 'demand', 'give', 'take', 'buy', 'sell', 'show', 'lets_search', 'go', 'walk_up', 'back_away', 'follow', 'jump', 'stop',
  'keep_walking', 'way', 'sneak', 'filch', 'stash', 'look_at', 'listen', 'search', 'pat_down', 'use_item', 'repair', 'equip', 'draw',
  'stow', 'swap', 'wear_acc', 'remove_acc', 'pick_up', 'set_down', 'summon', 'loot', 'open', 'break', 'pick', 'wait', 'rest',
  'sleep', 'perk', 'warn'] as const;
export type DeckKind = (typeof DECK_KINDS)[number];
/** Parser actions with no entry, and why */
export const DECK_LEFT_OUT: Record<string, string> = {
  other: 'anything not listed is typed in the Say box', interact: 'typed in the Say box',
};

/** how each deck kind leans with the character's personality (ideaLeans) */
const LEAN: Partial<Record<DeckKind, IdeaKind>> = {
  attack: 'attack', steady: 'steady', yield: 'yield', talk: 'talk', persuade: 'talk', deceive: 'talk', go: 'go', sneak: 'sneak',
  stow: 'stow', draw: 'draw', pick_up: 'pick_up', summon: 'summon', search: 'look', pat_down: 'search', perk: 'perk',
};

/** housekeeping on your own gear: always at the bottom of its group, whatever the character leans to */
const LAST = new Set<DeckKind>(['stow', 'equip', 'set_down']);

const BLANK: Intent ={ move: null, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null };
type Act = NonNullable<Intent['action']>;

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st */
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
/** the same name twice in one list reads as "the other …" the second time; three or more times (BG-269, BF80) every one
 * is numbered, "the 1st …", "the 2nd …", "the 3rd …", so no two entries share a name */
export function apart(names: string[]): string[] {
  const key = (n: string) => n.toLowerCase(), count = new Map<string, number>(), seen = new Map<string, number>();
  for (const n of names) count.set(key(n), (count.get(key(n)) ?? 0) + 1);
  return names.map((n) => {
    const k = key(n), i = seen.get(k) ?? 0, bare = n.replace(/^(a|an|the)\s+/i, '');
    seen.set(k, i + 1);
    if ((count.get(k) ?? 0) > 2) return `the ${ordinal(i + 1)} ${bare}`;
    return i === 0 ? n : `the other ${bare}`;
  });
}

/** the deck for this moment: groups in order, each with its actions (the character's leanings order both; nothing is
 * added or taken away by them). Empty groups are left out. */
export function deck(ctx: DeckCtx): { group: DeckGroup; name: string; actions: DeckAction[] }[] {
  const { pv, s, broken = false, cowering = false } = ctx;
  const act = (type: Act['type'], over: Partial<Act> = {}): Act => ({ type, skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', ...over });
  const order = (line: string, over: Partial<Intent>): Order => ({ line, intent: { ...structuredClone(BLANK), ...over } });

  // people the player perceives: names told apart, how far, how they look
  const seen = pv.actors.filter((a) => a.health !== 'dead');
  const names = new Map(seen.map((a, i) => [a.id, apart(seen.map((x) => x.name ?? x.label))[i]]));
  const nameOf = (id: string) => names.get(id) ?? pv.lastSeen?.find((x) => x.id === id)?.name ?? id;
  const reach = pv.player.reaches?.[0]?.metres;
  const personNote = (a: PlayerView['actors'][number]) => [a.lying ? 'lying still' : '', a.health ? othersHealthWord(a.health, a.level === 'full') : '',
    a.distanceM !== undefined ? (a.distanceM < 10 ? `${r1(a.distanceM)} m` : distText(a.distanceM)) : a.zone !== pv.zone.id ? `in ${pv.zones.find((z) => z.id === a.zone)?.name ?? 'sight'}` : '',
    reach !== undefined && a.distanceM !== undefined && a.distanceM <= reach ? 'in reach' : ''].filter(Boolean).join(' · ');
  const person = (a: PlayerView['actors'][number]): Pick => ({ id: a.id, label: cap(nameOf(a.id)), note: personNote(a) || undefined });
  // BG-278: one half seen lying still is treated as down: nobody to talk to; it can still be looked at or struck (BF84)
  const up = seen.filter((a) => !(a.health && isDownLevel(a.health)) && !a.lying);
  const full = up.filter((a) => a.level === 'full');
  const strikable = seen.filter((a) => up.includes(a) || a.lying);
  // BG-280: one seen clearly as a slime or beast can't talk: no words, trade, gifts or searches with it (a threat still works)
  const talkers = up.filter((a) => !a.mute), fullTalkers = full.filter((a) => !a.mute);
  const people = (list = up) => () => list.map(person);
  const who = (title = 'Who?', list = up): Step => ({ key: 'target', title, picks: people(list) });
  const them = (c: Choice) => nameOf(c.target!);

  const inv = pv.player.inventory;
  const item = (id: string) => inv.find((i) => i.id === id);
  const invPick = (i: PlayerView['player']['inventory'][number]): Pick => ({ id: i.id, label: cap(i.name), note: i.qty && i.qty > 1 ? `×${i.qty}` : undefined });
  const zoneName = (id: string) => pv.zones.find((z) => z.id === id)?.name ?? pv.known?.find((z) => z.id === id)?.name ?? pv.zone.links.find((l) => l.to === id)?.label ?? id;
  const containers = pv.zone.groundItems.filter((g) => g.container);
  const fight = !!s && s.mode === 'tactical';
  /** A3: a wait that has run `gone` of `of` (seconds or game minutes) */
  const waiting = (gone: number, of: number, unit: 's' | 'min'): DeckLimit => ({ share: Math.max(0, Math.min(1, gone / of)), tip: `Ready in ${Math.max(1, Math.ceil(of - gone))} ${unit}` });

  const A: DeckAction[] = [];
  // SX8: free (beside your action, not instead of it) is the engine's rule (engine/beside.ts), asked of the order the entry plays
  const add = (kind: DeckKind, group: DeckGroup, label: string, steps: Step[], play: (c: Choice) => Order, extra: { note?: string; hot?: true; limit?: DeckLimit } = {}) =>
    A.push({ kind, group, label, steps, play, ...extra, ...(ridesBeside(firstOrder(steps, play)?.intent ?? {}) ? { free: true as const } : {}) });

  // ---- Fight (MB12/BF37: a broken nerve allows no attack; words, a yield, sneaking and a walk away (BF79) still work) ----
  if (!broken) {
    if (strikable.length) {
      const weapons = inv.filter((i) => isHeld(i) && i.kind === 'weapon' && !i.cantSwing); // BG-283: never a weapon no hand can swing
      const withSteps: Step[] = weapons.length + (pv.player.bodyAttacks?.length ?? 0) > 1 ? [{ key: 'item', title: 'With what?', picks: () => [
        ...weapons.map((w) => ({ id: w.id, label: cap(w.name) })), ...(pv.player.bodyAttacks ?? []).filter((b) => !b.handsFull).map((b) => ({ id: `mode:${b.mode}`, label: cap(b.name) }))] }] : [];
      const partSteps: Step[] = ctx.aim && s ? [{ key: 'part', title: 'Aim at which part?', picks: (c) => {
        const t = s.actors.find((x) => x.id === c.target);
        return t ? actorBody(s, t).parts.map((p) => ({ id: p.id, label: partName(p.id), part: true })) : [];
      } }] : [];
      add('attack', 'fight', 'Attack', [who('Attack whom?', strikable), ...partSteps, ...withSteps], (c) => {
        const mode = c.item?.startsWith('mode:') ? c.item.slice(5) : null;
        const it = c.item && !mode ? c.item : null;
        const aimed = !!c.part;
        return order(`Attack ${them(c)}${c.part ? ` at the ${partName(c.part).toLowerCase()}` : ''}${it ? ` with ${theItem(item(it)?.name ?? '')}` : mode ? ` with ${pv.player.bodyAttacks?.find((b) => b.mode === mode)?.name ?? mode}` : ''}`,
          { action: act('attack', { target: c.target!, targetPart: c.part ?? null, item: it, mode, ...(aimed ? { aimed: true } : {}) }) });
      }, { hot: up.some((a) => a.health && HEALTH_LEVELS.pos(a.health) > 0) ? true : undefined });
      // IQ7 a: a fight far below the player can be finished on code in one turn; ignoring it plays turn by turn
      if (pv.player.finishable) add('finish', 'fight', 'Finish the fight', [], () => order('I finish the fight', { finish: true }), { note: 'plays it out to the end' });
      if (full.length) add('restrain', 'fight', 'Restrain', [who('Hold back whom?', full)], (c) => order(`Restrain ${them(c)}`, { action: act('restrain', { target: c.target! }) }), { note: 'hold them back unhurt' });
    }
    // SY1: in a fight, above Broken and not within its cooldown: one morale roll as the action
    const why = s ? cantSteady(s, s.player) : 'not_in_fight';
    if (why === null || why === 'too_soon') add('steady', 'fight', 'Steady yourself', [], () => order('Steady yourself', { action: act('steady') }), { note: 'a morale roll',
      ...(why === 'too_soon' ? { limit: waiting(secondsSince(s!, s!.player.core.condition.steadiedTurn!), CONFIG.STEADY_COOLDOWN_S, 's') } : {}) });
    const extractable = s ? seen.filter((a) => a.level === 'full' && cantExtract(s, s.player, s.actors.find((x) => x.id === a.id)) === null) : [];
    if (extractable.length) add('extract', 'fight', perkName(PK.extract_essence), [who('From whom?', extractable)], (c) => order(`Pull the essence from ${them(c)}`, { action: act('extract', { target: c.target! }) }), { note: 'take their essence' });
  }
  // MB40/SP5: give up the fight or spar you are in; TF11: take a foe's offer to stop
  if (fight || pv.player.spar || broken) add('yield', broken ? 'getaway' : 'fight', 'Yield', [], () => order('I yield', { yields: true }), { note: 'ends the fight if they take it' });
  for (const o of pv.player.standDownOffers ?? []) add('stand_down', 'talk', `Take ${o.name}'s offer to stop`, [], () => order(`I take ${o.name}'s offer to stop`, { standDown: o.id }), { note: 'ends your fight with them' });

  // ---- Talk: a plain talk opens a conversation at once; the rest need your words (typed in the Say box) ----
  const listeners = [...talkers, ...(pv.lastSeen ?? []).filter((x) => !x.gone && !x.mute).map((x) => ({ id: x.id, label: x.name, zone: x.zone, level: 'partial' } as unknown as PlayerView['actors'][number]))];
  if (listeners.length) {
    add('talk', 'talk', 'Talk to', [{ key: 'target', title: 'Talk to whom?', picks: () => listeners.map((a) => talkers.includes(a) ? person(a) : { id: a.id, label: cap(nameOf(a.id)), note: `last seen in ${pv.lastSeen?.find((x) => x.id === a.id)?.zoneName ?? zoneName(a.zone)}` }) }],
      (c) => order(`Talk to ${them(c)}`, { action: act('talk', { target: c.target! }), addressees: [c.target!] }));
    const speech = (kind: DeckKind, type: Act['type'], label: string, note: string, list = talkers, demand = false) => add(kind, 'talk', label, [who(`${label} whom?`, list), { key: 'words', title: 'What do you say?' }],
      (c) => order(c.words!, { action: act(type, { target: c.target!, ...(demand ? { demand: 'yield' as const } : {}) }), spoken: c.words!, addressees: [c.target!] }), { note });
    speech('persuade', 'persuade', 'Persuade', up.some((a) => a.talkDown) ? 'talk a foe down · easier once they are hurt or scared' : 'your words, Persuasion');
    speech('deceive', 'deceive', 'Lie to', up.some((a) => a.talkDown) ? `a lie to end it · ${skillName(SK.falsehood)} against their Insight` : `${skillName(SK.falsehood)} against their Insight`);
    speech('intimidate', 'intimidate', 'Threaten', 'Intimidation', up); // BF86: a threat needs no words, so beasts too
    speech('barter', 'barter', 'Haggle with', up.some((a) => a.talkDown) ? 'pay a foe to stop: name the coin' : 'Barter');
    const demandable = talkers.filter((a) => a.demandYield);
    if (demandable.length) speech('demand', 'persuade', 'Demand surrender', 'Persuasion; a bigger win', demandable, true);
  }
  if (fullTalkers.length && inv.length) add('give', 'talk', 'Give', [who('Give to whom?', fullTalkers), { key: 'item', title: 'Give what?', picks: () => inv.map(invPick) }],
    (c) => order(`Give ${theItem(item(c.item!)?.name ?? '')} to ${them(c)}`, { action: act('give', { target: c.target!, item: c.item! }) }));
  // BF34: something held out to you; FL: what a yielded or downed one carries is taken at once (others refuse)
  const takeFrom = full.filter((a) => a.holdsOut || a.gear.length);
  if (takeFrom.length) add('take', 'talk', 'Take from', [who('Take from whom?', takeFrom), { key: 'item', title: 'Take what?', picks: (c) => {
    const a = full.find((x) => x.id === c.target);
    return a ? [...(a.holdsOut ? [{ id: a.holdsOut.item, label: cap(a.holdsOut.name), note: 'held out to you', hot: true as const }] : []), ...a.gear.filter((g) => g.id !== a.holdsOut?.item).map((g) => ({ id: g.id, label: cap(g.name), note: g.where }))] : [];
  } }], (c) => order(`Take ${theItem(full.find((a) => a.id === c.target)?.gear.find((g) => g.id === c.item)?.name ?? full.find((a) => a.id === c.target)?.holdsOut?.name ?? 'it')} from ${them(c)}`, { action: act('take', { target: c.target!, item: c.item! }) }),
  { note: up.some((a) => a.holdsOut) ? 'something is held out to you' : 'works if they yielded or are down', ...(up.some((a) => a.holdsOut) ? { hot: true as const } : {}) });
  const sellers = [...up.filter((a) => a.wares?.length), ...(pv.lastSeen ?? []).filter((x) => x.wares?.length && !up.some((a) => a.id === x.id)).map((x) => ({ id: x.id, label: x.name, wares: x.wares, zone: x.zone } as unknown as PlayerView['actors'][number]))];
  if (sellers.length) add('buy', 'talk', 'Buy', [{ key: 'target', title: 'Buy from whom?', picks: () => sellers.map((a) => ({ id: a.id, label: cap(nameOf(a.id)) })) },
    { key: 'item', title: 'Buy what?', picks: (c) => (sellers.find((a) => a.id === c.target)?.wares ?? []).map((w) => ({ id: w.id, label: cap(w.name), note: w.price + (w.stock !== undefined ? ` · ${w.stock} left` : '') })) }],
    (c) => order(`Buy ${theItem(sellers.find((a) => a.id === c.target)?.wares?.find((w) => w.id === c.item)?.name ?? '')} from ${them(c)}`, { action: act('buy', { target: c.target!, item: c.item! }) }));
  const buyers = up.filter((a) => a.offers?.length);
  if (buyers.length) add('sell', 'talk', 'Sell', [who('Sell to whom?', buyers), { key: 'item', title: 'Sell what?', picks: (c) => (buyers.find((a) => a.id === c.target)?.offers ?? []).map((o) => ({ id: o.id, label: cap(o.name), note: o.price })) }],
    (c) => order(`Sell ${theItem(item(c.item!)?.name ?? buyers.find((a) => a.id === c.target)?.offers?.find((o) => o.id === c.item)?.name ?? '')} to ${them(c)}`, { action: act('sell', { target: c.target!, item: c.item! }) }));
  if (full.length) {
    if (fullTalkers.length) add('lets_search', 'talk', 'Let them search you', [who('Who may search you?', fullTalkers)], (c) => order(`I let ${them(c)} search me`, { letsSearch: c.target! }));
    add('show', 'talk', 'Turn out your pockets', [], () => order('I turn out my pockets', { action: act('show') }), { note: 'before everyone here' });
  }

  // ---- Move (walks; a move with no action runs on: a dash, AE2). BF79: broken, only the ways away from your foes show
  // (under Your nerve is broken), with Back away; at Cowering no walk at all ----
  if (!cowering) {
    const g = broken ? 'getaway' : 'move';
    const away = (zone: string) => !broken || !s || walksAway(s, s.player, { zone });
    const ways = pv.zone.links.filter((l) => !l.drop && away(l.to));
    const wayNote = (l: PlayerView['zone']['links'][number]) => [l.frontier ? 'new ground' : '', l.way && 'locked' in l.way && l.way.locked ? (l.way.key ? 'locked · you hold its key' : 'locked') : '',
      l.way && 'barred' in l.way && l.way.barred ? 'barred' : '', l.way?.blocked ? 'blocked' : ''].filter(Boolean).join(' · ') || undefined;
    const places = [...ways.map((l) => ({ id: l.to, label: cap(l.label), note: wayNote(l) })),
      ...(pv.known ?? []).filter((z) => z.id !== pv.zone.id && !ways.some((l) => l.to === z.id) && away(z.id)).map((z) => ({ id: z.id, label: cap(z.name), note: pv.cameFrom?.[0]?.zone === z.id ? 'where you came from' : 'known' }))];
    if (places.length) add('go', g, 'Go to', [{ key: 'target', title: 'Go where?', picks: () => places }], (c) => order(`Go to ${places.find((p) => p.id === c.target)?.label ?? zoneName(c.target!)}`, { move: { toZone: c.target! } }));
    const drops = pv.zone.links.filter((l) => l.drop && away(l.to));
    if (drops.length) add('jump', g, 'Jump down', [{ key: 'target', title: 'Jump where?', picks: () => drops.map((l) => ({ id: l.to, label: cap(l.label) })) }], (c) => order(`Jump down to ${zoneName(c.target!)}`, { move: { toZone: c.target!, jump: true } }));
    const near = seen.filter((a) => a.level === 'full');
    if (near.length) {
      if (!broken) add('walk_up', 'move', 'Walk up to', [who('Walk up to whom?', near)], (c) => order(`Walk up to ${them(c)}`, { move: { toZone: near.find((a) => a.id === c.target)!.zone, spot: { near: c.target! } } }));
      add('back_away', g, 'Back away from', [who('Away from whom?', near)], (c) => order(`Back away from ${them(c)}`, { move: { toZone: pv.zone.id, spot: { awayFrom: c.target! } } }));
      if (!broken) add('follow', 'move', 'Follow', [who('Follow whom?', near)], (c) => order(`Follow ${them(c)}`, { move: { toZone: near.find((a) => a.id === c.target)!.zone, spot: { near: c.target!, follow: true } } }));
    }
    if (pv.player.walking && !broken) {
      const then = pv.player.walking.then ? `, then ${pv.player.walking.then}` : ''; // MQ15 a: the action the walk carries
      add('keep_walking', 'move', pv.player.following ? `Keep following ${pv.player.following.name}` : `Keep walking to ${pv.player.walking.to}${then}`, [], () => order(pv.player.following ? `Keep following ${pv.player.following.name}` : `Keep walking to ${pv.player.walking!.to}${then}`, {}), { note: 'carries the walk on' });
      add('stop', 'move', 'Stop here', [], () => order('Stop here', { move: { toZone: pv.zone.id } }));
    }
    // BA3/BA4/SD: the ways out that have a door, gate or bar: what you can do to each from here (it takes the move)
    const wayOps = (l: PlayerView['zone']['links'][number]): WayOp[] => {
      const w = l.way;
      if (!w || !('kind' in w) || w.blocked) return [];
      const v = w as { locked?: true; barred?: true; key?: true };
      return [...(v.barred ? ['unbar'] : []), ...(!v.locked && !v.barred ? ['open', 'shut', 'bar'] : []), ...(v.key ? [v.locked ? 'unlock' : 'lock'] : [])] as WayOp[];
    };
    const doors = pv.zone.links.filter((l) => wayOps(l).length);
    if (doors.length) add('way', g, WAY_LABEL, [{ key: 'target', title: 'Which way?', picks: () => doors.map((l) => ({ id: l.to, label: cap(l.label), note: wayNote(l) })) },
      { key: 'item', title: 'Do what?', picks: (c) => { const d = doors.find((l) => l.to === c.target); return d ? wayOps(d).map((op) => ({ id: op, label: cap(op) })) : []; } }],
      (c) => order(`${cap(c.item!)} ${doors.find((l) => l.to === c.target)?.label ?? 'the way'}`, { way: { toZone: c.target!, op: c.item as WayOp } }), { note: 'takes your move' });
  }

  // ---- Stealth (ST3: sneaking takes no action; VS8: everything takes SNEAK_TIME_MULT times as long; VS1: slipping away from those who see you is the sneak's own roll) ----
  const open = pv.zone.links.filter((l) => !l.frontier && !l.drop);
  add('sneak', broken ? 'getaway' : 'stealth', pv.player.posture === 'stealthy' ? 'Keep sneaking' : 'Sneak', broken ? [] : [{ key: 'target', title: 'Sneak where?', picks: () => [{ id: '', label: 'Stay here', note: 'move unseen from now on' }, ...open.map((l) => ({ id: l.to, label: cap(l.label) }))] }],
    (c) => order(c.target ? `Sneak to ${zoneName(c.target)}` : 'Sneak', { action: act('sneak', { target: c.target || null }) }), { note: `slows all actions ×${CONFIG.SNEAK_TIME_MULT}` });
  const marks = [...full.filter((a) => a.gear.length || a.wares?.length), ...containers.map((g) => ({ id: g.id, label: g.name, gear: [] as never[], container: g.container } as unknown as PlayerView['actors'][number]))];
  if (marks.length) add('filch', 'stealth', 'Filch', [{ key: 'target', title: 'Steal from whom or what?', picks: () => marks.map((a) => names.has(a.id) ? person(a) : { id: a.id, label: cap(a.label) }) },
    { key: 'item', title: 'Steal what?', picks: (c) => {
      const a = marks.find((x) => x.id === c.target);
      const seenThings = [...(a?.gear ?? []).map((g) => ({ id: g.id, label: cap(g.name), note: g.where })), ...(a?.wares ?? []).map((w) => ({ id: w.id, label: cap(w.name), note: 'a ware' })),
        ...(containers.find((g) => g.id === c.target)?.container?.contents ?? []).map((x) => ({ id: x.id, label: cap(x.name) }))];
      return [{ id: '', label: 'Whatever comes to hand' }, ...seenThings];
    } }], (c) => order(`Filch ${c.item ? 'from' : 'something from'} ${names.has(c.target!) ? them(c) : theItem(containers.find((g) => g.id === c.target)?.name ?? '')}`, { action: act('filch', { target: c.target!, item: c.item || null }) }), { note: 'unseen, or they turn on you' });
  if (inv.length) add('stash', 'stealth', 'Stash', [{ key: 'item', title: 'Hide what?', picks: () => inv.map(invPick) }], (c) => order(`Stash ${theItem(item(c.item!)?.name ?? '')} here`, { action: act('stash', { item: c.item! }) }));

  // ---- Use: looking, searching, your gear, things here, time ----
  const has = (sk: string) => pv.player.skills.some((x) => x.id === sk);
  const sights = [...strikable.map(person), ...pv.zones.filter((z) => z.id !== pv.zone.id).map((z) => ({ id: z.id, label: cap(z.name) }))];
  if (sights.length) add('look_at', 'use', 'Look at', [{ key: 'target', title: 'Look at whom or where?', picks: () => sights }], (c) => order(`Look at ${names.has(c.target!) ? them(c) : zoneName(c.target!)}`, { action: act('observe', { skill: has(SK.eyesight) ? SK.eyesight : '', target: c.target! }) }));
  add('listen', 'use', 'Listen', [], () => order('Listen', { action: act('observe', { skill: has(SK.earshot) ? SK.earshot : '' }) }));
  // LX1: Search is everything around you (the look over all in sight, hidden people and things); LX4: Pat down is a person
  add('search', 'use', 'Search', [], () => order('Search', { action: act('search', { target: null }) }), { note: 'all in sight, and what is hidden near' });
  if (full.length) add('pat_down', 'use', 'Pat down', [{ key: 'target', title: 'Pat down whom?', picks: () => full.map(person) }],
    (c) => order(`Pat down ${them(c)}`, { action: act('search', { target: c.target! }) }));
  if (s && lootSources(pv).length) add('loot', 'use', 'Take things here', [], () => order('', {}), { note: 'pick what to pocket', hot: true });
  const healIds = new Set(s ? healItems(s, s.player).map((x) => x.itemId) : []);
  const heal = inv.filter((i) => healIds.has(i.itemId));
  // NR34: Heal opens at true Healing 50; on yourself or anyone you see in full
  if (s && canHeal(s.player)) add('heal', 'use', 'Heal', [{ key: 'target', title: 'Heal whom?', picks: () => [{ id: '', label: 'Yourself' }, ...full.map(person)] }],
    (c) => order(`Heal ${c.target ? them(c) : 'myself'}`, { action: act('heal', { target: c.target || null }) }), { note: 'a Healing roll' });
  if (heal.length) add('use_item', 'use', 'Treat wounds', [{ key: 'item', title: 'With what?', picks: () => heal.map(invPick) }, { key: 'target', title: 'Treat whom?', picks: () => [{ id: '', label: 'Yourself' }, ...full.map(person)] }],
    (c) => order(`Use ${theItem(item(c.item!)?.name ?? '')} on ${c.target ? them(c) : 'myself'}`, { action: act('use_item', { item: c.item!, target: c.target || null }) }));
  // D-89: mend a worn shield or armor piece yourself (Handiwork; a forge you may use within reach doubles it) or have a smith do it
  const worn = s ? inv.filter((i) => { const m = mendable(s, s.player.core.inventory.find((x) => x.id === i.id)); return !!m && missingPts(m.def, m.inst) > 0; }) : [];
  const smiths = full.filter((a) => a.wares?.some((w) => w.id === `service:${SV.repair}`));
  if (worn.length) add('repair', 'use', 'Repair', [{ key: 'item', title: 'Repair what?', picks: () => worn.map(invPick) }, { key: 'target', title: 'Who does it?', picks: () => [{ id: '', label: 'Yourself', note: 'a Handiwork roll' }, ...smiths.map(person)] }],
    (c) => order(c.target ? `Have ${them(c)} repair ${theItem(item(c.item!)?.name ?? '')}` : `Repair ${theItem(item(c.item!)?.name ?? '')}`, { action: act('repair', { item: c.item!, target: c.target || null }) }));
  const stowed = inv.filter((i) => !i.equippedIn.length && i.kind === 'weapon'), held = inv.filter((i) => isHeld(i));
  if (stowed.length) add('draw', 'use', 'Draw', [{ key: 'item', title: 'Draw what?', picks: () => stowed.map(invPick) }], (c) => order(`Draw ${theItem(item(c.item!)?.name ?? '')}`, { gear: [{ op: 'draw', item: c.item! }] }));
  if (held.length) add('stow', 'use', 'Put away', [{ key: 'item', title: 'Put away what?', picks: () => held.map(invPick) }, ...(containers.some((g) => g.container?.open) || inv.some((i) => i.container) ? [{ key: 'target' as const, title: 'Into?', picks: () => [{ id: '', label: 'On you' }, ...inv.filter((i) => i.container).map(invPick), ...containers.filter((g) => g.container?.open).map((g) => ({ id: g.id, label: cap(g.name) }))] }] : [])],
    (c) => order(`Put away ${theItem(item(c.item!)?.name ?? '')}`, { gear: [{ op: 'stow', item: c.item!, ...(c.target ? { into: c.target } : {}) }] }));
  if (held.length && stowed.length) add('swap', 'use', 'Swap weapons', [{ key: 'item', title: 'Take up what?', picks: () => stowed.map(invPick) }], (c) => order(`Swap to ${theItem(item(c.item!)?.name ?? '')}`, { gear: [{ op: 'swap', item: c.item! }] }));
  const acc = inv.filter((i) => i.kind === 'accessory');
  if (acc.some((i) => !i.equippedIn.length)) add('wear_acc', 'use', 'Put on', [{ key: 'item', title: 'Put on what?', picks: () => acc.filter((i) => !i.equippedIn.length).map(invPick) }], (c) => order(`Put on ${theItem(item(c.item!)?.name ?? '')}`, { gear: [{ op: 'wear_acc', item: c.item! }] }));
  if (acc.some((i) => i.equippedIn.length)) add('remove_acc', 'use', 'Take off', [{ key: 'item', title: 'Take off what?', picks: () => acc.filter((i) => i.equippedIn.length).map(invPick) }], (c) => order(`Take off ${theItem(item(c.item!)?.name ?? '')}`, { gear: [{ op: 'remove_acc', item: c.item! }] }));
  const armor = inv.filter((i) => i.kind === 'armor');
  if (armor.length) add('equip', 'use', 'Armor on or off', [{ key: 'item', title: 'Which armor?', picks: () => armor.map((i) => ({ ...invPick(i), note: i.equippedIn.length ? 'worn: take it off' : 'put it on' })) }],
    (c) => order(`${item(c.item!)?.equippedIn.length ? 'Take off' : 'Put on'} ${theItem(item(c.item!)?.name ?? '')}`, { gear: [{ op: 'armor', item: c.item! }] }));
  const ground = pv.zone.groundItems.filter((g) => !g.container?.fixed);
  if (ground.length) add('pick_up', 'use', 'Pick up', [{ key: 'item', title: 'Pick up what?', picks: () => ground.map((g) => ({ id: g.id, label: cap(g.name) })) }], (c) => order(`Pick up ${theItem(ground.find((g) => g.id === c.item)?.name ?? '')}`, { gear: [{ op: 'pick_up', item: c.item! }] }));
  if (inv.length) add('set_down', 'use', 'Set down', [{ key: 'item', title: 'Set down what?', picks: () => inv.map(invPick) }], (c) => order(`Set down ${theItem(item(c.item!)?.name ?? '')}`, { gear: [{ op: 'set_down', item: c.item! }] }));
  if (pv.player.summonable?.length) add('summon', 'use', 'Summon', [{ key: 'item', title: 'Summon what?', picks: () => pv.player.summonable!.map((x) => ({ id: x.id, label: cap(x.name) })) }], (c) => order(`Summon ${pv.player.summonable!.find((x) => x.id === c.item)?.name ?? ''}`, { gear: [{ op: 'summon', item: c.item! }] }));
  const shut = [...containers.filter((g) => g.container?.shut), ...inv.filter((i) => i.container && !i.container.open)];
  if (shut.length) add('open', 'use', 'Open', [{ key: 'target', title: 'Open what?', picks: () => shut.map((g) => ({ id: g.id, label: cap(g.name), note: g.container?.lock === 'locked' ? (g.container.key ? 'locked · you hold its key' : 'locked') : undefined })) }],
    (c) => order(`Open ${theItem(shut.find((g) => g.id === c.target)?.name ?? '')}`, { action: act('open', { target: c.target! }) }));
  const locked = containers.filter((g) => g.container?.lock === 'locked' && !g.container.key);
  const lockedWays = pv.zone.links.filter((l) => l.way && 'locked' in l.way && l.way.locked && !l.way.key);
  if (locked.length || lockedWays.length) add('pick', 'use', 'Pick a lock', [{ key: 'target', title: 'Which lock?', picks: () => [...locked.map((g) => ({ id: g.id, label: cap(g.name) })), ...lockedWays.map((l) => ({ id: l.to, label: cap(l.label) }))] }],
    (c) => order(`Pick the lock of ${locked.find((g) => g.id === c.target)?.name ?? pv.zone.links.find((l) => l.to === c.target)?.label ?? ''}`, { action: act('pick', { target: c.target! }) }));
  if (locked.length) add('break', 'use', 'Force open', [{ key: 'target', title: 'Force what?', picks: () => locked.map((g) => ({ id: g.id, label: cap(g.name) })) }],
    (c) => order(`Force ${theItem(locked.find((g) => g.id === c.target)?.name ?? '')} open`, { action: act('break', { target: c.target! }) }), { note: 'loud' });
  // BW12 a: a door, gate, grate, shutters or rubble on a way (not already broken through), or a wall of the player's title
  const breakWays = pv.zone.links.filter((l) => l.way && !('broken' in l.way && l.way.broken === 'destroyed'));
  const breakWalls = pv.zone.walls ?? [];
  if (breakWays.length || breakWalls.length) add('break', 'use', 'Break through', [{ key: 'target', title: 'Break through what?', picks: () => [
    ...breakWays.map((l) => ({ id: l.to, label: cap(`${l.way!.kind}: ${l.label}`) })),
    ...breakWalls.map((w) => ({ id: w.id, label: cap(`${w.of} wall, to ${w.behind}`), ...(w.broken ? { note: `${Math.round(w.broken * 100)}% through` } : {}) }))] }],
  (c) => order(`Break through ${pv.zone.links.find((l) => l.to === c.target)?.label ?? `the ${breakWalls.find((w) => w.id === c.target)?.of ?? ''} wall`}`, { action: act('break', { target: c.target! }) }), { note: 'loud · long' });
  if (!fight) {
    add('wait', 'use', 'Wait', [{ key: 'time', title: 'Wait until?', picks: () => [{ id: '', label: 'A moment', note: 'see what happens' }, { id: 'someone', label: 'Someone comes' }, ...['dawn', 'morning', 'afternoon', 'dusk', 'evening', 'night'].map((t) => ({ id: t, label: cap(t) }))] }],
      (c) => c.time ? order(c.time === 'someone' ? 'Wait for someone to come' : `Wait until ${c.time}`, { action: act('wait', { target: c.time }) }) : order('Wait and see', {}));
    const since = s ? minutesSinceRest(s, s.player) : Infinity;
    add('rest', 'use', 'Rest', [], () => order('Rest a while', { action: act('rest') }), { note: 'a short rest', ...(since < CONFIG.REST_COOLDOWN_MIN ? { limit: waiting(since, CONFIG.REST_COOLDOWN_MIN, 'min') } : {}) });
    add('sleep', 'use', 'Sleep', [], () => order('Sleep', { action: act('sleep') }));
  }

  // ---- WN9 a: warn your side about a trick you saw through, or someone hidden you see (a free shout beside the turn) ----
  const warnable = pv.player.warnable ?? [];
  if (warnable.length) add('warn', 'talk', 'Warn your side', [who('Warn them about whom?', seen.filter((a) => warnable.some((w) => w.id === a.id)))],
    (c) => order(`Warn your side about ${them(c)}`, { warn: c.target! }), { note: 'a shout' });

  // ---- Perks (AE5/AE8: perk moves; a free one goes beside the turn, an action one is the turn) ----
  for (const m of pv.player.perkMoves ?? []) {
    const label = PERK_LABEL[m.id] ?? m.name;
    const extra = { note: m.name };
    if (m.used) add('perk', 'perks', label, [], () => order(label, { perkMove: { perk: m.id, target: null } }), { ...extra, limit: { used: true, tip: 'Used this fight' } });
    else if (!m.inRange) add('perk', 'perks', label, [], () => order(label, { perkMove: { perk: m.id, target: null } }), extra);
    else if (m.inRange.length) add('perk', 'perks', label, [who(`${label}: whom?`, up.filter((a) => m.inRange!.includes(a.id)))], (c) => order(`${label}: ${them(c)}`, { perkMove: { perk: m.id, target: c.target! } }), extra);
  }

  // the character's leanings order groups and actions (ties keep their place); an action pulled away from gets the against-your-nature mark
  const p = ctx.self;
  const pull = (k: IdeaKind | IdeaGroup | undefined) => (p && k ? pullOf(k, p) : 0);
  const by = <T>(xs: T[], v: (x: T) => number) => xs.map((x, i) => ({ x, i, v: v(x) })).sort((a, b) => b.v - a.v || a.i - b.i).map((e) => e.x);
  const lean = (xs: DeckAction[]) => by(xs, (a) => pull(LEAN[a.kind]));
  const groups = DECK_GROUPS.map((g) => ({ group: g, name: DECK_GROUP_NAME[g], actions: [...lean(A.filter((a) => a.group === g && !LAST.has(a.kind))), ...lean(A.filter((a) => a.group === g && LAST.has(a.kind)))] }))
    .filter((g) => g.actions.length && g.actions.some((a) => !a.steps.length || a.steps[0].key === 'words' || (a.steps[0] as { picks: (c: Choice) => Pick[] }).picks({}).length));
  for (const g of groups) for (const a of g.actions) if (p && LEAN[a.kind] && pull(LEAN[a.kind]) <= -CONFIG.IDEA_AGAINST_NATURE) a.against = true;
  if (s) for (const a of A) a.time = timeTip(s, a);
  return by(groups, (g) => (g.group === 'getaway' ? Infinity : pull(g.group === 'use' || g.group === 'perks' ? undefined : g.group)));
}

/** the order an entry plays with the first pick of each step (null when it can't be built so) */
function firstOrder(steps: Step[], play: (c: Choice) => Order): Order | null {
  try {
    const c: Choice = {};
    for (const st of steps) if (st.key !== 'words') c[st.key] = st.picks(c)[0]?.id;
    return play(c);
  } catch { return null; }
}

/** the hover line saying how long an action takes: its Action times row's seconds (resolve orderCost) for the first pick of
 * each step; a move goes by the distance, and an action with no row of its own takes the turn */
function timeTip(s: GameState, a: DeckAction): string {
  if (a.free) return 'Free: beside your action, not instead of it';
  if (a.kind === 'wait') return 'Lasts until the time you pick';
  if (a.kind === 'sleep') return 'Lasts until you are rested';
  const intent = firstOrder(a.steps, a.play)?.intent;
  if (!intent) return '';
  if (!intent.action) return intent.move ? 'Takes as long as the way there' : '';
  const cost = orderCost(s, s.player, fromIntent(s, intent, false));
  if (!cost) return 'Takes the turn';
  const t = cost.seconds < 60 ? `${r1(cost.seconds)} s` : durationText(cost.seconds / 60);
  return intent.action.type === 'attack' ? `Each blow takes ${t}` : cost.seconds ? `Takes ${t}` : 'Takes no time, but it is your action';
}

/** perk moves that read better as a deed than by the perk's name */
const PERK_LABEL: Record<string, string> = { [PK.dirt_in_the_eyes]: 'Throw dirt in the eyes', [PK.bluff]: 'Bluff "Behind you!"', [PK.battle_cry]: 'Let out a battle cry', [PK.rally]: 'Rally your side', [PK.play_dead]: 'Play dead' };

/** the deck's name for its door, gate or bar entry (a greyed copy of it names a door it can't work, MAP-85) */
export const WAY_LABEL = 'Door, gate or bar';
/** the deck kinds that work a door, gate or bar from this side: a door mark on the map lists these (MAP-85) */
const DOOR_KINDS = new Set<DeckKind>(['way', 'pick', 'break']);
/** MQ10 a: the deck's actions on a piece of furniture, by its kind (FU): a bed is slept on */
const FURNITURE_ACTS: Partial<Record<string, DeckKind[]>> = { [FU.bed]: ['sleep'] };
/** MAP-85: a thing drawn on the map, by the deck target it stands for: a person (actor id), a wall (its id, the title of
 *  the side clicked and the middle of the stretch, metres), a thing on the ground (MAP-86: its instance id, whom or what
 *  an action picks first: Pick up's item, Open's target), a piece of furniture (its id and kind: MQ10 a), a doorway (the
 *  two titles it joins; worked from the side the character walks to first, its target the title on the far side) */
export type MapThing = { kind: 'person' | 'item'; id: string } | { kind: 'wall'; id: string; zone: string; at: { x: number; y: number } } | { kind: 'door'; ends: string[] } | { kind: 'furniture'; id: string; is: string };
/** RM27 b: one disc on the map for people too close to draw apart: a click picks one of them, then lists what to do */
export type MapPeople = { kind: 'people'; who: { id: string; name: string }[] };
/** one entry of a thing's list: a deck action with the thing already chosen, or one greyed with the engine's reason
 *  (needs: what it lacks, marked with a padlock) */
export type ThingEntry = { label: string; a: DeckAction; c: Choice } | { label: string; why: string; needs?: string };
/** MAP-85, MQ8: where the character works a thing from: the title (for a door, the side whose doorway is nearer on foot)
 *  and the move that walks there, or nothing when it is not known or cannot be reached on foot */
function thingAt(ctx: DeckCtx, t: Exclude<MapThing, { kind: 'person' }>): { zone: string; id: string; move?: NonNullable<Intent['move']> } | undefined {
  const { pv, s } = ctx;
  const foot = (zone: string, pos?: { x: number; y: number }) => zone === pv.zone.id || (!!s && Number.isFinite(pathM(s, s.player, { zone, ...(pos ? { pos } : {}) }, s.player)));
  if (t.kind === 'door') {
    const sides = t.ends.includes(pv.zone.id) ? [pv.zone.id] : t.ends.filter((z) => s && zoneById(s, z));
    const at = (z: string) => s ? spotPoint(s, z, { near: t.ends.find((e) => e !== z)! }, s.player, s.player)?.pos : undefined; // where the walk to it ends
    const by = s ? sides.map((z) => ({ z, m: z === pv.zone.id ? 0 : pathM(s, s.player, { zone: z, ...(at(z) ? { pos: at(z)! } : {}) }, s.player) })).filter((x) => Number.isFinite(x.m)).sort((x, y) => x.m - y.m)[0]?.z : sides[0];
    const id = by && t.ends.find((e) => e !== by);
    return by && id ? { zone: by, id, ...(by !== pv.zone.id ? { move: { toZone: by, spot: { near: id } } } : {}) } : undefined;
  }
  if (t.kind === 'wall') return foot(t.zone, t.at) ? { zone: t.zone, id: t.id, ...(t.zone !== pv.zone.id ? { move: { toZone: t.zone, spot: { at: t.at } } } : {}) } : undefined;
  if (t.kind === 'furniture') {
    const f = s ? furnitureRecord(s, t.id) : undefined, zone = f?.zone ?? (pv.zone.furniture?.some((x) => x.id === t.id) ? pv.zone.id : undefined);
    return zone && foot(zone) ? { zone, id: t.id, move: { toZone: zone, spot: { near: t.id } } } : undefined;
  }
  const zone = [pv.zone, ...pv.zones].find((z) => z.groundItems.some((g) => g.id === t.id))?.id; // MAP-86: only things seen now
  return zone && foot(zone) ? { zone, id: t.id } : undefined; // the engine walks to it (FR4 reach, MQ8)
}
/** the deck as it would read standing in title `zone` (MQ8: a thing anywhere on the map lists what the deck has for it
 *  there): that title as the character sees or remembers it, nothing on its ground unless in sight now */
function deckIn(ctx: DeckCtx, zone: string): { ctx: DeckCtx; groups: ReturnType<typeof deck> } | undefined {
  const { pv, s } = ctx, z = s && zoneById(s, zone);
  if (!s || !z) return undefined;
  const seen = pv.zones.find((x) => x.id === zone) ?? { ...zoneView(s, z, s.player), groundItems: [] };
  const c = { ...ctx, pv: { ...pv, zone: { ...seen, ...wallsView(s, z) } } };
  return { ctx: c, groups: deck(c) };
}
/** MAP-85: every deck action for a thing on the map, under the deck's own names, wherever it is that the character can
 *  reach on foot (MQ8): one away from the title you stand in plays with the walk to it, and the engine does it there
 *  (ACT-334). Greyed only for a reason the engine gives: a door's lock you hold no key to (no_key), a bed full of sleepers
 *  you see (bed_taken) */
export function thingActions(groups: ReturnType<typeof deck>, ctx: DeckCtx, t: MapThing): ThingEntry[] {
  if (t.kind === 'person') return actionsOn(groups, t.id).map((a) => ({ label: a.label, a, c: { target: t.id } }));
  const at = thingAt(ctx, t);
  const there = at && (at.zone === ctx.pv.zone.id ? { ctx, groups } : deckIn(ctx, at.zone));
  if (!at || !there) return [];
  const { pv } = there.ctx, id = at.id;
  /** the entry, its order with the walk to the thing first (the engine carries the action along it: MQ15 a) */
  const walked = (a: DeckAction, c: Choice, line = (l: string) => l): ThingEntry => ({ label: a.label, c,
    a: at.move ? { ...a, play: (ch: Choice) => { const o = a.play(ch); return { line: line(o.line), intent: { ...o.intent, move: at.move! } }; } } : a });
  const all = there.groups.flatMap((g) => g.actions);
  if (t.kind === 'furniture') { // MQ10 a: the deck's action for its kind, played with a walk to it
    const f = pv.zone.furniture?.find((x) => x.id === id), s = ctx.s;
    if (!f) return [];
    const full = !!s && sleepersOn(s, id).filter((x) => x !== s.player && ctx.pv.actors.some((a) => a.id === x.id)).length >= CONFIG.BED_SLEEPERS; // MQ18: full as far as you can see
    return all.filter((a) => !a.limit && FURNITURE_ACTS[t.is]?.includes(a.kind)).map((a) => full && a.kind === 'sleep' ? { label: a.label, why: 'That bed is full' } : walked(a, {}, (l) => `${l} on ${theItem(f.name)}`));
  }
  if (t.kind === 'item') return all.flatMap((a) => {
    const st = a.steps[0];
    return !a.limit && st && st.key !== 'words' && st.picks({}).some((p) => p.id === id) ? [walked(a, { [st.key]: id })] : [];
  });
  const out: ThingEntry[] = actionsOn(there.groups, id).filter((a) => t.kind !== 'door' || DOOR_KINDS.has(a.kind)).map((a) => walked(a, { target: id }));
  const w = t.kind === 'door' && !ctx.cowering ? pv.zone.links.find((l) => l.to === id)?.way : undefined;
  if (w && 'locked' in w && w.locked && !w.key && !w.barred && !w.blocked && !out.some((e) => 'a' in e && e.a.kind === 'way')) out.push({ label: WAY_LABEL, why: 'Needs its key', needs: 'its key' });
  return out;
}

/** the actions of one deck that can be done to or with this person (AD14: clicking someone), with the target already chosen */
export function actionsOn(groups: ReturnType<typeof deck>, id: string): DeckAction[] {
  return groups.flatMap((g) => g.actions).filter((a) => !a.limit && a.steps[0]?.key === 'target' && (a.steps[0] as { picks: (c: Choice) => Pick[] }).picks({}).some((p) => p.id === id));
}

