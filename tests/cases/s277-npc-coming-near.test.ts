// 277 Action time stage 3d-3 (AT47, AT63, AT67): an NPC at a long action in a fight runs the coming-near check each turn on
// what it perceives; when it fires it is asked for a new order next turn instead of carrying on. An agent-run NPC whose
// order covered only the first step of a stretch is told, on its next Planner call, how long time ran on meanwhile.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { busyCheck } from '../../src/engine/comingNear';
import { intent, play } from './w4-kit';
import { plannerActors } from '../../src/agents/game';
import { buildOppositionView } from '../../src/views';
import { DU } from '../../src/library/tableIds';
import { getLibrary } from '../../src/library';
import { IT } from '../../src/library/itemIds';
import type { Actor, GameEvent, GameState } from '../../src/types';

const quiet = () => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
const guard = (s: GameState) => s.actors.find((a) => a.id === 'guard_1')!;
/** the guard is bandaging himself, a long action (the busy state a fight turn leaves) */
const bandaging = (s: GameState, g: Actor, done: number, watch?: Record<string, never>) => {
  g.core.condition.hpLostPct = 30;
  g.core.inventory.push({ id: 'bd', itemId: IT.bandage, qty: 1 });
  g.busy = { row: DU.bandage, key: `${DU.bandage}|bd|`, order: { type: 'use_item', target: null, item: 'bd' }, done, need: getLibrary().durations![DU.bandage].seconds, turn: s.turn, ...(watch ? { watch } : {}) };
};

describe('277 NPCs and the coming-near check', () => {
  it('AT47/AT67: an NPC at a long action whose check fires (words to it, someone rushing at it) is asked again next turn; the alert is spent', () => {
    const s = makeVillage({ without: ['slime_1', 'slime_2'] });
    const field = s.zones.find((z) => z.id === 'field_far')!.rect!;
    const g = guard(s);
    place(s, 'player', 'field_far');
    place(s, 'guard_1', 'field_far');
    s.player.pos = { x: field.x - field.w / 2 + 1, y: field.y };
    g.pos = { x: s.player.pos.x + 25, y: field.y };
    g.mind!.control = 'agent';
    bandaging(s, g, 6);
    expect(busyCheck(s, g, new Map(), 3, [])).toBeNull(); // the first check starts its watch: everyone it perceives is accepted
    expect(Object.keys(g.busy!.watch!)).toContain('player');
    const words = { actorId: 'player', kind: 'speak', target: 'guard_1', line: { text: 'Hold still.', volume: 'normal' }, noise: 'normal', perception: { guard_1: { level: 'full', cue: 'sound', heard: true } } } as unknown as GameEvent;
    expect(busyCheck(s, g, new Map(), 3, [words])).toEqual({ why: 'contact', by: ['player'] });
    s.mode = 'tactical';
    s.pending = { ...s.pending, mode: 'tactical', engaged: ['guard_1'] };
    expect(plannerActors(s)).not.toContain('guard_1'); // at a long action: not asked (AT47)
    play(s, { intent: intent({ move: { toZone: 'field_far', spot: { near: 'guard_1' } } }) }); // the player runs at it: a change
    expect(s.log.find((l) => l.code === 'busy_alert')?.detail).toMatchObject({ actorId: 'guard_1', why: 'change', by: ['player'] });
    expect(g.busy?.alert).toBe(true);
    s.pending = { ...s.pending, engaged: ['guard_1'] };
    expect(plannerActors(s)).toContain('guard_1');
    s.mode = 'tactical';
    play(s, { intent: intent() });
    expect(g.busy?.alert).toBeUndefined();
  });
  it('AT67: an NPC at a long action that nothing disturbs carries on, its watch kept', () => {
    const s = quiet();
    const g = guard(s);
    bandaging(s, g, 0);
    s.mode = 'tactical';
    play(s, { intent: intent() });
    expect(g.busy?.watch).toBeDefined();
    expect(g.busy?.alert).toBeUndefined();
  });
  it('AT63: an agent-run NPC is told how long the player\'s rest ran on past its order', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
    const t = s.actors.find((a) => a.id === 'trader')!;
    t.mind!.control = 'agent';
    play(s, { intent: intent({ action: { type: 'rest' } }) });
    const minutes = buildOppositionView(s, 'trader').self.meanwhile?.minutes ?? 0;
    expect(minutes).toBeGreaterThan(50);
    expect(minutes).toBeLessThanOrEqual(60);
    expect(buildOppositionView(s, 'patron_1').self.meanwhile).toBeUndefined(); // run by code: nothing to tell
  });
});
