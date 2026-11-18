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
import { isDownLevel, othersHealthWord, trueSkill } from '../ruleset';
import { isHeld } from '../ruleset/slots';
import { actorBody } from '../library';
import { cantSteady } from '../engine/steady';
import { cantExtract } from '../engine/extract';
import { walksAway } from '../engine/nerve';
import type { WayOp } from '../engine/barriers';
import { distText } from '../views';
import { lootSources } from './loot';
import { AGAINST_NATURE, pullOf, type IdeaGroup, type IdeaKind } from './ideaLeans';
import { healItems, partName } from './healing';
import { cap, r1, theItem } from '../words';
import { now, secondsSince } from '../time';

export const DECK_GROUPS = ['getaway', 'fight', 'talk', 'move', 'stealth', 'use', 'perks'] as const;
export type DeckGroup = (typeof DECK_GROUPS)[number];
export const DECK_GROUP_NAME: Record<DeckGroup, string> = { getaway: 'Your nerve is broken', fight: 'Fight', talk: 'Talk', move: 'Move', stealth: 'Stealth', use: 'Use', perks: 'Perks' };

/** one choice in a step: an id the order uses, and how it reads */
export type Pick = { id: string; label: string; note?: string; hot?: true };
export type Choice = { target?: string; item?: string; part?: string; words?: string; time?: string };
export type StepKey = 'target' | 'item' | 'part' | 'time';
/** a step asks one thing: a pick (from a list made from what was chosen before), or words typed in the Say box */
export type Step = { key: StepKey; title: string; picks: (c: Choice) => Pick[] } | { key: 'words'; title: string };
export type Order = { intent: Intent; line: string };
/** A3: a move with a limit that can't be used now: used this fight, or waiting (share: how much of the wait is gone, 0-1).
 * It stays in its group, shown by a mark, not words; the words are its tip */
export type DeckLimit = { used: true; tip: string } | { share: number; tip: string };
export type DeckAction = {
  kind: DeckKind; group: DeckGroup; label: string; note?: string; hot?: true; limit?: DeckLimit;
  steps: Step[]; play(c: Choice): Order;
};
export type DeckCtx = { pv: PlayerView; s?: GameState; stance?: 'careful' | 'normal' | 'reckless'; aim?: boolean; broken?: boolean; cowering?: boolean; self?: Personality }; // cowering: BF79, below Broken

/** every kind of action the deck can offer; the completeness test checks these cover every Parser action, gear op and
 * way op the game knows (DECK_LEFT_OUT says why the rest are not listed) */
export const DECK_KINDS = ['attack', 'finish', 'restrain', 'steady', 'yield', 'stand_down', 'extract', 'heal', 'talk', 'persuade', 'deceive', 'intimidate',
  'barter', 'demand', 'give', 'take', 'buy', 'sell', 'show', 'lets_search', 'go', 'walk_up', 'back_away', 'follow', 'jump', 'stop',
  'keep_walking', 'way', 'sneak', 'filch', 'stash', 'look', 'look_at', 'listen', 'search', 'use_item', 'equip', 'draw',
  'stow', 'swap', 'wear_acc', 'remove_acc', 'pick_up', 'set_down', 'summon', 'loot', 'open', 'break', 'pick', 'wait', 'rest',
  'sleep', 'perk'] as const;
export type DeckKind = (typeof DECK_KINDS)[number];
/** Parser actions with no entry, and why */
export const DECK_LEFT_OUT: Record<string, string> = {
  other: 'anything not listed is typed in the Say box', interact: 'typed in the Say box',
};

/** how each deck kind leans with the character's personality (ideaLeans) */
const LEAN: Partial<Record<DeckKind, IdeaKind>> = {
  attack: 'attack', steady: 'steady', yield: 'yield', talk: 'talk', persuade: 'talk', deceive: 'talk', go: 'go', sneak: 'sneak',
  stow: 'stow', draw: 'draw', pick_up: 'pick_up', summon: 'summon', look: 'look', search: 'search', perk: 'perk',
};

