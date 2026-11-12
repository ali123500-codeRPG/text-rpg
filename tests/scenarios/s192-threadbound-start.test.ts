// 192 The Threadbound start (TB6, TB7): the Threadbounded class's level 1 perk gives a random Threadbound item, bound to
// the player and worn. A Threadbound item is the player's alone: nobody else can wear it, and the player can summon it
// from wherever it is, at any time (a free gear op).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { play, intent } from './w4-kit';
import { createPlayer, recommendedBuild, validateBuild } from '../../src/library/spawn';
import { applyGearOps } from '../../src/engine/gear';
import { buildPlayerView } from '../../src/views';
import { checkParserLegality } from '../../src/agents/legality';
import { CL } from '../../src/library/classIds';
import { IT } from '../../src/library/itemIds';
import { PK } from '../../src/library/perkIds';
import type { ItemInstance } from '../../src/types';

const loopOf = (inv: ItemInstance[]) => inv.find((i) => i.itemId === IT.gamblers_loop);

describe('192 the Threadbound start', () => {
  it('starts with What Was Always Yours and a Threadbound item, bound and worn', () => {
    makeVillage();
    const build = { ...recommendedBuild(CL.threadbounded), classId: CL.threadbounded };
    expect(validateBuild(build)).toEqual([]);
    const p = createPlayer(build, 's1');
    expect(p.core.perks.find((x) => x.perkId === PK.always_yours)?.granted).toBe(IT.gamblers_loop);
    const loop = loopOf(p.core.inventory)!;
    expect(loop).toMatchObject({ boundTo: 'player', equippedIn: ['acc:0'] });
  });

  it('gives nothing when every Threadbound item is already in the world, and only once', () => {
    const s = makeVillage();
    s.actors[0].core.inventory.push({ id: 'elsewhere', itemId: IT.gamblers_loop });
    s.player.core.perks.push({ perkId: PK.always_yours, source: 'class', gainedTurn: 0 });
    play(s, { intent: intent({}) });
    expect(loopOf(s.player.core.inventory)).toBeUndefined();
    s.actors[0].core.inventory = s.actors[0].core.inventory.filter((i) => i.id !== 'elsewhere');
    play(s, { intent: intent({}) });
    expect(loopOf(s.player.core.inventory)?.boundTo).toBe('player');
    s.player.core.inventory = s.player.core.inventory.filter((i) => i.itemId !== IT.gamblers_loop);
    play(s, { intent: intent({}) });
    expect(loopOf(s.player.core.inventory)).toBeUndefined(); // granted once
  });

  it('nobody else can wear it', () => {
    const s = makeVillage();
    const npc = s.actors[0];
    npc.core.inventory.push({ id: 'loop', itemId: IT.gamblers_loop });
    expect(applyGearOps(s, npc, [{ op: 'wear_acc', item: 'loop' }]).invalid).toHaveLength(1);
  });

  it('the player summons it from anyone or any ground, as a free gear op', () => {
    const s = makeVillage();
    const npc = s.actors[0];
    npc.core.inventory.push({ id: 'loop', itemId: IT.gamblers_loop, boundTo: 'player' });
    const pv = buildPlayerView(s);
    expect(pv.player.summonable).toEqual([{ id: 'loop', name: "Gambler's Loop" }]);
    expect(checkParserLegality({ ...intent({}), gear: [{ op: 'summon', item: 'loop' }] } as never, pv).gearErrors).toEqual([]);
    const ev = play(s, { intent: { ...intent({}), gear: [{ op: 'summon', item: 'loop' }] } as never });
    expect(loopOf(s.player.core.inventory)).toBeDefined();
    expect(loopOf(npc.core.inventory)).toBeUndefined();
    expect(ev.some((e) => e.kind === 'summon' && e.actorId === 'player')).toBe(true);
    // from the ground of another place
    const far = s.places.at(-1)!.zones.at(-1)!;
    far.groundItems.push(s.player.core.inventory.splice(s.player.core.inventory.findIndex((i) => i.id === 'loop'), 1)[0]);
    expect(applyGearOps(s, s.player, [{ op: 'summon', item: 'loop' }]).summoned).toEqual(['loop']);
    // an item bound to no one, or someone else's, cannot be summoned
    npc.core.inventory.push({ id: 'plain', itemId: IT.signet_ring });
    expect(applyGearOps(s, s.player, [{ op: 'summon', item: 'plain' }]).invalid).toHaveLength(1);
  });
});
