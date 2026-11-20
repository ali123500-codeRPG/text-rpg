// YB1: a tagged skill starts CREATION_TAG_BONUS above the points spent on it, on top of the CREATION_MAX_TAGGED cap; the
// points spent, the cap and the class floors still count points.
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { createPlayer, recommendedBuild, validateBuild } from '../../src/library/spawn';

describe('YB1: tagged skills start above their points', () => {
  it('a tagged skill bought to the cap starts at cap + bonus; untagged and flawed skills start at their points', () => {
    const b = recommendedBuild();
    expect(validateBuild(b)).toEqual([]);
    const p = createPlayer(b, 's1');
    const capped = b.tagged.find((k) => b.skills[k] === CONFIG.CREATION_MAX_TAGGED)!;
    expect(p.core.skills[capped].raw).toBe(CONFIG.CREATION_MAX_TAGGED + CONFIG.CREATION_TAG_BONUS);
    for (const k of b.tagged) expect(p.core.skills[k]).toEqual({ raw: (b.skills[k] ?? 0) + CONFIG.CREATION_TAG_BONUS, state: 'tagged' });
    for (const k of Object.keys(b.skills).filter((k) => !b.tagged.includes(k))) expect(p.core.skills[k]?.raw ?? 0).toBe(b.skills[k]);
  });
});
