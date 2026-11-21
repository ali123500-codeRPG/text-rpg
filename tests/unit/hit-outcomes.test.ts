// CS7: one hit-outcomes table, and the shared checks every place reads instead of its own list.
import { describe, expect, it } from 'vitest';
import { HIT_OUTCOMES } from '../../src/scales';
import { met, struck } from '../../src/ruleset/hits';

const pick = (f: (o: (typeof HIT_OUTCOMES.keys)[number]) => boolean) => HIT_OUTCOMES.keys.filter(f);

describe('hit outcomes', () => {
  it('struck: the blow reached the body; met: the body or a shield (a block counts, a parry does not)', () => {
    expect(pick(struck)).toEqual(['grazed', 'full_hit', 'heavy_hit', 'crushing_hit']);
    expect(pick(met)).toEqual(['blocked', 'grazed', 'full_hit', 'heavy_hit', 'crushing_hit']);
  });
});
