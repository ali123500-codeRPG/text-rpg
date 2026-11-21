// 424 D-214 b: three loudness levels past Deafening, from real figures (dB at 1 m): Thunderous 140 (a gunshot, the
// threshold of pain), Shattering 170 (Krakatoa, 172 dB at 160 km), Cataclysmic 194 (the loudest sound air can carry).
// Shockwaves past it are parked (D-1751). A mishap's noise climbs no higher than Deafening.
import { expect, it } from 'vitest';
import { NOISE } from '../../src/scales';
import { CONFIG } from '../../src/config';
import { openAirReachM, stepNoise } from '../../src/perception/noise';

it('D-214 b: Thunderous, Shattering and Cataclysmic follow Deafening, each louder and heard farther', () => {
  expect(NOISE.keys.slice(NOISE.pos('deafening'))).toEqual(['deafening', 'thunderous', 'shattering', 'cataclysmic']);
  expect([CONFIG.NOISE_DB.thunderous, CONFIG.NOISE_DB.shattering, CONFIG.NOISE_DB.cataclysmic]).toEqual([140, 170, 194]);
  const reach = ['deafening', 'thunderous', 'shattering', 'cataclysmic'].map((k) => openAirReachM(k as never)![1]);
  for (let i = 1; i < reach.length; i++) expect(reach[i]).toBeGreaterThan(reach[i - 1]);
  for (const k of ['thunderous', 'shattering', 'cataclysmic']) expect(CONFIG.WAKE_GRADE[k]).toBe('none');
});

it('D-214: a step louder (armor, a mishap, breaking through) stops at NOISE_STEP_TOP; a noise past it stays; quieter steps still go down', () => {
  expect(CONFIG.NOISE_STEP_TOP).toBe('deafening');
  expect(stepNoise('blaring', 1)).toBe('deafening');
  expect(stepNoise('blaring', 3)).toBe('deafening');
  expect(stepNoise('deafening', 1)).toBe('deafening');
  expect(stepNoise('shattering', 1)).toBe('shattering');
  expect(stepNoise('shattering', -1)).toBe('thunderous');
  expect(stepNoise('faint', -3)).toBe('silent');
});
