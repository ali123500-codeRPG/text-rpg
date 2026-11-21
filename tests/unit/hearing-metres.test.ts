// BG-57, HB1–HB8: hearing by real metres. Inverse-square loss, a loss per crossing by its material and thickness (D-199 a:
// an oak door 30, a brick wall 52, an open gap 0) on the least-loss route, heard from the hearing floor (HEARING_FLOOR_DB; per-zone background is parked, D-231),
// clear 15 dB over it; a whisper to someone within 1 m is said leaning in (HB8). The test village is drawn on its plan:
// the common room's middle is 8 m from the bar's (an open gap) and 14 m from the street's (a doorway).
import { describe, expect, it } from 'vitest';
import { NOISE } from '../../src/scales';
import { CONFIG } from '../../src/config';
import { hearingOf, openAirReachM, soundDb } from '../../src/perception';
import { makeVillage, putBarrier } from '../harness';
import { BK, BM } from '../../src/library/tableIds';
import type { Barrier, GameState, TitleSpec } from '../../src/types';
import { drawTitles } from '../../src/plan/draw';
import { lineLoss, soundLossDb } from '../../src/plan/line';
import { materialRow } from '../../src/ruleset/breaking';

const door = (s: GameState, a: string, b: string, extra: Partial<Barrier> = {}): Barrier => putBarrier(s, a, b, { id: 'd1', kind: BK.door, grade: 'minor', ...extra });

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
  it('D-199 a: a wall loses its material\'s decibels at its thickness, 6 dB more for each doubling (the mass law)', () => {
    const brick = materialRow(BM.brick)!;
    expect(soundLossDb({ material: brick, cm: brick.exampleCm })).toBe(brick.soundDb);
    expect(soundLossDb({ material: brick, cm: brick.exampleCm * 2 })).toBeCloseTo(brick.soundDb + CONFIG.SOUND_DB_PER_DOUBLING);
    expect(soundLossDb({ material: brick, cm: brick.exampleCm / 2 })).toBeCloseTo(brick.soundDb - CONFIG.SOUND_DB_PER_DOUBLING);
    expect(soundLossDb({ material: materialRow(BM.iron)!, cm: 6 })).toBe(0); // bars: sound goes between them
    const s = makeVillage();
    const rooms: TitleSpec[] = [0, 1].map((i) => ({ id: `r${i}`, placeId: 'tavern', name: `room ${i}`, look: '', roof: true, light: 'bright',
      rect: { x: 100 + 5 * i, y: 100, w: 5, d: 4 }, ways: [] }));
    drawTitles(s, rooms);
    const A = { x: 102, y: 101, z: 1.6 }, B = { x: 103, y: 101, z: 1.6 };
    expect(lineLoss(s, A, B)).toBe(brick.soundDb); // a plain wall: brick at its example thickness
    const w = s.walls.find((x) => Math.abs(x.a.x - 102.5) < 0.01 && Math.abs(x.b.x - 102.5) < 0.01)!;
    const stone = materialRow(BM.stone)!;
    w.material = BM.stone; w.thicknessM = stone.exampleCm / 100 * 4; // a castle wall four times as thick: two doublings
    expect(lineLoss(s, A, B)).toBeCloseTo(stone.soundDb + 2 * CONFIG.SOUND_DB_PER_DOUBLING);
  });
});
