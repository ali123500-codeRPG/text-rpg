// SX8: which deck entries ride beside the main action, read from real turns. Every case plays whole turns on the deck's own
// path (game.act: legality, resolve, save) with the order the deck entry builds; what is expected comes from the turns,
// never from the deck's free mark. An entry is played beside a sword blow at Old Wim (the main action): it rides beside
// when the blow still happens that turn, the entry's own work is done, and the main time left over (carried, AT20) is what
// the blow alone leaves. Only the last check compares the deck's mark with what the turns showed.
// deck-free-matches-engine.test.ts checks the same mark against the Order the engine builds.
import { describe, expect, it } from 'vitest';
import { actor, lay, place } from '../harness';
import { wholeTurn } from '../harness/turn';
import { readTurnRecord } from '../../src/save';
import { buildPlayerView } from '../../src/views';
import { learn, TRICK } from '../../src/engine/ruses';
import { PERK_MOVES } from '../../src/ruleset';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';
import { deck, type Choice, type DeckAction } from '../../src/ui/deck';
import type { GameEvent, GameState, Intent } from '../../src/types';

const BLANK: Intent = { move: null, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null };
const SWORD = `player_${IT.arming_sword}_1`, SHIELD = `player_${IT.round_shield}_2`;
const BLOW: Intent['action'] = { type: 'attack', skill: '', target: 'patron_1', targetPart: null, item: SWORD, mode: null, approach: '' };
const SEARCH: Intent['action'] = { type: 'search', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '' };

/** a fight in the common room: Old Wim hostile at arm's length; the player's sword in the right hand and the left hand
 * free (the shield put away), a dagger and an amulet carried, spectacles worn, a dagger at the player's feet, the player's
 * Threadbound charm out in the far field; Bertram on the player's side beside them, and Old Wim's play-dead trick known,
 * so the player can warn Bertram about him; every perk move owned */
function fight(prep?: (s: GameState) => void) {
  const g = wholeTurn({ engaged: ['patron_1'], without: ['slime_1', 'slime_2', 'trader'] });
  const s = g.game.state()!, p = s.player, wim = actor(s, 'patron_1');
  wim.mind!.overrides = { player: 'hostile' };
  wim.mind!.knowledge.player = { status: 'engaged', lastKnownZone: p.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  wim.pos = { x: p.pos!.x + 0.8, y: p.pos!.y };
  const friend = place(s, 'guard_1', p.zone);
  friend.pos = { x: p.pos!.x - 0.8, y: p.pos!.y };
  friend.bandId = p.bandId;
  delete friend.asleep;
  friend.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [], lastKnownZone: p.zone, lastSeenTurn: s.turn };
  p.engagement = { start: s.turn, last: s.turn, kinds: ['fight'] };
  for (const i of p.core.inventory) if (i.id === SHIELD) delete i.equippedIn;
  p.core.inventory.push({ id: 'dagger_1', itemId: IT.dagger }, { id: 'amulet_1', itemId: IT.amulet }, { id: 'specs_1', itemId: IT.spectacles, equippedIn: ['acc:0'] });
  lay(s, p.zone, { id: 'ground_dagger', itemId: IT.dagger }, { x: p.pos!.x, y: p.pos!.y + 0.3 });
  lay(s, 'field_far', { id: 'loop_1', itemId: IT.varos_loop, boundTo: p.id });
  learn(s, p, wim.id, TRICK.play_dead);
  for (const perkId of Object.keys(PERK_MOVES)) p.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
  prep?.(s);
  return g;
}

/** plays one whole turn of `intent`; the player's events and the main time it carries on (AT20) */
async function play(g: ReturnType<typeof fight>, intent: Intent) {
  const t = g.game.state()!.turn;
  await g.game.act({ line: 'test order', intent }, { aimed: false });
  await g.game.settle();
  expect(g.game.state()!.turn, 'the turn played').toBe(t + 1);
  const events = ((await readTurnRecord(g.store, g.state.storyId, t))?.events ?? []).filter((e) => e.actorId === 'player');
  return { events, carried: (g.game.state()!.player.carry ?? []).reduce((n, c) => n + c.main, 0), s: g.game.state()! };
}

