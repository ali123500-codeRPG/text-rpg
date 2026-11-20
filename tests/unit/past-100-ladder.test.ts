import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { PAST_100, RANK_KEY_PAST_100 } from '../../src/scales';

const ladder = PAST_100.map(([k]) => k);

describe('one ladder past 100 for task grades, NPC ranks and equip levels', () => {
  it('each step is the same number everywhere, and so is the step past Divine', () => {
    for (const k of ladder) {
      expect(CONFIG.EQUIP_NEED[k]).toBe(CONFIG.DIFFICULTY[k]);
      expect(CONFIG.RANK_ROWS[RANK_KEY_PAST_100[k]].anchor).toBe(CONFIG.DIFFICULTY[k]);
    }
    expect(CONFIG.RANK_BEYOND_STEP.anchor).toBe(CONFIG.EQUIP_BEYOND_STEP);
  });
});
