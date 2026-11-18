// PC1-PC2: cover from real objects. Furniture has a size; a piece hides what of the target lies below the sight line from
// the viewer's eye over its far edge; indoor zones keep no clutter level.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { zoneById } from '../../src/engine/relations';
import { FU, ZK } from '../../src/library/tableIds';
import { getLibrary } from '../../src/library';
import { CONFIG } from '../../src/config';
import { clutterCover, coverMod, coverShown } from '../../src/ruleset/gear';
import { objectHidden } from '../../src/ruleset/objectCover';

/** a 1.1 m counter in the middle of the field; a person 1 m past its far edge; a shooter 20 m off in the next zone */
function range(shooterFloorM = 0) {
  const s = makeVillage();
  const z = zoneById(s, 'field_mid')!, e = zoneById(s, 'field_edge')!;
  z.rect = { x: 0, y: 0, w: 10, d: 10 }; e.rect = { x: 0, y: -15, w: 10, d: 20 };
  z.height = 0; e.height = shooterFloorM;
  z.furniture = [{ id: 'field_mid.fu1', kind: FU.counter, name: 'counter' }];
  const t = place(s, 'guard_1', 'field_mid'); t.pos = { x: 0, y: 1.3 };
  place(s, 'player', 'field_edge'); s.player.pos = { x: 0, y: -18.7 };
  return { s, z, t };
}

describe('383 cover from objects (PC1, PC2)', () => {
  it('PC1: every furniture kind has a size; indoor zone kinds give no clutter cover', () => {
    const lib = getLibrary();
    for (const k of Object.values(lib.furnitureKinds!)) expect(k.sizeM, k.name).toHaveLength(3);
    expect(lib.zoneKinds![ZK.room].cover).toBe('none');
    expect(lib.zoneKinds![ZK.cellar].cover).toBe('none');
    const s = makeVillage();
    const inside = zoneById(s, 'tav_cellar')!;
    inside.cover = 'heavy';
    expect(clutterCover(inside)).toBe('none'); // walls and furniture give the cover indoors
    expect(clutterCover(zoneById(s, 'field_far')!)).toBe('some');
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
    t.pos = { x: 4, y: 1.3 }; // off to the side: the line passes the counter's end
    expect(objectHidden(s, t, z, s.player)).toBe(0);
    t.pos = { x: 0, y: 1.3 };
    s.player.pos = { x: 0, y: -1.5 }; zoneById(s, 'field_edge')!.rect = { x: 0, y: -3, w: 10, d: 4 }; // the counter close in front
    t.pos = { x: 0, y: 4.5 };
    expect(objectHidden(s, t, z, s.player)).toBe(0);
  });

  it('PC2: with nobody to hide from, a piece within OBJECT_COVER_M hides its own height; farther, nothing', () => {
    const { s, z, t } = range();
    expect(objectHidden(s, t, z)).toBeCloseTo(1.1 / 1.75); // 1 m past the counter's edge
    t.pos = { x: 0, y: 2.5 };
    expect(objectHidden(s, t, z)).toBe(0);
  });

  it('PC1: the larger of clutter and object cover counts, never both', () => {
    const { s, z, t } = range();
    z.cover = 'some'; // a person half hidden by clutter, 61% by the counter
    expect(coverShown(s, t, z, s.player)).toBeCloseTo(1 - 0.61, 2);
    z.cover = 'dense';
    expect(coverShown(s, t, z, s.player)).toBeCloseTo(0.125);
  });
});
