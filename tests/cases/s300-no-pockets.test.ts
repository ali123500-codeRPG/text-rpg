// 300 (a Play comment reversing PO1-PO3): there are no pockets. Everything carried outside a container (in
// the worn pack, or loose) is as quick to reach as drawing a weapon, in a fight too. Only taking something out of a
// container one carries (a sack) takes the from_pack row ("Get something out of a container").
import { expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { zoneById } from '../../src/engine/relations';
import { findContainer } from '../../src/engine/containers';
import { IT } from '../../src/library/itemIds';

const village = (): GameState => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
const packed = (s: GameState) => { // a worn pack
  if (!s.player.core.inventory.some((i) => i.equippedIn?.includes('pack'))) s.player.core.inventory.push({ id: 'player_pack', itemId: IT.pack, equippedIn: ['pack'] });
  return findContainer(s, s.player.core.inventory.find((i) => i.equippedIn?.includes('pack'))!.id)!;
};

it('in a fight, a draught in the pack is drunk at once, as out of one', () => {
  for (const mode of ['tactical', 'explore'] as const) {
    const s = village();
    packed(s);
    s.mode = mode;
    s.player.core.condition.hpLostPct = 30;
    s.player.core.inventory.push({ id: 'vial', itemId: IT.healing_draught, qty: 1 });
    const ev = play(s, { intent: intent({ action: { type: 'use_item', item: 'vial' } }) });
    expect({ mode, used: ev.some((e) => e.kind === 'use_item'), busy: !!s.player.busy }).toEqual({ mode, used: true, busy: false });
  }
});
