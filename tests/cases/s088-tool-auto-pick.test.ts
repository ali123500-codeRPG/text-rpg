import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { pickTool, ruleset } from '../../src/ruleset';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';

describe('88 Tool auto-pick', () => {
  it('uses the better of two lockpick kits; with both hands full the off-hand item is stowed', () => {
    const s = makeVillage();
    s.hidden.stage.challenge = 'minor'; // target 35
    s.blueprints.push({ storyId: 'test', id: 'fine_lockpicks', kind: 'item', data: {
      id: 'fine_lockpicks', kind: 'tool', name: 'fine lockpicks', look: 'fine picks', bulk: 0, value: 30, hands: 1,
      effects: [{ kind: 'skill', skill: SK.thievery, value: 35, active: 'inUse', scope: 'withItem' }] } });
    s.player.core.inventory.push({ id: 'lp1', itemId: IT.lockpicks }, { id: 'lp2', itemId: 'fine_lockpicks' });
    // sword and shield held: the shield (off hand) is stowed for free
    expect(pickTool(s, s.player, SK.thievery)).toEqual({ itemId: 'lp2', stowed: `player_${IT.round_shield}_2` });
    const before = JSON.stringify(s);
    const r = ruleset.check({ actorId: 'player', skill: SK.thievery, modifiers: [] }, s, createRng(1));
    expect(r.passed).toBe(true); // 0 + 35 ≥ 35; the plain kit (25) would fail
    expect(JSON.stringify(s)).toBe(before); // the check itself spends and changes nothing
    // a free hand: nothing stowed
    delete s.player.core.inventory.find((i) => i.id === `player_${IT.round_shield}_2`)!.equippedIn;
    expect(pickTool(s, s.player, SK.thievery)).toEqual({ itemId: 'lp2', stowed: null });
  });
});
