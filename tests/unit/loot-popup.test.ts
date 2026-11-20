// The loot pop-up lists what the character can see to take where they stand (a body that is down, an open chest, the
// ground).
import { describe, expect, it } from 'vitest';
import { wholeTurn } from '../harness/turn';
import { intent } from '../cases/w4-kit';
import { buildPlayerView } from '../../src/views';
import { lootCount, lootGear, lootOrder, lootSources } from '../../src/ui/loot';
import { actorById, zoneById } from '../../src/engine/relations';
import { newInstanceId } from '../../src/library/spawn';
import { IT } from '../../src/library/itemIds';
import type { GameState } from '../../src/types';
import { layAll } from '../harness';


/** a patron down beside the player with what a search turned up, an open chest and a sack on the ground */
function lootHere(s: GameState) {
  const p = s.player, npc = actorById(s, 'patron_1')!;
  npc.zone = p.zone; npc.placeId = p.placeId; npc.core.condition.hpLostPct = 100;
  const add = (itemId: string) => { const it = { id: newInstanceId(), itemId, qty: 1 }; npc.core.inventory.push(it); return it; };
  const found = [add(IT.bandage), add(IT.key)];
  p.journal = { ...p.journal!, revealed: [...(p.journal?.revealed ?? []), ...found.map((i) => `item:${i.id}`)] };
  layAll(s, p.zone, { id: 'chest_1', itemId: IT.chest, open: true, contents: [{ id: 'picks_1', itemId: IT.lockpicks }] }, { id: 'sack_1', itemId: IT.sack });
  return { found, npc };
}

describe('loot pop-up', () => {
  it('after a whole turn, lists the body\'s found things, the open chest and the ground, never the fixed chest itself', async () => {
    const g = wholeTurn();
    const { found } = lootHere(g.state);
    await g.turn(intent({ action: { type: 'wait' } } as never));
    const srcs = lootSources(buildPlayerView(g.game.state()!));
    const body = srcs.find((x) => x.kind === 'body')!;
    for (const f of found) expect(body.items.map((i) => i.id)).toContain(f.id);
    expect(srcs.find((x) => x.kind === 'container')?.items.map((i) => i.id)).toEqual(['picks_1']);
    expect(srcs.find((x) => x.kind === 'ground')?.items.map((i) => i.id)).toEqual(['sack_1']);
    expect(lootCount(srcs)).toBe(srcs.reduce((n, x) => n + x.items.length, 0));
  });

  it('one order for the picks, one phrase per place they come from', async () => {
    const g = wholeTurn();
    const { found } = lootHere(g.state);
    const srcs = lootSources(buildPlayerView(g.state));
    const from = srcs.find((x) => x.kind === 'body')!.from;
    expect(lootOrder(srcs, new Set([found[0].id, found[1].id]))).toBe(`Take the bandage and the key from ${from}`);
    expect(lootOrder(srcs, new Set([found[1].id, 'picks_1', 'sack_1']))).toBe(`Take the key from ${from}, take the lockpicks from the chest and pick up the sack`);
    expect(lootOrder(srcs, new Set())).toBe('');
    // AD7: the same pick as gear orders; a body's things come from that body
    const bodyKey = srcs.find((x) => x.kind === 'body')!.key;
    expect(lootGear(srcs, new Set([found[1].id, 'sack_1']))).toEqual([{ op: 'pick_up', item: found[1].id, from: bodyKey }, { op: 'pick_up', item: 'sack_1' }]);
  });

  it('a standing person\'s gear is not loot', () => {
    const g = wholeTurn();
    const npc = actorById(g.state, 'patron_1')!;
    npc.zone = g.state.player.zone; npc.placeId = g.state.player.placeId;
    expect(lootSources(buildPlayerView(g.state)).some((x) => x.kind === 'body')).toBe(false);
  });

});
