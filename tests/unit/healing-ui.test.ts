// Healing displays (H1 d / H2 a / H3 b): the turn's notes survive the log reset, and the quick slot
// shows the player's pick, else the strongest healing item (ties: the one carried most).
import { IT } from '../../src/library/itemIds';
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { turnNotes } from '../../src/agents/game';
import { healItems, quickHeal } from '../../src/ui/healing';
import { SK } from '../../src/library/skillIds';

describe('healing displays', () => {
  it('turn notes keep the player’s healing, skill gains and milestones', () => {
    const s = makeVillage();
    s.log.push(
      { turn: s.turn, code: 'healed', detail: { actorId: s.player.id, source: 'bandage', from: 'Hurt', to: 'Bruised', parts: [] } },
      { turn: s.turn, code: 'healed', detail: { actorId: 'someone_else', source: 'bandage', from: 'Hurt', to: 'Bruised', parts: [] } },
      { turn: s.turn, code: 'skill_improved', detail: { skill: SK.block, from: 38, to: 40, milestone: 40 } },
      { turn: s.turn - 1, code: 'skill_improved', detail: { skill: SK.dodge, from: 10, to: 12 } },
    );
    expect(turnNotes(s)).toEqual({
      heals: [{ source: 'bandage', from: 'Hurt', to: 'Bruised', parts: [] }],
      unlocks: [{ skill: SK.block, milestone: 40 }], gains: { [SK.block]: 2 },
    });
  });
  it('quick slot: strongest first, ties to the most carried, the player’s pick wins', () => {
    const s = makeVillage();
    const inv = s.player.core.inventory;
    inv.splice(0, inv.length);
    expect(quickHeal(s, s.player)).toBeNull();
    const salve = (id: string, heal: string) => s.blueprints.push({ storyId: 'test', id, kind: 'item', data: { id, kind: 'consumable', name: id, look: id, bulk: 0, value: 1, stackable: true, consumable: true, heal } });
    salve('wrap', 'bandage');
    salve('tonic', 'clinic');
    inv.push({ id: 'b1', itemId: IT.bandage, qty: 1 }, { id: 'w1', itemId: 'wrap', qty: 3 });
    expect(healItems(s, s.player).map((x) => [x.itemId, x.count])).toEqual([['wrap', 3], [IT.bandage, 1]]);
    inv.push({ id: 't1', itemId: 'tonic', qty: 1 });
    expect(quickHeal(s, s.player)?.itemId).toBe('tonic');
    s.player.progression!.quickHeal = IT.bandage;
    expect(quickHeal(s, s.player)?.itemId).toBe(IT.bandage);
    inv.splice(inv.findIndex((i) => i.itemId === IT.bandage), 1);
    expect(quickHeal(s, s.player)?.itemId).toBe('tonic');
  });
});
