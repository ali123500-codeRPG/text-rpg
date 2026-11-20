// 283 BG-199 (BF24): the lean man broke under Happi's shot, which counts as yielding to her: the game paid defeat XP
// and offered his essence, but nothing on screen said he gave up, his chip went back to Panicking, and the XP row said
// only "+N". Now the turn says who yielded, the chip says Broken or Surrendered while it lasts, every XP award names
// its source, and an essence comes only from a death, never a defeat.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { actor } from '../harness/village';
import { payDefeats } from '../../src/engine/xp';
import { offersFromDefeats } from '../../src/engine/essence';
import { createRng } from '../../src/rng';
import type { GameState } from '../../src/types';

/** slime_1 beside the player, fought, then broken: up, with the yielded stance toward the player */
function broken(s: GameState) {
  place(s, 'slime_1', s.player.zone);
  const a = actor(s, 'slime_1');
  a.core.generation = 'rolled'; // notable: an essence could come from it
  a.mind!.hitByPlayer = true;
  a.mind!.moraleState = 'broken'; a.mind!.overrides = { player: 'yielded' };
  return a;
}

describe('283 yield line and XP sources (BG-199)', () => {
  it('no essence from a defeat; one may come once the beaten foe dies', () => {
    const s = makeVillage();
    const a = broken(s);
    const defeated = payDefeats(s, []);
    offersFromDefeats(s, defeated, createRng(1));
    expect(s.log.some((l) => l.code === 'essence_appeared')).toBe(false);
    expect(a.mind!.essenceRolled).toBeFalsy();
    a.core.condition.hpLostPct = 200; // dies of its wounds, or a later blow
    offersFromDefeats(s, payDefeats(s, []), createRng(1));
    expect(a.mind!.essenceRolled).toBe(true);
  });
});
