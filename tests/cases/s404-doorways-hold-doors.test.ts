// BG-312: a doorway holds a real door (shut, unlocked) unless it is doorless; sight and sound follow what stands in it, never a
// fixed see-through flag. A doorless doorway (an open hall, a curtain) is seen and heard through like a gap.
import { describe, expect, it } from 'vitest';
import type { TitleSpec } from '../../src/types';
import { drawTitles } from '../../src/plan/draw';
import { lineClear, lineLoss } from '../../src/plan/line';
import { makeVillage } from '../harness';
import { BK, OP } from '../../src/library/tableIds';
import { LAYOUTS } from '../../src/library/layouts';
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

  it('every doorway in the test village holds a door, and the cottage curtains are doorless', () => {
    const s = makeVillage();
    for (const o of s.openings.filter((x) => x.kind === OP.doorway && !x.frontier)) expect(s.barriers?.[o.barrier!]?.kind).toBe(BK.door);
    const curtains = Object.values(LAYOUTS).flatMap((l) => l.zones.flatMap((z) => z.ways)).filter(([, label]) => label.includes('curtain'));
    expect(curtains.length).toBeGreaterThan(0);
    for (const w of curtains) expect(w[3]).toBe('doorless');
  });

  it('a v10 save: a doorway its old flag kept shut gets the door it stood for; the flag goes', () => {
    const s = makeVillage();
    const o = s.openings.find((x) => x.joins.includes('street_door') && x.joins.includes('tav_common'))!;
    delete s.barriers![o.barrier!];
    delete o.barrier;
    Object.assign(o, { seeThrough: false });
    const pages = toPages(s);
    MIGRATIONS[10](pages);
    const plan = Object.entries(pages).find(([k]) => k === `plan.${o.placeId}`)![1] as { openings: (typeof o & { seeThrough?: boolean })[] };
    const after = plan.openings.find((x) => x.id === o.id)!;
    expect(after.seeThrough).toBeUndefined();
    expect((pages.engine as { barriers: Record<string, { kind: string }> }).barriers[after.barrier!]).toMatchObject({ kind: BK.door });
  });
});
