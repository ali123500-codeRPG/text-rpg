import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { GRADES } from '../../src/types';

describe('task grades (CR4, CR12)', () => {
  it('DIFFICULTY climbs past extreme to the supernatural rows, in order', () => {
    const v = Object.values(CONFIG.DIFFICULTY);
    expect(v).toEqual([...v].sort((a, b) => a - b));
    expect(Object.keys(CONFIG.DIFFICULTY).slice(GRADES.length)).toEqual(['mortal_limit', 'beyond', 'mythic', 'divine']);
  });
  it('the rows past extreme are task grades only: the Weaver, gains and locks keep none to extreme', () => {
    expect(Object.keys(CONFIG.DIFFICULTY).slice(0, GRADES.length)).toEqual([...GRADES]);
    expect(GRADES.at(-1)).toBe('extreme');
  });
});
