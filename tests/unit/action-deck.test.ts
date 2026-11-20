// AD8/AD10: the action deck lists every action the game knows (a Parser action, a gear order or a door order), each as one
// entry; AD9: the suggestion is scored by code with a reason; AD12: a move planned on the minimap rides along with an action.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { buildPlayerView } from '../../src/views';
import { actorById } from '../../src/engine/relations';
import type { GameState } from '../../src/types';
import { DECK_KINDS, actionsOn, deck } from '../../src/ui/deck';
import { suggestions } from '../../src/ui/suggest';
import { actionRow } from '../../src/ruleset/actionTime';
import { DU } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import { walkOrder, withPlanned } from '../../src/ui/deckView';


const fight = (s: GameState = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] })) => {
  const m = actorById(s, 'patron_1')!.mind!;
  m.overrides = { player: 'hostile' };
  m.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  s.mode = 'tactical';
  return s;
};

describe('the action deck covers everything (AD10: "make sure you covered EVERYTHING")', () => {

  it('every entry is one of the deck kinds; one entry per kind, perks aside (AD10: one entry each)', () => {
    const all = deck({ pv: buildPlayerView(fight()), s: fight() }).flatMap((g) => g.actions);
    for (const a of all) expect(DECK_KINDS).toContain(a.kind);
    const kinds = all.filter((a) => a.kind !== 'perk').map((a) => a.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('Search and a dash are there: Search plays at once around you (LX1), Go to runs on with no action', () => {
    const s = makeVillage();
    const all = deck({ pv: buildPlayerView(s), s }).flatMap((g) => g.actions);
    expect(all.find((a) => a.kind === 'search')!.steps).toEqual([]);
    expect(all.find((a) => a.kind === 'search')!.play({}).intent.action).toMatchObject({ type: 'search', target: null });
    const go = all.find((a) => a.kind === 'go')!;
    const to = go.steps[0].key === 'target' ? go.steps[0].picks({})[0].id : '';
    expect(go.play({ target: to }).intent).toMatchObject({ move: { toZone: to }, action: null });
    expect(go.note).toBeUndefined();
  });

  it('only free actions are marked (an icon, not words); every action says on hover how long it takes', () => {
    const s = makeVillage();
    const all = deck({ pv: buildPlayerView(s), s }).flatMap((g) => g.actions);
    const of = (k: string) => all.find((a) => a.kind === k)!;
    expect(all.some((a) => /your action|free/.test(a.note ?? ''))).toBe(false);
    const free = all.filter((a) => a.free);
    expect(free.length).toBeGreaterThan(0);
    for (const a of free) expect(a.time).toBe('Free: beside your action, not instead of it');
    expect(of('search').free).toBeUndefined(); // LX1: Search takes your action, the look around in it too
    expect(of('search').time).toBe(`Takes ${actionRow(DU.look)!.seconds} s`); // the Action times row the order uses
    expect(of('go').time).toBe('Takes as long as the way there');
    const f = fight(), atk = deck({ pv: buildPlayerView(f), s: f }).flatMap((g) => g.actions).find((a) => a.kind === 'attack')!;
    expect(atk.time).toMatch(/^Each blow takes \d+ s$/);
  });

  it('Put away, Armor on or off and Set down are free and sit at the bottom of their group; armor is a gear op, not the action', () => {
    const s = makeVillage();
    const use = deck({ pv: buildPlayerView(s), s }).find((g) => g.group === 'use')!.actions;
    expect(use.slice(-3).map((a) => a.kind)).toEqual(['stow', 'equip', 'set_down']);
    for (const a of use.slice(-3)) expect(a.free).toBe(true);
    const armor = use.find((a) => a.kind === 'equip')!, coat = `player_${IT.gambeson}_3`;
    expect(armor.play({ item: coat }).intent).toMatchObject({ action: null, gear: [{ op: 'armor', item: coat }] });
  });

  it('with Aim on, an attack asks for a body part after whom, and the order carries it aimed (AD5)', () => {
    const s = fight();
    const pv = buildPlayerView(s);
    const atk = deck({ pv, s, aim: true }).flatMap((g) => g.actions).find((a) => a.kind === 'attack')!;
    expect(atk.steps.map((x) => x.key).slice(0, 2)).toEqual(['target', 'part']);
    const part = atk.steps[1].key === 'part' ? atk.steps[1].picks({ target: 'patron_1' })[0].id : '';
    expect(atk.play({ target: 'patron_1', part }).intent.action).toMatchObject({ type: 'attack', target: 'patron_1', targetPart: part, aimed: true });
    expect(deck({ pv, s }).flatMap((g) => g.actions).find((a) => a.kind === 'attack')!.steps.some((x) => x.key === 'part')).toBe(false);
  });

  it('clicking a person lists only what can be done to or with them (AD14)', () => {
    const s = fight();
    const on = actionsOn(deck({ pv: buildPlayerView(s), s }), 'patron_1').map((a) => a.kind);
    expect(on).toEqual(expect.arrayContaining(['attack', 'talk', 'persuade']));
    expect(on).not.toContain('search'); // LX4: a person gets Pat down, never the Search around you
    expect(on).toContain('pat_down');
  });
});

describe('the suggestion (AD9)', () => {
  it('in a fight it is an attack on the foe, with a reason; Another walks down the rest', () => {
    const s = fight();
    const pv = buildPlayerView(s);
    const groups = deck({ pv, s });
    const sug = suggestions(groups, { pv, s });
    expect(sug[0].action.kind).toBe('attack');
    expect(sug[0].choice.target).toBe('patron_1');
    expect(sug[0].reason.length).toBeGreaterThan(0);
    expect(sug.map((x) => x.score)).toEqual([...sug.map((x) => x.score)].sort((a, b) => b - a));
  });

  it('with a broken nerve it is the yield', () => {
    const s = fight();
    const pv = buildPlayerView(s);
    expect(suggestions(deck({ pv, s, broken: true }), { pv, s, broken: true })[0].action.kind).toBe('yield');
  });

  it('with nothing pressing there is still something to do', () => {
    const s = makeVillage();
    const pv = buildPlayerView(s);
    expect(suggestions(deck({ pv, s }), { pv, s }).length).toBeGreaterThan(0);
  });
});

describe('a move planned on the minimap (AD12)', () => {
  const p = { zone: 'tav_common', x: 3, y: 4, metres: 5, seconds: 3, turns: 1, label: 'the common room, 5 m' };
  it('rides along with an action, the move first in the line', () => {
    const o = withPlanned({ line: 'Look around', intent: { move: null, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null } }, p);
    expect(o.intent.move).toEqual({ toZone: 'tav_common', spot: { at: { x: 3, y: 4 } } });
    expect(o.line).toBe('Move to the common room, then look around');
  });
  it('an order that already moves keeps its own move; Just go is a move alone', () => {
    const own = { line: 'Go', intent: { move: { toZone: 'x' }, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null } };
    expect(withPlanned(own, p)).toBe(own);
    expect(walkOrder(p).intent).toMatchObject({ move: { toZone: 'tav_common' }, action: null });
  });
});