/** the deck entry of this kind (a perk move by its perk), as the screen offers it in this state */
function entry(s: GameState, kind: string, perk?: string): DeckAction {
  const pv = buildPlayerView(s), name = perk && pv.player.perkMoves?.find((m) => m.id === perk)?.name;
  const a = deck({ pv, s }).flatMap((x) => x.actions).find((x) => x.kind === kind && (!perk || x.note === name));
  if (!a) throw new Error(`no ${kind}${perk ? ` ${perk}` : ''} entry`);
  return a;
}
/** the order the entry plays: the given picks, else the first of each step */
function orderOf(a: DeckAction, given: Choice = {}): Intent {
  const c: Choice = { ...given };
  for (const st of a.steps) if (st.key !== 'words' && c[st.key] === undefined) c[st.key] = st.picks(c)[0]?.id;
  return a.play(c).intent;
}
/** the entry's order with an action beside it: everything the entry orders, and the action */
const besideAction = (i: Intent, action: Intent['action']): Intent => ({ ...i, action });

const inHand = (s: GameState, id: string) => !!s.player.core.inventory.find((i) => i.id === id)?.equippedIn?.some((x) => x.startsWith('grip:'));
const worn = (s: GameState, id: string) => !!s.player.core.inventory.find((i) => i.id === id)?.equippedIn?.length;
const has = (ev: GameEvent[], kind: string) => ev.some((e) => e.kind === kind);
const blows = (ev: GameEvent[]) => ev.filter((e) => e.kind === 'attack' && e.target === 'patron_1').length;

type Case = { name: string; kind: string; perk?: string; choice?: Choice; prep?: (s: GameState) => void; beside: boolean; done: (ev: GameEvent[], s: GameState) => boolean };
const sheathed = (s: GameState) => { for (const i of s.player.core.inventory) if (i.id === SWORD) delete i.equippedIn; };
const CASES: Case[] = [
  { name: 'Draw', kind: 'draw', choice: { item: SWORD }, prep: sheathed, beside: true, done: (_, s) => inHand(s, SWORD) },
  { name: 'Put away', kind: 'stow', choice: { item: SHIELD }, prep: (s) => { s.player.core.inventory.find((i) => i.id === SHIELD)!.equippedIn = ['grip:left_arm']; }, beside: true, done: (_, s) => !inHand(s, SHIELD) },
  { name: 'Swap weapons', kind: 'swap', choice: { item: SWORD }, prep: (s) => { sheathed(s); s.player.core.inventory.find((i) => i.id === 'dagger_1')!.equippedIn = ['grip:right_arm']; }, beside: true, done: (_, s) => inHand(s, SWORD) && !inHand(s, 'dagger_1') },
  { name: 'Put on (an accessory)', kind: 'wear_acc', choice: { item: 'amulet_1' }, beside: true, done: (_, s) => worn(s, 'amulet_1') },
  { name: 'Take off (an accessory)', kind: 'remove_acc', choice: { item: 'specs_1' }, beside: true, done: (_, s) => !worn(s, 'specs_1') },
  { name: 'Armor on or off', kind: 'equip', beside: true, done: (_, s) => !s.player.core.inventory.some((i) => i.itemId === IT.gambeson && i.equippedIn?.length) },
  { name: 'Pick up, within grip reach', kind: 'pick_up', choice: { item: 'ground_dagger' }, beside: true, done: (ev) => has(ev, 'pick_up') },
  { name: 'Set down', kind: 'set_down', choice: { item: 'amulet_1' }, beside: true, done: (ev) => has(ev, 'set_down') },
  { name: 'Summon', kind: 'summon', beside: true, done: (ev) => has(ev, 'summon') },
  { name: 'Warn your side', kind: 'warn', beside: true, done: (ev) => has(ev, 'warn') },
  { name: 'Dirt in the Eyes (a free perk move)', kind: 'perk', perk: PK.dirt_in_the_eyes, choice: { target: 'patron_1' }, beside: true, done: (ev) => has(ev, 'perk_move') },
  { name: 'Bluff (a free perk move)', kind: 'perk', perk: PK.bluff, choice: { target: 'patron_1' }, beside: true, done: (ev) => has(ev, 'perk_move') },
  { name: 'Draw Them In (a free perk move)', kind: 'perk', perk: PK.draw_them_in, beside: true, done: (ev) => has(ev, 'perk_move') },
  { name: 'Grit Your Teeth (a free perk move: a steady)', kind: 'perk', perk: PK.grit_your_teeth, beside: true, done: (ev) => has(ev, 'steady') },
  // AT11: a perk move that is an action spends its Action times row from the main time; what is left still goes to the
  // action ordered with it (s159: the roar, then the blow), so the blow happens, but less main time is carried
  { name: 'Battle Cry (an action perk move)', kind: 'perk', perk: PK.battle_cry, beside: false, done: (ev) => has(ev, 'battle_cry') },
  { name: 'Rally (an action perk move)', kind: 'perk', perk: PK.rally, beside: false, done: (ev) => has(ev, 'rally') },
  { name: 'Play Dead (an action perk move, open after a bad blow)', kind: 'perk', perk: PK.play_dead, prep: (s) => { s.player.playDeadOpen = s.turn; }, beside: false, done: (ev) => has(ev, 'play_dead') },
];

