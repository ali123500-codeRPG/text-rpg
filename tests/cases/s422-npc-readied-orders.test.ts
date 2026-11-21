// 422 NPC readied orders (AE6, RQ3 a): an NPC's agent readies a step as the player does ("when"), the engine watches it
// with the same check and plays it the moment it comes true, in a fight and outside one (on the player's walk in, the moment they cross into the
// spear's reach), it holds through turns with no new order from its agent, and drops after READY_MAX_S or a new order.
import { describe, expect, it } from 'vitest';
import { actor, createRng, fit, makeVillage, place } from '../harness';
import { resolveTurn } from '../../src/engine';
import type { Actor, GameState, Intent } from '../../src/types';
import type { AcceptedAgentOutput } from '../../src/engine/types';
import type { ReadyWhen } from '../../src/scales';
import { IT } from '../../src/library/itemIds';
import { CONFIG } from '../../src/config';
import { checkPlanner } from '../../src/agents/schema';
import { PLANNER_SHAPE } from '../../src/agents/prompts';

const waiting: Intent = { move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null };
const strike: Intent = { ...waiting, action: { type: 'attack', skill: '', target: 'patron_1', targetPart: null, item: null, mode: null, approach: '' } };
const plan = (when: ReadyWhen | null, type = 'attack'): AcceptedAgentOutput => ({
  agent: 'planner', actorId: 'patron_1',
  output: { action: { type, target: 'player', skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: 'waits for him' }, dialogue: null, gear: null, stance: null, planUpdate: null, when },
} as never);
const turn = (s: GameState, i: Intent, outs: AcceptedAgentOutput[], seed: number) => { s.turn += 1; s.log = []; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: outs, spokespeople: [] }, createRng(seed)); };
const hold = (a: Actor, id: string, item: string) => {
  for (const i of a.core.inventory) delete i.equippedIn;
  a.core.inventory.push({ id, itemId: item, qty: 1, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
};
/** the patron, hostile and holding a spear, `m` metres off the player (who holds a short sword), both already in the fight */
const setup = (m = 4, weapon: string = IT.spear) => {
  const s = makeVillage({ without: ['slime_1', 'slime_2'] });
  place(s, 'player', 'field_edge');
  hold(s.player, 'w', IT.short_sword);
  const p = actor(s, 'patron_1');
  p.zone = s.player.zone; p.placeId = s.player.placeId; p.floor = s.player.floor; p.pos = { x: s.player.pos!.x + m, y: s.player.pos!.y };
  hold(p, 'sp', weapon);
  fit(p, weapon);
  p.mind!.overrides = { player: 'hostile' };
  s.mode = 'tactical';
  s.player.react = { s: 0, init: 100, turn: s.turn };
  p.react = { s: 0, init: 0, turn: s.turn };
  return s;
};
const blows = (ev: { kind: string; actorId?: string }[], id: string) => ev.filter((e) => e.kind === 'attack' && e.actorId === id).length;

describe('422 NPC readied orders', () => {
  it('RQ3 a: the patron readies its spear; the player closing in sets it off the moment they cross into its reach', () => {
    const s = setup(6);
    const ev1 = turn(s, waiting, [plan({ on: 'closes', who: 'player' })], 5);
    expect(blows(ev1, 'patron_1')).toBe(0);
    expect(actor(s, 'patron_1').readied?.order.type).toBe('attack');
    const ev2 = turn(s, strike, [], 6);
    const fired = s.log.find((l) => l.code === 'ready_fired')?.detail;
    expect(fired?.actorId).toBe('patron_1');
    expect(fired?.by).toEqual(['player']);
    // RY2 a: on the way in, as they cross into reach: a short sword's shorter reach is met later on the same walk
    const sw = setup(6, IT.short_sword);
    turn(sw, waiting, [plan({ on: 'closes', who: 'player' })], 5);
    turn(sw, strike, [], 6);
    expect(fired!.at as number).toBeLessThan(sw.log.find((l) => l.code === 'ready_fired')!.detail!.at as number);
    // its 4 s thrust started late in the turn, so it finishes first thing next turn (RY5 b)
    expect(actor(s, 'patron_1').busy?.ready?.type).toBe('attack');
    expect(turn(s, waiting, [], 7).some((e) => e.kind === 'attack' && e.actorId === 'patron_1' && e.target === 'player')).toBe(true);
    expect(actor(s, 'patron_1').readied).toBeUndefined();
  });
  it('RY4 a: with no new order it holds on and makes no blow, and drops after READY_MAX_S', () => {
    const s = setup();
    turn(s, waiting, [plan({ on: 'draws', who: 'player' })], 5); // the player's sword is already out: never draws
    for (let t = 1; t < CONFIG.READY_MAX_S / CONFIG.FIGHT_TURN_S; t++) {
      expect(actor(s, 'patron_1').readied).toBeDefined();
      expect(blows(turn(s, waiting, [], 5 + t), 'patron_1')).toBe(0);
    }
    expect(actor(s, 'patron_1').readied).toBeUndefined();
    expect(s.log.some((l) => l.code === 'ready_expired' && l.detail?.actorId === 'patron_1')).toBe(true);
  });
  it('a new order from its agent drops the waiting step', () => {
    const s = setup();
    turn(s, waiting, [plan({ on: 'draws', who: 'player' })], 5);
    turn(s, waiting, [plan(null, 'hold')], 6);
    expect(actor(s, 'patron_1').readied).toBeUndefined();
  });
  it('the Planner returns "when" in its shape and the schema keeps it', () => {
    expect(PLANNER_SHAPE).toContain('"when"?:');
    const out = { ...plan({ on: 'comes', who: 'anyone' }).output } as Record<string, unknown>;
    const v = checkPlanner(out);
    expect(v.errors).toEqual([]);
    expect(v.value.when).toEqual({ on: 'comes', who: 'anyone' });
    expect(checkPlanner({ ...out, when: { on: 'speaks', who: 'player' } }).errors.length).toBeGreaterThan(0);
  });
  it('outside a fight it holds its ground across turns, fires as the player closes, and lasts WAIT_SOMEONE_MAX_H', () => {
    const s = setup(6);
    s.mode = 'explore';
    turn(s, waiting, [plan({ on: 'closes', who: 'player' })], 5);
    const p = actor(s, 'patron_1'), at = { ...p.pos! };
    turn(s, waiting, [], 6);
    expect(p.readied?.order.type).toBe('attack'); // kept from turn to turn
    expect(p.pos).toEqual(at); // its routine does not walk it off (catchUp)
    p.readied!.since! -= CONFIG.WAIT_SOMEONE_MAX_H * 60;
    turn(s, waiting, [], 7);
    expect(p.readied).toBeUndefined();
    expect(s.log.some((l) => l.code === 'ready_expired' && l.detail?.actorId === 'patron_1')).toBe(true);
    const t = setup(6);
    t.mode = 'explore';
    turn(t, waiting, [plan({ on: 'closes', who: 'player' })], 5);
    turn(t, waiting, [], 6);
    turn(t, strike, [], 7);
    expect(t.log.find((l) => l.code === 'ready_fired')?.detail?.actorId).toBe('patron_1');
  });
});
