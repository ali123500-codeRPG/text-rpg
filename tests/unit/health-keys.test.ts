// CS1: health levels and body-part states are keyed scales. Code compares keys or positions; display names live only
// in scales.ts, so renaming a level edits one table.
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { HEALTH_LEVELS } from '../../src/scales';

describe('health levels and part states by key', () => {
  it('the health track has one row per health level, in the scale order', () => {
    expect(CONFIG.HEALTH_TRACK.map(([l]) => l)).toEqual(HEALTH_LEVELS.keys);
  });
});
