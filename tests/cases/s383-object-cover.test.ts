// PC1-PC2: cover from real objects. Furniture has a size; a piece hides what of the target lies below the sight line from
// the viewer's eye over its far edge; indoor zones keep no clutter level.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { zoneById } from '../../src/engine/relations';
import { FU, LC } from '../../src/library/tableIds';
import { makeFurniture } from '../../src/engine/furniture';
import { landUnder } from '../harness';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import { clutterCover, coverMod, coverShown } from '../../src/ruleset/gear';
import { objectHidden } from '../../src/ruleset/objectCover';

/** a 1.1 m counter in the middle of a 10 m field; a person 1 m past its far edge; a shooter 20 m off in the next title
 * (all OX metres east of the village, clear of its other titles) */
const OX = 400;
function range(shooterFloorM = 0) {
  const s = makeVillage({ shape: {
    field_mid: { rect: { x: OX, y: 0, w: 10, d: 10 }, floor: 0 },
    field_edge: { rect: { x: OX, y: -15, w: 10, d: 20 }, floor: shooterFloorM },
  } });
  const z = zoneById(s, 'field_mid')!;
  s.furniture = s.furniture.filter((f) => f.zone !== z.id).concat(makeFurniture(s, z, [{ kind: FU.counter, name: 'counter' }]));
  const t = place(s, 'guard_1', 'field_mid'); t.pos = { x: OX, y: 1.3 };
  place(s, 'player', 'field_edge'); s.player.pos = { x: OX, y: -18.7 };
  return { s, z, t };
}

describe('383 cover from objects (PC1, PC2)', () => {
  it('PC1, PZ6: every furniture kind has a size; under a roof there is no clutter cover, outdoors the land\'s', () => {
    const lib = getLibrary();
    for (const k of Object.values(lib.furnitureKinds!)) expect(k.sizeM, k.name).toHaveLength(3);
    const s = makeVillage();
    const inside = zoneById(s, 'tav_cellar')!, far = zoneById(s, 'field_far')!;
    landUnder(s, [...inside.outline, ...far.outline], LC.woods);
    expect(clutterCover(s, inside)).toBe('none'); // walls and furniture give the cover indoors
    expect(clutterCover(s, far)).toBe('heavy');
  });

  it('PC2: the sight line over the counter decides; from higher up it hides less (the hub examples)', () => {
    expect(CONFIG.EYE_SHARE).toBe(0.94);
    const cases: [number, number, number][] = [[0, 0.61, 14], [4, 0.49, 10], [8, 0.37, 7]];
    for (const [floor, hid, mod] of cases) {
      const { s, z, t } = range(floor);
      expect(objectHidden(s, t, z, s.player)).toBeCloseTo(hid, 2);
      expect(coverMod(coverShown(s, t, z, s.player))).toBe(mod);
    }
  });

  it('PC2: a piece the line misses, or one right in front of the shooter, hides nothing', () => {
    const { s, z, t } = range();
    t.pos = { x: OX + 4, y: 1.3 }; // off to the side: the line passes the counter's end
    expect(objectHidden(s, t, z, s.player)).toBe(0);
    place(s, 'player', 'field_mid'); s.player.pos = { x: OX, y: -1.5 }; // the counter close in front
    t.pos = { x: OX, y: 4.5 };
    expect(objectHidden(s, t, z, s.player)).toBe(0);
  });

  it('PC2: with nobody to hide from, a piece within OBJECT_COVER_M hides its own height; farther, nothing', () => {
    const { s, z, t } = range();
    expect(objectHidden(s, t, z)).toBeCloseTo(1.1 / 1.75); // 1 m past the counter's edge
    t.pos = { x: OX, y: 2.5 };
    expect(objectHidden(s, t, z)).toBe(0);
  });

  it('PC1: the larger of clutter and object cover counts, never both', () => {
    const { s, z, t } = range();
    landUnder(s, z.outline, LC.marsh); // a person half hidden by reeds, 61% by the counter
    expect(coverShown(s, t, z, s.player)).toBeCloseTo(1 - 0.61, 2);
    landUnder(s, z.outline, LC.woods); // three quarters hidden by trees
    expect(coverShown(s, t, z, s.player)).toBeCloseTo(0.25);
  });
});
