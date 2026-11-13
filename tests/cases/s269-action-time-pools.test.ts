// 269 Action time, stage 2 (AT19, AT20, AT23, AT48, AT78): each actor's turn is seconds of main and move time. An attack
// repeats while main time lasts; a finished action's leftover seconds carry into the next turn, so slow shots even out
// over turns, and the carry never passes one turn's length.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { resolveTurn } from '../../src/engine';
import type { GameState, Intent } from '../../src/types';
import { IT } from '../../src/library/itemIds';
import { DU } from '../../src/library/tableIds';
import { CONFIG } from '../../src/config';
import { actionRow, actionSeconds } from '../../src/ruleset/actionTime';

const intent = (action: Partial<NonNullable<Intent['action']>>): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type: 'attack', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal', ...action },
});
const turn = (s: GameState, i: Intent, seed = 1) => { s.turn += 1; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(seed)); };
const archer = () => {
  const s = makeVillage();
  place(s, 'player', 'field_edge');
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
  s.mode = 'tactical';
  return s;
};

describe('269 action time pools', () => {
  it('AT20/AT23: a light bow shot leaves seconds over; they carry, never past one turn, and the shots even out', () => {
    const s = archer();
    const shot = actionSeconds(actionRow(DU.bow_light)!);
    let shots = 0;
    const turns = 5;
    for (let i = 0; i < turns; i++) {
      const slime = s.actors.find((a) => a.id === 'slime_1')!;
      slime.core.condition.hpLostPct = 0; // keep the target standing
      const ev = turn(s, intent({ target: 'slime_1' }), 10 + i);
      shots += ev.filter((e) => e.kind === 'attack' && e.actorId === 'player').length;
      expect(s.player.carry?.main ?? 0).toBeLessThanOrEqual(CONFIG.FIGHT_TURN_S);
    }
    expect(shots).toBe(Math.floor((turns * CONFIG.FIGHT_TURN_S) / shot));
  });
  it('AT78: a blow beside the target repeats while the turn lasts', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const g = s.actors.find((a) => a.id === 'guard_1')!; // armoured and steady: still up after the first blow
    g.zone = s.player.zone;
    g.placeId = s.player.placeId;
    g.pos = { x: s.player.pos!.x + 0.5, y: s.player.pos!.y };
    s.mode = 'tactical';
    const ev = turn(s, intent({ target: 'guard_1' }));
    const blows = ev.filter((e) => e.kind === 'attack' && e.actorId === 'player').length;
    expect(blows).toBe(CONFIG.FIGHT_TURN_S / actionSeconds(actionRow(DU.blow)!));
  });
});