const BLANK: Intent = { move: null, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null };
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
  const stance = ctx.stance ?? 'normal';
  const act = (type: Act['type'], over: Partial<Act> = {}): Act => ({ type, skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance, ...over });
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
  const add = (kind: DeckKind, group: DeckGroup, label: string, steps: Step[], play: (c: Choice) => Order, extra: { note?: string; hot?: true; limit?: DeckLimit } = {}) =>
    A.push({ kind, group, label, steps, play, ...extra });

  // ---- Fight (MB12/BF37: a broken nerve allows no attack; words, a yield, sneaking and a walk away (BF79) still work) ----
  if (!broken) {
    if (strikable.length) {
      const weapons = inv.filter((i) => isHeld(i) && i.kind === 'weapon' && !i.cantSwing); // BG-283: never a weapon no hand can swing
      const withSteps: Step[] = weapons.length + (pv.player.bodyAttacks?.length ?? 0) > 1 ? [{ key: 'item', title: 'With what?', picks: () => [
        ...weapons.map((w) => ({ id: w.id, label: cap(w.name) })), ...(pv.player.bodyAttacks ?? []).filter((b) => !b.handsFull).map((b) => ({ id: `mode:${b.mode}`, label: cap(b.name) }))] }] : [];
      const partSteps: Step[] = ctx.aim && s ? [{ key: 'part', title: 'Aim at which part?', picks: (c) => {
        const t = s.actors.find((x) => x.id === c.target);
        return t ? actorBody(s, t).parts.map((p) => ({ id: p.id, label: partName(p.id) })) : [];
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
    if (why === null || why === 'too_soon') add('steady', 'fight', 'Steady yourself', [], () => order('Steady yourself', { action: act('steady') }), { note: 'your action · a morale roll',
      ...(why === 'too_soon' ? { limit: waiting(secondsSince(s!, s!.player.core.condition.steadiedTurn!), CONFIG.STEADY_COOLDOWN_S, 's') } : {}) });
    const down = seen.filter((a) => a.level === 'full' && a.health && isDownLevel(a.health));
    const extractable = s ? down.filter((a) => cantExtract(s, s.player, s.actors.find((x) => x.id === a.id)) === null) : [];
    if (extractable.length) add('extract', 'fight', 'Pull the Thread', [who('From whom?', extractable)], (c) => order(`Pull the essence from ${them(c)}`, { action: act('extract', { target: c.target! }) }), { note: 'take their essence' });
  }
  // MB40/SP5: give up the fight or spar you are in; TF11: take a foe's offer to stop
  if (fight || pv.player.spar || broken) add('yield', broken ? 'getaway' : 'fight', 'Yield', [], () => order('I yield', { yields: true }), { note: 'ends the fight if they take it' });
  for (const o of pv.player.standDownOffers ?? []) add('stand_down', 'talk', `Take ${o.name}'s offer to stop`, [], () => order(`I take ${o.name}'s offer to stop`, { standDown: o.id }), { note: 'ends your fight with them' });

  // ---- Talk: a plain talk opens a conversation at once; the rest need your words (typed in the Say box) ----
  const listeners = [...talkers, ...(pv.lastSeen ?? []).filter((x) => !x.gone && !x.mute).map((x) => ({ id: x.id, label: x.name, zone: x.zone, level: 'partial' } as unknown as PlayerView['actors'][number]))];
  if (listeners.length) {
    add('talk', 'talk', 'Talk to', [{ key: 'target', title: 'Talk to whom?', picks: () => listeners.map((a) => talkers.includes(a) ? person(a) : { id: a.id, label: cap(nameOf(a.id)), note: `last seen in ${zoneName(a.zone)}` }) }],
      (c) => order(`Talk to ${them(c)}`, { action: act('talk', { target: c.target! }), addressees: [c.target!] }));
    const speech = (kind: DeckKind, type: Act['type'], label: string, note: string, list = talkers, demand = false) => add(kind, 'talk', label, [who(`${label} whom?`, list), { key: 'words', title: 'What do you say?' }],
      (c) => order(c.words!, { action: act(type, { target: c.target!, ...(demand ? { demand: 'yield' as const } : {}) }), spoken: c.words!, addressees: [c.target!] }), { note });
    speech('persuade', 'persuade', 'Persuade', up.some((a) => a.talkDown) ? 'talk a foe down · easier once they are hurt or scared' : 'your words, Persuasion');
    speech('deceive', 'deceive', 'Lie to', up.some((a) => a.talkDown) ? `a lie to end it · ${skillName(SK.lying)} against their Insight` : `${skillName(SK.lying)} against their Insight`);
    speech('intimidate', 'intimidate', 'Threaten', 'Intimidation', up); // BF86: a threat needs no words, so beasts too
    speech('barter', 'barter', 'Haggle with', up.some((a) => a.talkDown) ? 'pay a foe to stop: name the coin' : 'Barter');
    const demandable = talkers.filter((a) => a.demandYield);
    if (demandable.length) speech('demand', 'persuade', 'Demand surrender', 'your action · Persuasion; a bigger win', demandable, true);
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
    if (places.length) add('go', g, 'Go to', [{ key: 'target', title: 'Go where?', picks: () => places }], (c) => order(`Go to ${places.find((p) => p.id === c.target)?.label ?? zoneName(c.target!)}`, { move: { toZone: c.target! } }),
      { note: 'runs there (a dash) · or click the minimap' });
    const drops = pv.zone.links.filter((l) => l.drop && away(l.to));
    if (drops.length) add('jump', g, 'Jump down', [{ key: 'target', title: 'Jump where?', picks: () => drops.map((l) => ({ id: l.to, label: cap(l.label) })) }], (c) => order(`Jump down to ${zoneName(c.target!)}`, { move: { toZone: c.target!, jump: true } }));
    const near = seen.filter((a) => a.level === 'full');
    if (near.length) {
      if (!broken) add('walk_up', 'move', 'Walk up to', [who('Walk up to whom?', near)], (c) => order(`Walk up to ${them(c)}`, { move: { toZone: near.find((a) => a.id === c.target)!.zone, spot: { near: c.target! } } }));
      add('back_away', g, 'Back away from', [who('Away from whom?', near)], (c) => order(`Back away from ${them(c)}`, { move: { toZone: pv.zone.id, spot: { awayFrom: c.target! } } }));
      if (!broken) add('follow', 'move', 'Follow', [who('Follow whom?', near)], (c) => order(`Follow ${them(c)}`, { move: { toZone: near.find((a) => a.id === c.target)!.zone, spot: { near: c.target!, follow: true } } }));
    }
    if (pv.player.walking && !broken) {
      add('keep_walking', 'move', pv.player.following ? `Keep following ${pv.player.following.name}` : `Keep walking to ${pv.player.walking.to}`, [], () => order(pv.player.following ? `Keep following ${pv.player.following.name}` : `Keep walking to ${pv.player.walking!.to}`, {}), { note: 'carries the walk on' });
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
    if (doors.length) add('way', g, 'Door, gate or bar', [{ key: 'target', title: 'Which way?', picks: () => doors.map((l) => ({ id: l.to, label: cap(l.label), note: wayNote(l) })) },
      { key: 'item', title: 'Do what?', picks: (c) => wayOps(doors.find((l) => l.to === c.target)!).map((op) => ({ id: op, label: cap(op) })) }],
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
  add('look', 'use', 'Look around', [], () => order('Look around', { action: act('observe', { skill: has(SK.eyesight) ? SK.eyesight : '' }) }), { note: 'free glance at all in sight' });
  const sights = [...strikable.map(person), ...pv.zones.filter((z) => z.id !== pv.zone.id).map((z) => ({ id: z.id, label: cap(z.name) }))];
  if (sights.length) add('look_at', 'use', 'Look at', [{ key: 'target', title: 'Look at whom or where?', picks: () => sights }], (c) => order(`Look at ${names.has(c.target!) ? them(c) : zoneName(c.target!)}`, { action: act('observe', { skill: has(SK.eyesight) ? SK.eyesight : '', target: c.target! }) }));
  add('listen', 'use', 'Listen', [], () => order('Listen', { action: act('observe', { skill: has(SK.earshot) ? SK.earshot : '' }) }));
  add('search', 'use', 'Search', [{ key: 'target', title: 'Search where?', picks: () => [{ id: '', label: 'Around you' }, ...full.map(person)] }],
    (c) => order(c.target ? `Search ${them(c)}` : 'Search', { action: act('search', { target: c.target || null }) }), { note: 'your action' });
  if (s && lootSources(pv).length) add('loot', 'use', 'Take things here', [], () => order('', {}), { note: 'pick what to pocket', hot: true });
  const healIds = new Set(s ? healItems(s, s.player).map((x) => x.itemId) : []);
  const heal = inv.filter((i) => healIds.has(i.itemId));
  // NR34: Heal opens at true Healing 50; on yourself or anyone you see in full
  if (s && trueSkill(s.player, SK.healing) >= CONFIG.HEAL_UNLOCK) add('heal', 'use', 'Heal', [{ key: 'target', title: 'Heal whom?', picks: () => [{ id: '', label: 'Yourself' }, ...full.map(person)] }],
    (c) => order(`Heal ${c.target ? them(c) : 'myself'}`, { action: act('heal', { target: c.target || null }) }), { note: 'a Healing roll' });
  if (heal.length) add('use_item', 'use', 'Treat wounds', [{ key: 'item', title: 'With what?', picks: () => heal.map(invPick) }, { key: 'target', title: 'Treat whom?', picks: () => [{ id: '', label: 'Yourself' }, ...full.map(person)] }],
    (c) => order(`Use ${theItem(item(c.item!)?.name ?? '')} on ${c.target ? them(c) : 'myself'}`, { action: act('use_item', { item: c.item!, target: c.target || null }) }));
  const stowed = inv.filter((i) => !i.equippedIn.length && i.kind === 'weapon'), held = inv.filter((i) => isHeld(i));
  if (stowed.length) add('draw', 'use', 'Draw', [{ key: 'item', title: 'Draw what?', picks: () => stowed.map(invPick) }], (c) => order(`Draw ${theItem(item(c.item!)?.name ?? '')}`, { gear: [{ op: 'draw', item: c.item! }] }), { note: 'free' });
  if (held.length) add('stow', 'use', 'Put away', [{ key: 'item', title: 'Put away what?', picks: () => held.map(invPick) }, ...(containers.some((g) => g.container?.open) || inv.some((i) => i.container) ? [{ key: 'target' as const, title: 'Into?', picks: () => [{ id: '', label: 'On you' }, ...inv.filter((i) => i.container).map(invPick), ...containers.filter((g) => g.container?.open).map((g) => ({ id: g.id, label: cap(g.name) }))] }] : [])],
    (c) => order(`Put away ${theItem(item(c.item!)?.name ?? '')}`, { gear: [{ op: 'stow', item: c.item!, ...(c.target ? { into: c.target } : {}) }] }), { note: 'free' });
  if (held.length && stowed.length) add('swap', 'use', 'Swap weapons', [{ key: 'item', title: 'Take up what?', picks: () => stowed.map(invPick) }], (c) => order(`Swap to ${theItem(item(c.item!)?.name ?? '')}`, { gear: [{ op: 'swap', item: c.item! }] }), { note: 'free' });
  const acc = inv.filter((i) => i.kind === 'accessory');
  if (acc.some((i) => !i.equippedIn.length)) add('wear_acc', 'use', 'Put on', [{ key: 'item', title: 'Put on what?', picks: () => acc.filter((i) => !i.equippedIn.length).map(invPick) }], (c) => order(`Put on ${theItem(item(c.item!)?.name ?? '')}`, { gear: [{ op: 'wear_acc', item: c.item! }] }), { note: 'free' });
  if (acc.some((i) => i.equippedIn.length)) add('remove_acc', 'use', 'Take off', [{ key: 'item', title: 'Take off what?', picks: () => acc.filter((i) => i.equippedIn.length).map(invPick) }], (c) => order(`Take off ${theItem(item(c.item!)?.name ?? '')}`, { gear: [{ op: 'remove_acc', item: c.item! }] }), { note: 'free' });
  const armor = inv.filter((i) => i.kind === 'armor');
  if (armor.length) add('equip', 'use', 'Armor on or off', [{ key: 'item', title: 'Which armor?', picks: () => armor.map((i) => ({ ...invPick(i), note: i.equippedIn.length ? 'worn: take it off' : 'put it on' })) }],
    (c) => order(`${item(c.item!)?.equippedIn.length ? 'Take off' : 'Put on'} ${theItem(item(c.item!)?.name ?? '')}`, { action: act('equip', { item: c.item! }) }), { note: 'your action' });
  const ground = pv.zone.groundItems.filter((g) => !g.container?.fixed);
  if (ground.length) add('pick_up', 'use', 'Pick up', [{ key: 'item', title: 'Pick up what?', picks: () => ground.map((g) => ({ id: g.id, label: cap(g.name) })) }], (c) => order(`Pick up ${theItem(ground.find((g) => g.id === c.item)?.name ?? '')}`, { gear: [{ op: 'pick_up', item: c.item! }] }), { note: 'free' });
  if (inv.length) add('set_down', 'use', 'Set down', [{ key: 'item', title: 'Set down what?', picks: () => inv.map(invPick) }], (c) => order(`Set down ${theItem(item(c.item!)?.name ?? '')}`, { gear: [{ op: 'set_down', item: c.item! }] }), { note: 'free' });
  if (pv.player.summonable?.length) add('summon', 'use', 'Summon', [{ key: 'item', title: 'Summon what?', picks: () => pv.player.summonable!.map((x) => ({ id: x.id, label: cap(x.name) })) }], (c) => order(`Summon ${pv.player.summonable!.find((x) => x.id === c.item)?.name ?? ''}`, { gear: [{ op: 'summon', item: c.item! }] }), { note: 'free' });
  const shut = [...containers.filter((g) => g.container?.shut), ...inv.filter((i) => i.container && !i.container.open)];
  if (shut.length) add('open', 'use', 'Open', [{ key: 'target', title: 'Open what?', picks: () => shut.map((g) => ({ id: g.id, label: cap(g.name), note: g.container?.lock === 'locked' ? (g.container.key ? 'locked · you hold its key' : 'locked') : undefined })) }],
    (c) => order(`Open ${theItem(shut.find((g) => g.id === c.target)?.name ?? '')}`, { action: act('open', { target: c.target! }) }), { note: 'your action' });
  const locked = containers.filter((g) => g.container?.lock === 'locked' && !g.container.key);
  const lockedWays = pv.zone.links.filter((l) => l.way && 'locked' in l.way && l.way.locked && !l.way.key);
  if (locked.length || lockedWays.length) add('pick', 'use', 'Pick a lock', [{ key: 'target', title: 'Which lock?', picks: () => [...locked.map((g) => ({ id: g.id, label: cap(g.name) })), ...lockedWays.map((l) => ({ id: l.to, label: cap(l.label) }))] }],
    (c) => order(`Pick the lock of ${locked.find((g) => g.id === c.target)?.name ?? pv.zone.links.find((l) => l.to === c.target)?.label ?? ''}`, { action: act('pick', { target: c.target! }) }), { note: 'your action' });
  if (locked.length) add('break', 'use', 'Force open', [{ key: 'target', title: 'Force what?', picks: () => locked.map((g) => ({ id: g.id, label: cap(g.name) })) }],
    (c) => order(`Force ${theItem(locked.find((g) => g.id === c.target)?.name ?? '')} open`, { action: act('break', { target: c.target! }) }), { note: 'loud' });
  if (!fight) {
    add('wait', 'use', 'Wait', [{ key: 'time', title: 'Wait until?', picks: () => [{ id: '', label: 'A moment', note: 'see what happens' }, { id: 'someone', label: 'Someone comes' }, ...['dawn', 'morning', 'afternoon', 'dusk', 'evening', 'night'].map((t) => ({ id: t, label: cap(t) }))] }],
      (c) => c.time ? order(c.time === 'someone' ? 'Wait for someone to come' : `Wait until ${c.time}`, { action: act('wait', { target: c.time }) }) : order('Wait and see', {}));
    const rested = s?.clocks[`rest:${s.player.id}`], since = s && rested !== undefined ? now(s) - rested : Infinity;
    add('rest', 'use', 'Rest', [], () => order('Rest a while', { action: act('rest') }), { note: 'a short rest', ...(since < CONFIG.REST_COOLDOWN_MIN ? { limit: waiting(since, CONFIG.REST_COOLDOWN_MIN, 'min') } : {}) });
    add('sleep', 'use', 'Sleep', [], () => order('Sleep', { action: act('sleep') }));
  }

  // ---- Perks (AE5/AE8: perk moves; a free one goes beside the turn, an action one is the turn) ----
  for (const m of pv.player.perkMoves ?? []) {
    const label = PERK_LABEL[m.id] ?? m.name;
    const note = `${m.name} · ${m.action ? 'your action' : 'free'}`;
    if (m.used) add('perk', 'perks', label, [], () => order(label, { perkMove: { perk: m.id, target: null } }), { note, limit: { used: true, tip: 'Used this fight' } });
    else if (!m.inRange) add('perk', 'perks', label, [], () => order(label, { perkMove: { perk: m.id, target: null } }), { note });
    else if (m.inRange.length) add('perk', 'perks', label, [who(`${label}: whom?`, up.filter((a) => m.inRange!.includes(a.id)))], (c) => order(`${label}: ${them(c)}`, { perkMove: { perk: m.id, target: c.target! } }), { note });
  }

  // the character's leanings order groups and actions (ties keep their place); an action pulled away from says so
  const p = ctx.self;
  const pull = (k: IdeaKind | IdeaGroup | undefined) => (p && k ? pullOf(k, p) : 0);
  const by = <T>(xs: T[], v: (x: T) => number) => xs.map((x, i) => ({ x, i, v: v(x) })).sort((a, b) => b.v - a.v || a.i - b.i).map((e) => e.x);
  const groups = DECK_GROUPS.map((g) => ({ group: g, name: DECK_GROUP_NAME[g], actions: by(A.filter((a) => a.group === g), (a) => pull(LEAN[a.kind])) }))
    .filter((g) => g.actions.length && g.actions.some((a) => !a.steps.length || a.steps[0].key === 'words' || (a.steps[0] as { picks: (c: Choice) => Pick[] }).picks({}).length));
  for (const g of groups) for (const a of g.actions) if (p && LEAN[a.kind] && pull(LEAN[a.kind]) <= -CONFIG.IDEA_AGAINST_NATURE) a.note = a.note ? `${a.note} · ${AGAINST_NATURE}` : AGAINST_NATURE;
  return by(groups, (g) => (g.group === 'getaway' ? Infinity : pull(g.group === 'use' || g.group === 'perks' ? undefined : g.group)));
}

/** perk moves that read better as a deed than by the perk's name */
const PERK_LABEL: Record<string, string> = { [PK.dirt_in_the_eyes]: 'Throw dirt in the eyes', [PK.bluff]: 'Bluff "Behind you!"', [PK.battle_cry]: 'Let out a battle cry', [PK.rally]: 'Rally your side' };

/** the actions of one deck that can be done to or with this person (AD14: clicking someone), with the target already chosen */
export function actionsOn(groups: ReturnType<typeof deck>, id: string): DeckAction[] {
  return groups.flatMap((g) => g.actions).filter((a) => !a.limit && a.steps[0]?.key === 'target' && (a.steps[0] as { picks: (c: Choice) => Pick[] }).picks({}).some((p) => p.id === id));
}

