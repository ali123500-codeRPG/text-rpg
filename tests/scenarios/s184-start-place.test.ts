// 184 BG-32: the story starts at a bare place node (ensurePlace); the Weaver's place of the same key fills it in
// instead of becoming a second place ("tavern" plus "tavern_2" named The Crossed Keys in playtest run 40).
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { TIERS } from '../../src/scales';
import { SceneDirector } from '../../src/scene';
import { toStoryStart, villageStagePlan, VirtualClock } from '../../src/scene/fixtures';

describe('184 the story-start place is never doubled (BG-32)', () => {
  it('the plan\'s place with the start key fills in the bare node', async () => {
    const s = toStoryStart(makeVillage());
    const d = new SceneDirector({ weave: async (view) => villageStagePlan(TIERS.keyOf(view.tier)!), clock: new VirtualClock() });
    expect((await d.storyStart(s, createRng(s.rngState))).outcome).toBe('applied');
    const taverns = s.places.filter((p) => p.id.startsWith('tavern'));
    expect(taverns.map((p) => p.id)).toEqual(['tavern']);
    expect(taverns[0]).toMatchObject({ names: { current: 'The Crooked Kettle' }, parentId: 'village' });
    expect(taverns[0].bare).toBeUndefined();
    expect(taverns[0].zones.length).toBeGreaterThan(0);
    expect(s.player.placeId).toBe('tavern');
  });
});
