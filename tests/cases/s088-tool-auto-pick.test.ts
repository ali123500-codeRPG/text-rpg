import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { effectiveSkill, pickTool } from '../../src/ruleset';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';

describe('88 Tool auto-pick', () => {
  it('uses the better of two lockpick kits; with both hands full the off-hand item is stowed', () => {
    const s = makeVillage();
    s.hidden.stage.challenge = 'minor'; // target 35
    s.blueprints.push({ storyId: 'test', id: 'fine_lockpicks', kind: 'item', data: {
      id: 'fine_lockpicks', kind: 'tool', name: 'fine lockpicks', look: 'fine picks', bulk: 0, value: 30, grips: 1,
      effects: [{ kind: 'skill', skill: SK.filching, value: 35, active: 'inUse', scope: 'withItem' }] } });
    s.player.core.inventory.push({ id: 'lp1', itemId: IT.lockpicks }, { id: 'lp2', itemId: 'fine_lockpicks' });
    // sword and shield held: the shield (off hand) is stowed for free
    expect(pickTool(s, s.player, SK.filching)).toEqual({ itemId: 'lp2', stowed: `player_${IT.round_shield}_2` });
    const before = JSON.stringify(s);
    expect(effectiveSkill(s, s.player, SK.filching, { itemId: 'lp2' }).value).toBe(35); // the fine kit's 35; the plain kit gives 25
    expect(JSON.stringify(s)).toBe(before); // choosing the tool spends and changes nothing
    // a free hand: nothing stowed
    delete s.player.core.inventory.find((i) => i.id === `player_${IT.round_shield}_2`)!.equippedIn;
    expect(pickTool(s, s.player, SK.filching)).toEqual({ itemId: 'lp2', stowed: null });
  });
});
