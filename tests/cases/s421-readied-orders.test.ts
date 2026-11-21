// 421 Readied orders in a fight (AE6, RY1–RY5): the step waits on the player, plays by itself the moment its condition comes
// true within a turn (for "closes", when the foe crossed into the step's reach: a longer weapon meets it sooner), and a
// step that fires too late in its turn starts at once and finishes first thing next turn. Nothing else covers this turn
// ordering: the Parser tests run only nightly and never resolve a turn.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { resolveTurn } from '../../src/engine';
import type { GameState, Intent } from '../../src/types';
import { IT } from '../../src/library/itemIds';
import { CONFIG } from '../../src/config';

const readied: Intent = {
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, when: { on: 'closes', who: 'slime_1' },
  action: { type: 'attack', skill: '', target: 'slime_1', targetPart: null, item: null, mode: null, approach: '' },
};
const waiting: Intent = { move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null };
const turn = (s: GameState, i: Intent, seed: number) => { s.turn += 1; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(seed)); };
/** a slime 4 m off in a fight, the player holding `weapon` two-handed, already in the fight (no reaction time) */
const setup = (weapon: string) => {
  const s = makeVillage({ without: ['slime_2'] });
  place(s, 'player', 'field_edge');
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'w', itemId: weapon, qty: 1, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
  const sl = s.actors.find((a) => a.id === 'slime_1')!;
  sl.zone = s.player.zone; sl.placeId = s.player.placeId; sl.pos = { x: s.player.pos!.x + 4, y: s.player.pos!.y };
  s.mode = 'tactical';
  s.player.react = { s: 0, init: 100, turn: s.turn };
  return s;
};
/** plays the readied order and held turns until it fires: the second it fired at, and the turn after it */
const play = (weapon: string) => {
  const s = setup(weapon);
  for (let t = 0; t < CONFIG.READY_MAX_S / CONFIG.FIGHT_TURN_S; t++) {
    s.log = [];
    turn(s, t ? waiting : readied, 5 + t);
    const fired = s.log.find((l) => l.code === 'ready_fired');
    if (fired) return { s, at: fired.detail!.at as number };
  }
  throw new Error('the readied step never fired');
};

describe('421 readied orders in a fight', () => {
  it('RY1/RY2 a: the step waits through held turns and fires as the slime closes; a spear meets it before a short sword', () => {
    const sword = play(IT.short_sword), spear = play(IT.spear);
    expect(sword.s.player.readied).toBeUndefined();
    expect(spear.at).toBeLessThan(sword.at);
  });
  it('RY5 b: a step that fires too late in its turn starts at once and finishes first thing next turn', () => {
    const { s } = play(IT.short_sword);
    const b = s.player.busy!;
    expect(b.ready?.type).toBe('attack'); // started this turn, not done
    const ev = turn(s, waiting, 20);
    const blow = ev.findIndex((e) => e.kind === 'attack' && e.actorId === 'player' && e.target === 'slime_1');
    expect(blow).toBeGreaterThanOrEqual(0);
    expect(s.player.busy).toBeUndefined();
  });
  it('RY4 a: held turns end after READY_MAX_S when the condition never comes', () => {
    const s = setup(IT.short_sword);
    turn(s, { ...readied, when: { on: 'draws', who: 'slime_1' } }, 5); // a slime never draws
    for (let t = 1; t < CONFIG.READY_MAX_S / CONFIG.FIGHT_TURN_S; t++) { expect(s.player.readied).toBeDefined(); turn(s, waiting, 5 + t); }
    expect(s.player.readied).toBeUndefined();
  });
});
