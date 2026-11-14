// BG-211: a stash is a hushed sound and a low-visibility sight (SE9); a comment swallowed its entry, so it was quiet and plain to see.
import { describe, expect, it } from 'vitest';
import { IT } from '../../src/library/itemIds';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';

describe('291 A stash is hushed', () => {
  it('BG-211: the stash event is hushed and low-visibility', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    s.player.core.inventory.push({ id: 'purse_1', itemId: IT.dagger });
    play(s, { intent: intent({ action: { type: 'stash', item: 'purse_1' } }) });
    const ev = s.events.find((e) => e.kind === 'stash')!;
    expect([ev.noise, ev.visibility]).toEqual(['hushed', 'low']);
  });
});
