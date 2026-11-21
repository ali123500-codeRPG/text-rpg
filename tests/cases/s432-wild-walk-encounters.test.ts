// 432 BG-1831 (D-245 a): a long walk with no road on its route is no trip, but on a generated land each hour of it on open
// land off the road rolls for an encounter at the wild rate, as a trip's legs do. A meeting stops the walk where the hour
// filled and breaks the scenario; the Weaver is told the danger is wild and who roams the land there. Needed: the trip
// tests run on hand-built roads with no land under them, and wild-ground.test only checks where open land is.
import { describe, expect, it } from 'vitest';
import { makeVillage, withRoad, withWays } from '../harness';
import { intent, play } from './w4-kit';
import { drawRegion, type RegionBrief } from '../../src/land/generate';
import { wildGround } from '../../src/engine/travel';
import { moveSpeed } from '../../src/engine/speed';
import { perceivesNow } from '../../src/engine/yield';
import { now } from '../../src/time';
import { buildWeaverView } from '../../src/views';
import { placeAll, unplace } from '../../src/engine/position';
import { CONFIG } from '../../src/config';
import { RK, ZK } from '../../src/library/tableIds';
import type { GameState, TitleSpec } from '../../src/types';

const BRIEF: RegionBrief = { kind: RK.upland_moor, name: 'the High Moor', look: 'open moor', settlements: [{ size: 'hamlet', name: 'Hob End', look: '' }], features: [], beyond: {} };
const KM = 6;

/** the test village on a drawn region (the land generator's own cover), with open moor and no road running 6 km north
 * out of the gate to a cairn; no slimes; day 1, morning */
function moorland(): GameState {
  const moor: TitleSpec = { id: 'moor', placeId: 'gate', kind: ZK.field, name: 'the open moor', look: 'heather and rock', light: 'dark', roof: false,
    rect: { x: 31, y: KM * 500 - 4, w: 34, d: KM * 1000 }, ways: [{ to: 'gate_inner', label: 'back to the gate, south', kind: 'open' }, { to: 'cairn', label: 'the cairn, north', kind: 'open' }] };
  const cairn: TitleSpec = { id: 'cairn', placeId: 'gate', kind: ZK.field, name: 'the cairn', look: 'a heap of stones', light: 'dark', roof: false,
    rect: { x: 31, y: KM * 1000 + 6, w: 20, d: 20 }, ways: [{ to: 'moor', label: 'the moor, south', kind: 'open' }] };
  const s = makeVillage({ playerZone: 'gate_inner', without: ['slime_1', 'slime_2'], shape: { gate_inner: withWays('gate_inner', { to: 'moor', label: 'out onto the moor', kind: 'open' }) },
    add: [moor, cairn] });
  s.regions = [drawRegion('rg', 0, 0, 7, BRIEF)];
  s.clocks.time = 7 * 60;
  return s;
}
const go = (s: GameState) => play(s, { intent: intent({ move: { toZone: 'cairn' } }) }, 3);

describe('432 encounters on long walks off the road', () => {
  it('the moor is open land of the generated region, and the walk to the cairn is a walk on the world clock, not a trip', () => {
    const s = moorland();
    const along = Array.from({ length: KM * 10 }, (_, i) => ({ x: 31, y: 50 + i * 100 }));
    expect(along.filter((p) => wildGround(s, p)).length).toBeGreaterThan(along.length * 0.9);
    CONFIG.ROAD_ENCOUNTER_PCT = { ...CONFIG.ROAD_ENCOUNTER_PCT, wild: 0 };
    go(s);
    expect(s.log.some((l) => l.code === 'travelled')).toBe(false);
    expect(s.player.zone).toBe('cairn');
    // over an hour on the moor: one leg filled and rolled (nothing met at 0%), and the minutes since count toward the next
    const minutes = (KM * 1000) / moveSpeed(s, s.player).walk / 60;
    expect(minutes).toBeGreaterThan(CONFIG.TRAVEL_LEG_MIN);
    expect(s.player.roadMin).toBeGreaterThan(0);
    expect(s.player.roadMin).toBeLessThan(minutes - CONFIG.TRAVEL_LEG_MIN + 1);
  });

  it('a full hour on open land rolls at the wild rate: a meeting stops the walk there and breaks the scenario, and the Weaver is told the land is wild and who roams it', () => {
    const s = moorland();
    CONFIG.ROAD_ENCOUNTER_PCT = { ...CONFIG.ROAD_ENCOUNTER_PCT, wild: 100 };
    go(s);
    expect(s.player.zone).toBe('moor');
    expect(s.stage.breakCause).toBe('encounter');
    expect(s.stage.encounter!.zone).toBe('moor');
    expect(s.player.roadMin).toBe(0);
    // it filled where an hour's walk on the moor ended, not before
    const hourM = moveSpeed(s, s.player).walk * CONFIG.TRAVEL_LEG_MIN * 60;
    expect(s.player.pos!.y).toBeGreaterThan(hourM - CONFIG.STEP_MAX_S * 2);
    expect(s.player.pos!.y).toBeLessThan(KM * 1000);
    expect(wildGround(s, s.stage.encounter!.at)).toBe(true);
    expect(s.log.find((l) => l.code === 'stretch_stopped')?.detail).toMatchObject({ kind: 'walk', why: 'encounter' });
    expect(s.player.walking).toBeDefined(); // stopped on the way, the walk to the cairn carries on after
    const enc = buildWeaverView(s, { kind: 'scenario', placeId: s.player.placeId }).target.encounter!;
    expect(enc).toMatchObject({ zone: 'moor', danger: 'wild' });
    expect(enc.wild?.length).toBeGreaterThan(0);
  });

  it('a walk along a road that is no trip (someone hostile in the player\'s senses) counts its road minutes and rolls by the road\'s danger all the same', () => {
    const s = withRoad(9, 'dangerous');
    CONFIG.ROAD_ENCOUNTER_PCT = { ...CONFIG.ROAD_ENCOUNTER_PCT, dangerous: 100 };
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    g.mind!.overrides = { ...g.mind!.overrides, player: 'hostile' };
    g.zone = 'gate_inner'; g.placeId = 'gate'; unplace(s, g); placeAll(s); // in the player's senses (TV1)
    g.asleep = { since: now(s) }; // asleep, so it does not wake and start a fight that would stop the walk
    expect(perceivesNow(s, s.player, g, 'faint')).toBe(true);
    play(s, { intent: intent({ move: { toZone: 'ashford_gate' } }) }, 3);
    expect(s.log.some((l) => l.code === 'travelled')).toBe(false);
    expect(s.stage.encounter?.zone).toBe('north_road');
    expect(buildWeaverView(s, { kind: 'scenario', placeId: s.player.placeId }).target.encounter).toMatchObject({ zone: 'north_road', danger: 'dangerous' });
  });

  it('in the dark the meeting\'s event roll is worse, as on a night road', () => {
    const s = moorland();
    s.clocks.time = CONFIG.TIME_OF_DAY_FROM.night + 60;
    CONFIG.ROAD_ENCOUNTER_PCT = { ...CONFIG.ROAD_ENCOUNTER_PCT, wild: 100 };
    go(s);
    expect(s.stage.encounter!.eventRoll.modifiers).toContainEqual({ source: 'night travel', type: 'situational', value: CONFIG.NIGHT_TRAVEL_EVENT_MOD });
  });
});
