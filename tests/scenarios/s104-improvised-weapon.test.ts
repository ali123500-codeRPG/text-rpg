// 104 Improvised weapon (loot L3): the player fights with a scene object that isn't in the view. Code mints it
// as a story item on its improvised base (hit IMPROVISED_HIT_ADJ, no kit bonus), draws it and attacks with it.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { place } from '../harness/village';
import { resolveTurn } from '../../src/engine';
import { itemDef } from '../../src/library';
import { CONFIG } from '../../src/config';
import type { Intent } from '../../src/types';

describe('104 Improvised weapon', () => {
  it('a chair leg becomes a held improvised_medium story item used for the attack', () => {
    const s = makeVillage({ playerZone: 'field_mid' });
    place(s, 'slime_1', 'field_mid');
    const intent: Intent = {
      move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
      action: { type: 'attack', skill: 'melee_medium', target: 'slime_1', targetPart: null, item: null, mode: null, approach: '', stance: 'normal',
        improvised: { base: 'improvised_medium', name: 'a broken chair leg' } },
    };
    const events = resolveTurn(s, { intent, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(7));
    const inst = s.player.core.inventory.find((i) => i.itemId.startsWith('improvised_medium_i'))!;
    expect(inst.equippedIn?.length).toBe(1);
    const def = itemDef(s, inst.itemId);
    expect(def.name).toBe('a broken chair leg');
    expect(def.weapon!.modes[0].hitAdj).toBe(CONFIG.IMPROVISED_HIT_ADJ);
    expect(def.effects ?? []).toEqual([]);
    expect(events.find((e) => e.kind === 'attack' && e.actorId === s.player.id)?.attack?.weaponId).toBe(inst.id);
  });
});
