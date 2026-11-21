// BG-312: a doorway holds a real door (shut, unlocked) unless it is doorless; sight and sound follow what stands in it, never a
// fixed see-through flag. A doorless doorway (an open hall, a curtain) is seen and heard through like a gap.
import { describe, expect, it } from 'vitest';
import type { TilePage, TitleSpec } from '../../src/types';
import { CONFIG } from '../../src/config';
import { drawTitles } from '../../src/plan/draw';
import { lineClear, lineLoss } from '../../src/plan/line';
import { makeVillage } from '../harness';
import { BK, OP } from '../../src/library/tableIds';
import { MIGRATIONS } from '../../src/save/checks';
import { toPages } from '../../src/save/pages';

const rooms = (doorless?: true): TitleSpec[] => [0, 1].map((i) => ({ id: `r${i}`, placeId: 'tavern', name: `room ${i}`, look: '', roof: true, light: 'bright',
  rect: { x: 100 + 5 * i, y: 100, w: 5, d: 4 }, ways: i ? [] : [{ to: 'r1', label: 'next door', kind: 'door' as const, ...(doorless ? { doorless } : {}) }] }));
const A = { x: 102, y: 100, z: 1.6 }, B = { x: 103, y: 100, z: 1.6 }; // either side of the doorway (a rect's x, y is its middle)

describe('404 doorways hold real doors (BG-312)', () => {
  it('a drawn doorway holds a plain door: shut it muffles and hides, open it does neither', () => {
    const s = makeVillage();
    drawTitles(s, rooms());
    const o = s.openings.find((x) => x.joins.includes('r0') && x.joins.includes('r1'))!;
    expect(o.kind).toBe(OP.doorway);
    const door = s.barriers![o.barrier!];
    expect(door).toMatchObject({ kind: BK.door, grade: 'minor' });
    expect(door.lock).toBeUndefined();
    expect(lineLoss(s, A, B)).toBe(30);
    expect(lineClear(s, A, B)).toBe(false);
    door.open = true;
    expect(lineLoss(s, A, B)).toBe(0);
    expect(lineClear(s, A, B)).toBe(true);
  });

  it('a doorless doorway is seen and heard through like a gap', () => {
    const s = makeVillage();
    drawTitles(s, rooms(true));
    const o = s.openings.find((x) => x.joins.includes('r0') && x.joins.includes('r1'))!;
    expect(o).toMatchObject({ kind: OP.doorway });
    expect(o.barrier).toBeUndefined();
    expect(lineLoss(s, A, B)).toBe(0);
    expect(lineClear(s, A, B)).toBe(true);
  });

  it('a v10 save: a doorway its old flag kept shut gets the door it stood for; the flag goes; at v13 the floor plan and the ground move to tiles, every record kept (WT1 a)', () => {
    const s = makeVillage();
    const o = s.openings.find((x) => x.joins.includes('street_door') && x.joins.includes('tav_common'))!;
    delete s.barriers![o.barrier!];
    delete o.barrier;
    Object.assign(o, { seeThrough: false });
    const pages = toPages(s);
    // the v10 to v12 layout: one plan page per place and one ground page
    for (const k of Object.keys(pages)) if (k.startsWith('tile.')) delete pages[k];
    for (const pl of s.places) pages[`plan.${pl.id}`] = { storyId: s.storyId, placeId: pl.id,
      ...Object.fromEntries((['walls', 'openings', 'roofs', 'lights', 'furniture'] as const).map((l) => [l, structuredClone(s[l].filter((x) => x.placeId === pl.id))])) };
    pages.ground = { storyId: s.storyId, items: [{ id: 'gi1', itemId: 'any', at: { x: 150, y: -20, floor: 0 } }] };
    for (const v of [10, 11, 12]) MIGRATIONS[v](pages);
    expect(Object.keys(pages).filter((k) => k.startsWith('plan.') || k === 'ground')).toEqual([]);
    const tiles = Object.entries(pages).filter(([k]) => k.startsWith('tile.')).map(([, t]) => t as TilePage);
    const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort();
    for (const l of ['walls', 'openings', 'roofs', 'lights'] as const) expect(ids(tiles.flatMap((t) => t[l] as { id: string }[]))).toEqual(ids(s[l]));
    expect(tiles.find((t) => t.items.some((i) => i.id === 'gi1'))).toMatchObject({ tx: 1, ty: -1, size: CONFIG.TILE_SIZE_M });
    const after = tiles.flatMap((t) => t.openings).find((x) => x.id === o.id)! as typeof o & { seeThrough?: boolean };
    expect(after.seeThrough).toBeUndefined();
    expect((pages.engine as { barriers: Record<string, { kind: string }> }).barriers[after.barrier!]).toMatchObject({ kind: BK.door });
  });
});
