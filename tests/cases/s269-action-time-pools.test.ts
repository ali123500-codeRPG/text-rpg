// 269 Action time, stage 2 (AT19, AT20, AT23, AT48, AT78): each actor's turn is seconds of main and move time. An attack
// repeats while main time lasts; a finished action's leftover seconds carry into the next turn, so slow shots even out
// over turns, and the carry never passes one turn's length.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { resolveTurn } from '../../src/engine';
import type { GameState, Intent } from '../../src/types';
import { IT } from '../../src/library/itemIds';
import { PK } from '../../src/library/perkIds';
import { DU } from '../../src/library/tableIds';
import { CONFIG } from '../../src/config';
import { actionRow, actionSeconds, reactSeconds } from '../../src/ruleset/actionTime';

const intent = (action: Partial<NonNullable<Intent['action']>>): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type: 'attack', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal', ...action },
});
const turn = (s: GameState, i: Intent, seed = 1) => { s.turn += 1; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(seed)); };
/** already in the fight: no reaction time this turn (AT58) */
const inFight = (s: GameState) => { s.player.react = { s: 0, init: 100, turn: s.turn }; };
const archer = () => {
  const s = makeVillage();
  place(s, 'player', 'field_edge');
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
  s.mode = 'tactical';
  inFight(s);
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
    inFight(s);
    const ev = turn(s, intent({ target: 'guard_1' }));
    const blows = ev.filter((e) => e.kind === 'attack' && e.actorId === 'player').length;
    expect(blows).toBe(CONFIG.FIGHT_TURN_S / actionSeconds(actionRow(DU.blow)!));
  });
  it('AT58: a fight\'s first turn starts after the reaction time rolled for it; the roll stands for the fight', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    g.zone = s.player.zone;
    g.placeId = s.player.placeId;
    g.pos = { x: s.player.pos!.x + 0.5, y: s.player.pos!.y };
    s.mode = 'tactical';
    const ev = turn(s, intent({ target: 'guard_1' }));
    const r = s.player.react!;
    expect(r.s).toBeCloseTo(reactSeconds(r.init), 6);
    const blow = actionSeconds(actionRow(DU.blow)!);
    expect(ev.filter((e) => e.kind === 'attack' && e.actorId === 'player')).toHaveLength(Math.floor((CONFIG.FIGHT_TURN_S - r.s) / blow + 1e-9));
    turn(s, intent({ target: 'guard_1' }));
    expect(s.player.react).toMatchObject({ s: r.s, init: r.init, turn: s.turn });
  });
  it('AT60: a believed Bluff makes the foe hesitate: its turn starts after its reaction time again', () => {
    const blows = (bluff: boolean) => {
      const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
      const g = s.actors.find((a) => a.id === 'guard_1')!;
      g.zone = s.player.zone;
      g.placeId = s.player.placeId;
      g.pos = { x: s.player.pos!.x + 0.5, y: s.player.pos!.y };
      g.mind!.overrides = { player: 'hostile' };
      g.mind!.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
      s.mode = 'tactical';
      inFight(s);
      g.react = { s: 2, init: 50, turn: s.turn };
      if (bluff) g.perkMarks = [{ perk: PK.bluff, made: s.turn }];
      s.turn += 1;
      const ev = resolveTurn(s, { intent: { ...intent({ target: 'guard_1' }), action: null }, aimed: false, agentOutputs: [], spokespeople: [], fired: [{ actorId: 'guard_1', type: 'attack', target: 'player', skill: null, intent: '', source: 'trigger' }] }, createRng(3));
      return { n: ev.filter((e) => e.kind === 'attack' && e.actorId === 'guard_1').length, marks: g.perkMarks };
    };
    expect(blows(false).n).toBe(2);
    const b = blows(true);
    expect(b.n).toBe(1); // starts 2 s in: one 3 s blow fits
    expect(b.marks).toBeUndefined(); // the hesitation is spent
  });
});
