// PS-486 to PS-489: the play screen's backdrops. The table must cover every zone kind and match the files shipped (a
// missing file would show the plain colour with no error), and code picks one picture per zone from where it is.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readdirSync, readFileSync } from 'node:fs';
import { BACKDROPS } from '../../src/library/backdrops';
import { RK, ZK } from '../../src/library/tableIds';
import { backdropFor } from '../../src/views/backdrop';
import { middle } from '../../src/plan/where';
import { CONFIG } from '../../src/config';
import { planWorld, title } from '../harness/plan';
import type { GameState } from '../../src/types';

const DIR = 'src/ui/assets/backdrops';
const at = (k: 'morning' | 'night') => ({ clocks: { time: CONFIG.TIME_OF_DAY_FROM[k] + 30 } }) as unknown as Partial<GameState>;

describe('backdrop table', () => {
  it('matches the files shipped, one to one, and credits each in docs/assets.md', () => {
    const ids = BACKDROPS.map((b) => b.id), files = (readdirSync(DIR) as string[]).map((f) => f.replace(/\.webp$/, ''));
    expect(new Set(ids).size).toBe(ids.length);
    expect([...files].sort()).toEqual([...ids].sort());
    const credits: string = readFileSync('docs/assets.md', 'utf8');
    for (const id of ids) expect(credits, id).toContain(`${id}.webp`);
  });
});

describe('backdropFor', () => {
  it('picks a picture of the zone kind, the same one each time, and none for a zone with no kind', () => {
    const s = planWorld([title('hall', 'inn', [], { kind: ZK.room, roof: true }), title('bare', 'inn', [])], at('morning'));
    const z = s.zones.find((q) => q.id === 'hall')!;
    const id = backdropFor(s, z)!;
    expect(BACKDROPS.find((b) => b.id === id)!.kinds).toContain(ZK.room);
    expect(backdropFor(s, z)).toBe(id);
    expect(backdropFor(s, s.zones.find((q) => q.id === 'bare')!)).toBeUndefined();
  });
  it('keeps moonlit scenes for the open air after dark', () => {
    const night = planWorld([title('f', 'farm', [], { kind: ZK.field, roof: false })], at('night'));
    expect(BACKDROPS.find((b) => b.id === backdropFor(night, night.zones[0]))!.night).toBe(true);
    const day = planWorld([title('f', 'farm', [], { kind: ZK.field, roof: false })], at('morning'));
    expect(BACKDROPS.find((b) => b.id === backdropFor(day, day.zones[0]))!.night).toBeUndefined();
  });
  it("prefers the region's own land for open ground", () => {
    const s = planWorld([title('f', 'farm', [], { kind: ZK.field, roof: false })], at('morning'));
    const m = middle(s.zones[0]), S = CONFIG.REGION_SIZE_M;
    s.regions = [{ id: 'r', kind: RK.upland_moor, gx: Math.floor(m.x / S), gy: Math.floor(m.y / S) }] as never;
    expect(BACKDROPS.find((b) => b.id === backdropFor(s, s.zones[0]))!.regions).toContain(RK.upland_moor);
  });
});
