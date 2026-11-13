// BG-57, HB1–HB8: hearing by real metres. Inverse-square loss, a loss per crossing (open gap 0, shut door or window 30,
// wall 35) on the least-loss route, heard from the hearing floor (HEARING_FLOOR_DB; per-zone background is parked, D-231),
// clear 15 dB over it; a whisper to someone within 1 m is said leaning in (HB8). The test village has no rectangles: a
// zone link is 8 m, the same zone 1 m.
import { describe, expect, it } from 'vitest';
import { NOISE } from '../../src/scales';
import { CONFIG } from '../../src/config';
import { hearingOf, openAirReachM, soundDb } from '../../src/perception';
import { zoneById } from '../../src/engine/relations';
import { makeVillage } from '../harness';
import { BK } from '../../src/library/tableIds';
import type { Barrier, GameState } from '../../src/types';

const door = (s: GameState, a: string, b: string, extra: Partial<Barrier> = {}): Barrier => {
  const bar: Barrier = { id: 'd1', kind: BK.door, grade: 'minor', ...extra };
  (s.barriers ??= {})[bar.id] = bar;
  zoneById(s, a)!.links.find((l) => l.to === b)!.barrier = bar.id;
  zoneById(s, b)!.links.find((l) => l.to === a)!.barrier = bar.id;
  return bar;
};

describe('hearing by real metres (BG-57)', () => {
  it('open air in a quiet place: one equation for every level, louder never carries less', () => {
    makeVillage();
    expect(openAirReachM('silent')).toBeNull();
    expect(openAirReachM('normal')).toEqual([18, 100]);
    expect(openAirReachM('hushed')).toEqual([0, 3]);
    const r = NOISE.keys.map((k) => openAirReachM(k) ?? [0, 0]);
    for (let i = 1; i < r.length; i++) { expect(r[i][0]).toBeGreaterThanOrEqual(r[i - 1][0]); expect(r[i][1]).toBeGreaterThanOrEqual(r[i - 1][1]); }
    expect(openAirReachM('normal', 10)![0]).toBeGreaterThan(openAirReachM('normal')![0]); // Keen Ear
  });
  it('HB1: a voice is clear while 15 dB over the hearing floor, heard down to it, then lost', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const at = (zone: string) => ({ zone });
    expect(hearingOf(s, 'normal', at('tav_common'), at('tav_common'))).toBe('full'); // 60 dB at 1 m vs 20
    expect(hearingOf(s, 'normal', at('tav_common'), at('tav_counter'))).toBe('full'); // 8 m across the bar: 42
    expect(hearingOf(s, 'quiet', at('tav_common'), at('tav_counter'))).toBe('partial'); // 22
    expect(hearingOf(s, 'hushed', at('tav_common'), at('tav_counter'))).toBeNull(); // 12
    expect(hearingOf(s, 'normal', at('tav_common'), at('street_door'))).toBeNull(); // the front door, shut (no sight): 12
    CONFIG.HEARING_FLOOR_DB = 30; // a higher floor: the same voice (42 dB) is only heard
    expect(hearingOf(s, 'normal', at('tav_common'), at('tav_counter'))).toBe('partial');
  });
  it('HB4, BG-70: a shut door costs 30 dB, an open one nothing; a doorway with no sight is a shut door', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const spot = { street_door: { x: 0, y: -8 }, tav_counter: { x: 8, y: 0 } } as Record<string, { x: number; y: number }>;
    const across = (to: string) => soundDb(s, 'normal', { zone: 'tav_common', pos: { x: 0, y: 0 } }, { zone: to, pos: spot[to] })!;
    expect(across('street_door')).toBeCloseTo(across('tav_counter') - 30); // both 8 m from the common room's middle: the front door has no sight
    const b = door(s, 'tav_common', 'street_door');
    expect(across('street_door')).toBeCloseTo(across('tav_counter') - 30);
    b.open = true;
    expect(across('street_door')).toBeCloseTo(across('tav_counter'));
    const grate = door(s, 'tav_common', 'tav_counter', { id: 'g1', kind: BK.grate });
    expect(grate.kind).toBe(BK.grate);
    expect(across('tav_counter')).toBeCloseTo(60 - 20 * Math.log10(8)); // bars cost nothing
  });
  it('HB8: a whisper to someone within 1 m is said leaning in; to anyone else, or farther, it is not', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const here = { zone: 'tav_common' };
    expect(soundDb(s, 'hushed', here, here, 0, true)! - soundDb(s, 'hushed', here, here)!).toBeCloseTo(-20 * Math.log10(CONFIG.WHISPER_LEAN_M));
    expect(soundDb(s, 'hushed', here, { zone: 'street_door' }, 0, true)).toBeCloseTo(soundDb(s, 'hushed', here, { zone: 'street_door' })!);
    CONFIG.HEARING_FLOOR_DB = 30; // a whisper leaned in (40.5) is heard, not understood
    expect(hearingOf(s, 'hushed', here, here, 0, true)).toBe('partial');
  });
});

describe('hearing on a mapped stage (BG-57)', () => {
  it('BG-57: the barkeep whispering across the counter 1 m away is understood when leaned in, only heard when not meant for you', async () => {
    const { placeZones } = await import('../../src/scenario/geometry');
    const { placeAll } = await import('../../src/engine/position');
    const s = makeVillage({ playerZone: 'tav_common' });
    const zs = s.places.flatMap((p) => p.zones);
    for (const z of zs) z.area = CONFIG.ZONE_SIZE_M2[z.id.startsWith('field') ? 'open' : z.id.startsWith('street') || z.id.startsWith('gate') ? 'yard' : 'room'];
    placeZones(s, zs);
    placeAll(s);
    const common = zoneById(s, 'tav_common')!, counter = zoneById(s, 'tav_counter')!;
    expect(common.rect && counter.rect).toBeTruthy();
    // stand them a metre apart across the shared side
    const { doorway } = await import('../../src/scenario/geometry');
    const d = doorway(common, counter)!;
    const me = { zone: 'tav_common', pos: { x: d.x + (common.rect!.x - d.x) * 0.5 / Math.hypot(common.rect!.x - d.x, common.rect!.y - d.y), y: d.y + (common.rect!.y - d.y) * 0.5 / Math.hypot(common.rect!.x - d.x, common.rect!.y - d.y) } };
    const her = { zone: 'tav_counter', pos: { x: d.x + (counter.rect!.x - d.x) * 0.5 / Math.hypot(counter.rect!.x - d.x, counter.rect!.y - d.y), y: d.y + (counter.rect!.y - d.y) * 0.5 / Math.hypot(counter.rect!.x - d.x, counter.rect!.y - d.y) } };
    expect(hearingOf(s, 'hushed', her, me, 0, true)).toBe('full'); // leaning in over the counter
    expect(hearingOf(s, 'hushed', her, me)).toBe('partial'); // a whisper not meant for you: heard, not understood
  });
});
