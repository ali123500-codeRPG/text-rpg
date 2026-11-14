// 208 NW3, NW8: NPCs and unbuilt frontiers. An NPC that walks into a frontier waits at its edge with its move spent. If
// the player crosses that frontier the same turn, it follows them through, after them (NW8, settles OQ-13). Otherwise
// its wait starts the same background Weaver build the player's frontiers get (at most NPC_BUILDS_PER_TURN a turn); once
// back, the ground is put on the stage without moving the player, and the NPC steps in on its next move. Built is not
// seen: the player's Map shows it only once they see it (S6).
import { describe, expect, it, vi } from 'vitest';
import type { GameState, Intent, StagePlan, WeaverView } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { ScenarioDirector } from '../../src/scenario';
import { grovePlan, VirtualClock } from '../../src/scenario/fixtures';
import { buildActorView } from '../../src/views';
import { headTo, routineOrder } from '../../src/minds';
import { zoneById } from '../../src/engine/relations';
import { ZK } from '../../src/library/tableIds';

const idle: Intent = { move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null };
const go = (to: string): Intent => ({ ...idle, move: { toZone: to } });
const turn = (s: GameState, intent: Intent = idle) => { s.turn += 1; return resolveTurn(s, { intent, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };
const village = (playerZone: string) => makeVillage({ playerZone, without: ['slime_1', 'slime_2', 'patron_1'] });
/** the guard stands at the field's far edge, heading into the woods */
const guardToWoods = (s: GameState) => {
  const g = s.actors.find((a) => a.id === 'guard_1')!;
  g.zone = 'field_far'; g.placeId = 'field'; delete g.pos;
  headTo(s, g, 'woods');
  return g;
};
const flush = () => new Promise((r) => setTimeout(r, 0)); // every pending background step settles

describe('208 NPCs and unbuilt frontiers (NW3, NW8)', () => {
  it('NW3: an NPC walking into an unbuilt frontier waits at the edge, its move spent', () => {
    const s = village('tav_cellar');
    const g = guardToWoods(s);
    expect(routineOrder(buildActorView(s, g.id))).toMatchObject({ type: 'move', target: 'woods' });
    turn(s);
    expect(g.zone).toBe('field_far');
    expect(s.scratch?.frontierWaits).toEqual([{ actorId: g.id, frontier: 'woods' }]);
    expect(s.log.some((l) => l.code === 'frontier_wait')).toBe(true);
  });
  it('NW3: its wait starts one background build there; once back it goes on the stage, the player stays put, and the NPC walks in', async () => {
    const s = village('tav_cellar');
    const g = guardToWoods(s);
    turn(s);
    const weave = vi.fn(async (_v: WeaverView) => grovePlan());
    const d = new ScenarioDirector({ weave, clock: new VirtualClock() });
    expect(d.afterSave(s)).toEqual(['woods']);
    expect(weave.mock.calls[0][0].target).toMatchObject({ kind: 'frontier', frontierKey: 'woods', placeId: 'field', ahead: true });
    await flush();
    expect(d.applyBuiltAhead(s, createRng(1))).toEqual(['woods']);
    const grove = s.zones.find((z) => z.name === 'a grove')!;
    expect(s.stage.zoneIds).toContain(grove.id);
    expect(s.player.zone).toBe('tav_cellar');
    expect(zoneById(s, 'field_far')!.links.find((l) => l.to === grove.id)!.frontier).toBeUndefined();
    expect(g.mind!.slots!.dest).toBe(grove.id); // its head_to now names the zone beyond
    turn(s);
    // it steps in and arrives; with the rest of the minute it heads back toward its post (NW11)
    expect(s.log.some((l) => l.code === 'head_to_arrived' && l.detail?.zone === grove.id)).toBe(true);
    // S6: built is not seen
    expect(s.player.journal!.zonesSeen).toContain('tav_cellar');
    expect(s.player.journal!.zonesSeen).not.toContain(grove.id);
  });
  it('NW3: at most NPC_BUILDS_PER_TURN a turn; a frontier already held starts nothing new', async () => {
    const s = village('tav_cellar');
    zoneById(s, 'gate_inner')!.links.push({ to: 'east_road', label: 'the east road', sight: true, frontier: true });
    const g = guardToWoods(s);
    const t = s.actors.find((a) => a.id === 'trader')!;
    t.zone = 'gate_inner'; t.placeId = 'gate'; delete t.pos;
    headTo(s, t, 'east_road');
    turn(s);
    expect((s.scratch?.frontierWaits as unknown[]).length).toBe(2);
    const weave = vi.fn(async (_v: WeaverView) => null as StagePlan | null);
    const d = new ScenarioDirector({ weave, clock: new VirtualClock() });
    expect(d.afterSave(s)).toHaveLength(1);
    turn(s);
    expect(d.afterSave(s)).toHaveLength(1); // the other one now
    expect(weave).toHaveBeenCalledTimes(2);
    turn(s);
    expect(d.afterSave(s)).toEqual([]);
    expect(g.zone).toBe('field_far');
  });
  it('NW8: an NPC moving into the frontier the player crosses that turn follows them through, after them', async () => {
    const s = village('field_far');
    const g = guardToWoods(s);
    turn(s, go('woods'));
    expect(s.scratch?.frontierCrossed).toBe('woods');
    const d = new ScenarioDirector({ weave: async () => grovePlan(), clock: new VirtualClock() });
    await d.cross(s, 'woods', createRng(1));
    expect(s.player.zone).not.toBe('field_far');
    expect(g.zone).toBe(s.player.zone);
  });
  it('NW3: the player reaching a frontier whose build an NPC started crosses into it as usual', async () => {
    const s = village('field_far');
    guardToWoods(s);
    turn(s);
    const weave = vi.fn(async (_v: WeaverView) => grovePlan());
    const d = new ScenarioDirector({ weave, clock: new VirtualClock() });
    d.afterSave(s);
    expect(weave).toHaveBeenCalledTimes(1);
    await d.cross(s, 'woods', createRng(1));
    expect(weave).toHaveBeenCalledTimes(1); // the NPC's build is reused
    expect(zoneById(s, s.player.zone)!.name).toBe('a grove');
    expect(d.applyBuiltAhead(s, createRng(1))).toEqual([]);
  });
  it('NW4 still holds for builds ahead: the grove leads on', () => {
    expect(grovePlan().zones[0].kind).toBe(ZK.woods);
    expect(grovePlan().zones[0].links.length).toBeGreaterThan(1);
  });
});
