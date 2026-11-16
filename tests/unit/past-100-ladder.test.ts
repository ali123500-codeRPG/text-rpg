import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { EQUIP_LEVELS, GRADE_LEVELS, PAST_100, RANKS, RANK_KEY_PAST_100 } from '../../src/scales';

const ladder = PAST_100.map(([k]) => k);
const tail = <K extends string>(keys: readonly K[]) => keys.slice(-ladder.length);

describe('one ladder past 100 for task grades, NPC ranks and equip levels', () => {
  it('each scale ends in the shared rows, same order, same names', () => {
    expect(tail(GRADE_LEVELS.keys)).toEqual(ladder);
    expect(tail(EQUIP_LEVELS.keys)).toEqual(ladder);
    expect(tail(RANKS.keys)).toEqual(ladder.map((k) => RANK_KEY_PAST_100[k]));
    for (const [k, n] of PAST_100) {
      expect([GRADE_LEVELS.name(k), EQUIP_LEVELS.name(k), RANKS.name(RANK_KEY_PAST_100[k])]).toEqual([n, n, n]);
    }
  });
  it('each step is the same number everywhere, and so is the step past Divine', () => {
    for (const k of ladder) {
      expect(CONFIG.EQUIP_NEED[k]).toBe(CONFIG.DIFFICULTY[k]);
      expect(CONFIG.RANK_ROWS[RANK_KEY_PAST_100[k]].anchor).toBe(CONFIG.DIFFICULTY[k]);
    }
    expect(CONFIG.RANK_BEYOND_STEP.anchor).toBe(CONFIG.EQUIP_BEYOND_STEP);
  });
});
