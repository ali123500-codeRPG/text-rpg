// 270 Long actions (AT2, AT6, AT17, AT25, AT28, AT47): in a fight, an action longer than a whole turn goes on turn after
// turn and takes effect only when its seconds are done. An attack breaks it by the row's focus; what is left goes by its
// progress (a bandage's work is lost and the bandage kept; a crossbow's spanning is kept). An NPC at one is not asked for a
// new order: it carries on.
import { describe, expect, it } from 'vitest';
import { actor, beside, makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { IT } from '../../src/library/itemIds';
import { DU } from '../../src/library/tableIds';
import { CONFIG } from '../../src/config';
import { actionRow, actionSeconds } from '../../src/ruleset/actionTime';
import { plannerActors } from '../../src/agents/game';
import { busyNow } from '../../src/engine/resolve';
import type { GameState } from '../../src/types';

const fightReady = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  s.mode = 'tactical';
  s.player.core.condition.hpLostPct = 30;
  s.player.core.inventory.push({ id: 'b1', itemId: IT.bandage, qty: 1 });
  s.player.react = { s: 0, init: 100, turn: s.pending.turn - 1 }; // already in the fight: no reaction time (AT58)
  return s;
};
const bandage = () => intent({ action: { type: 'use_item', item: 'b1', target: 'player' } });
const span = (s: GameState, id: string) => {
  const a = actor(s, id);
  for (const i of a.core.inventory) delete i.equippedIn;
  a.core.inventory.push({ id: `${id}_xbow`, itemId: IT.crossbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
};

describe('270 long actions', () => {
  it('AT2/AT17: a bandage in a fight takes its 40 s over turns, and heals only when done', () => {
    const s = fightReady();
    const need = actionSeconds(actionRow(DU.bandage)!);
    const turns = Math.ceil(need / CONFIG.FIGHT_TURN_S);
    for (let i = 1; i < turns; i++) {
      const ev = play(s, { intent: bandage() });
      expect(ev.find((e) => e.actorId === 'player' && e.kind === 'busy')?.busy).toMatchObject({ done: i * CONFIG.FIGHT_TURN_S, need });
      expect(s.player.core.condition.hpLostPct).toBeCloseTo(30, 1); // only natural recovery
    }
    play(s, { intent: bandage() });
    expect(s.player.busy).toBeUndefined();
    expect(s.player.core.condition.hpLostPct).toBeLessThan(30);
    expect(s.player.core.inventory.some((i) => i.id === 'b1')).toBe(false);
  });
  it('AT6/AT25: any attack breaks a careful bandage and its work is lost; the bandage is not used up', () => {
    const s = fightReady();
    const p = actor(s, 'patron_1');
    beside(s, 'patron_1');
    p.mind!.overrides = { player: 'hostile' };
    p.mind!.knowledge.player = { status: 'engaged', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    p.mind!.control = 'agent';
    play(s, { intent: bandage(), agentOutputs: [plannerOut('patron_1', act('hold'))] });
    expect(s.player.busy?.done).toBe(CONFIG.FIGHT_TURN_S);
    const ev = play(s, { intent: bandage(), agentOutputs: [plannerOut('patron_1', act('attack', 'player'))] });
    expect(ev.flatMap((e) => e.effects).find((f) => f.kind === 'broke_off')?.data).toMatchObject({ row: DU.bandage, then: 'lost' });
    expect(s.player.busy?.done ?? 0).toBeLessThanOrEqual(CONFIG.FIGHT_TURN_S); // what was done before is gone
    expect(s.player.core.inventory.some((i) => i.id === 'b1')).toBe(true);
  });
  it('AT11c/AT47: an NPC spanning a crossbow carries on without being asked; broken off, its spanning is kept', () => {
    const s = fightReady();
    span(s, 'guard_1');
    beside(s, 'guard_1', 'player', 4);
    const g = actor(s, 'guard_1');
    g.mind!.overrides = { player: 'hostile' };
    g.mind!.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    g.mind!.control = 'agent';
    play(s, { intent: intent(), agentOutputs: [plannerOut('guard_1', act('attack', 'player'))] });
    expect(g.busy?.row).toBe(DU.span_crossbow);
    expect(g.busy?.paused).toBeUndefined();
    expect(plannerActors(s)).not.toContain('guard_1');
    const before = g.busy!.done;
    play(s, { intent: intent() }); // no Planner output: the spanning goes on
    expect(g.busy!.done).toBeGreaterThan(before);
    play(s, { intent: intent({ action: { type: 'attack', target: 'guard_1' } }) });
    expect(g.busy).toMatchObject({ row: DU.span_crossbow, paused: true });
    expect(busyNow(g)).toBe(false); // its agent is asked again
  });
});