describe('SX8: deck entries played beside a sword blow, in whole turns', () => {
  const seen = new Map<string, { beside: boolean; marked: boolean }>();
  let alone: Awaited<ReturnType<typeof play>>;
  it('the blow alone: one blow at Old Wim, and main time left over to carry', async () => {
    alone = await play(fight(), { ...BLANK, action: BLOW });
    expect(blows(alone.events)).toBe(1);
    expect(alone.carried).toBeGreaterThan(0);
  });
  for (const c of CASES) it(`${c.name}: ${c.beside ? 'rides beside it, taking none of its time' : 'takes main time from it, the blow still follows'}`, async () => {
    const g = fight(c.prep);
    const a = entry(g.game.state()!, c.kind, c.perk);
    const r = await play(g, besideAction(orderOf(a, c.choice), BLOW));
    expect(c.done(r.events, r.s), 'the entry did its work').toBe(true);
    expect(blows(r.events), 'the blow still happened').toBe(1);
    const beside = Math.abs(r.carried - alone.carried) < 1e-6;
    expect(beside, `main time carried: ${r.carried} with it, ${alone.carried} without`).toBe(c.beside);
    if (!c.beside) expect(r.carried).toBeLessThan(alone.carried);
    seen.set(c.name, { beside, marked: !!a.free });
  });

  it('a pick-up out of grip reach beside a Search: the walk over takes the move, and the Search follows it (FR2)', async () => {
    const g = fight((s) => lay(s, s.player.zone, { id: 'far_dagger', itemId: IT.dagger }, { x: s.player.pos!.x, y: s.player.pos!.y - 3 }));
    const s = g.game.state()!, from = { ...s.player.pos! };
    const r = await play(g, besideAction(orderOf(entry(s, 'pick_up'), { item: 'far_dagger' }), SEARCH));
    expect(has(r.events, 'pick_up') && has(r.events, 'search')).toBe(true);
    expect(r.events.findIndex((e) => e.kind === 'pick_up')).toBeLessThan(r.events.findIndex((e) => e.kind === 'search'));
    expect(Math.hypot(r.s.player.pos!.x - from.x, r.s.player.pos!.y - from.y)).toBeGreaterThan(1);
  });

  it('a pick-up out of grip reach beside a blow: the blow keeps the player at the foe, and the pick-up waits (pick_up_short)', async () => {
    const g = fight((s) => lay(s, s.player.zone, { id: 'far_dagger', itemId: IT.dagger }, { x: s.player.pos!.x, y: s.player.pos!.y - 3 }));
    const r = await play(g, besideAction(orderOf(entry(g.game.state()!, 'pick_up'), { item: 'far_dagger' }), BLOW));
    expect(blows(r.events)).toBe(1);
    expect(has(r.events, 'pick_up')).toBe(false);
    expect(r.events.some((e) => e.kind === 'wasted' && e.itemId === 'far_dagger')).toBe(true);
  });

  it('an entry that rides beside, played alone, leaves the main action unused: the player holds that turn', async () => {
    for (const [kind, choice] of [['remove_acc', { item: 'specs_1' }], ['warn', {}]] as const) {
      const g = fight();
      const r = await play(g, orderOf(entry(g.game.state()!, kind), choice));
      expect(has(r.events, 'hold'), kind).toBe(true);
      expect(blows(r.events), kind).toBe(0);
    }
  });

  it('the deck marks free exactly the entries the turns showed riding beside', () => {
    expect(seen.size).toBe(CASES.length);
    for (const [name, v] of seen) expect(v.marked, name).toBe(v.beside);
  });
});

/** entries that are the turn's main action themselves: played alone, the turn's action is theirs and the player does not hold */
const MAIN: { kind: string; event: string; choice?: Choice }[] = [
  { kind: 'attack', event: 'attack', choice: { target: 'patron_1' } },
  { kind: 'search', event: 'search' },
  { kind: 'listen', event: 'observe' },
  { kind: 'look_at', event: 'observe', choice: { target: 'patron_1' } },
  { kind: 'steady', event: 'steady' },
  { kind: 'pat_down', event: 'search', choice: { target: 'patron_1' } },
];

describe('SX8: entries that are the main action, in whole turns', () => {
  for (const m of MAIN) it(`${m.kind} is the turn's main action`, async () => {
    const g = fight();
    const a = entry(g.game.state()!, m.kind);
    const r = await play(g, orderOf(a, m.choice));
    expect(r.events.map((e) => e.kind)).toContain(m.event);
    expect(has(r.events, 'hold')).toBe(false);
  });
});
