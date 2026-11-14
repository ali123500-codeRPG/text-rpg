// 318 BF68 (BG-244): everyone gets somewhere to sleep. Placed with a sleep step and no bed in the plan, an NPC gets a real
// bed within BED_NEAR_HOPS links of its own spots, else its refuge, else its work spot. One still without a bed in play
// sleeps where it stands when its routine says sleep, and the gap is filed once as a bug (bed_missing).
import { describe, expect, it } from 'vitest';
import type { GameState, Intent, ParserActionType } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { CONFIG } from '../../src/config';
import { routineSet } from '../../src/library';
import { FU } from '../../src/library/tableIds';
import { applyStagePlan, type PlanContext } from '../../src/scenario';
import { withBed } from '../../src/scenario/apply';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { isBugCode } from '../../src/save/bugs';
import { fatigueOf } from '../../src/ruleset/fatigue';

const act = (type: ParserActionType): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type, skill: '', target: null, item: null, targetPart: null, mode: null, approach: '', stance: 'normal' },
});
const turn = (s: GameState) => { s.turn += 1; return resolveTurn(s, { intent: act('observe'), aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };

describe('318 everyone has a bed', () => {
  it('placed from a plan, everyone whose set has a bed slot gets one', () => {
    const s = toStoryStart(makeVillage());
    const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
    applyStagePlan(s, villageStagePlan(), ctx, { entry: 'open' }, createRng(1));
    const withSlot = s.actors.filter((a) => a.mind?.routineSetId && routineSet(a.mind.routineSetId)?.slots.bed);
    expect(withSlot.length).toBeGreaterThan(0);
    for (const a of withSlot) expect(a.mind!.slots?.bed, a.id).toBeTruthy();
  });

  it('a real bed nearby first, else the refuge, else the work spot', () => {
    const s = makeVillage();
    expect(withBed(s, 'barkeep', { counter: 'tav_counter', refuge: 'tav_cellar' }, 'tav_counter').bed).toBe('tav_cellar');
    expect(withBed(s, 'gate_guard', { post: 'gate_inner' }, 'gate_inner').bed).toBe('gate_inner');
    expect(withBed(s, 'barkeep', { counter: 'tav_counter', refuge: 'tav_cellar', bed: 'tav_common' }, 'tav_counter').bed).toBe('tav_common'); // given: kept
    expect(withBed(s, 'thief', { route: ['field_mid'], refuge: 'tav_cellar' }, 'field_mid').bed).toBeUndefined(); // no bed slot
    const z = s.zones.find((x) => x.id === 'tav_common')!;
    (z.furniture ??= []).push({ id: 'bed_1', kind: FU.bed } as never);
    expect(withBed(s, 'barkeep', { counter: 'tav_counter', refuge: 'tav_cellar' }, 'tav_counter').bed).toBe('tav_common');
  });

  it('in play, a sleep step with no bed runs where it stands, filed once', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'patron_1', 'guard_1'] });
    const b = s.actors.find((a) => a.id === 'trader')!;
    expect(b.mind!.slots?.bed).toBeUndefined();
    const where = b.zone;
    s.clocks.time = CONFIG.TIME_OF_DAY_FROM.night + 30;
    fatigueOf(b).debt = 30;
    turn(s);
    expect(b.asleep).toBeDefined();
    expect(b.zone).toBe(where);
    turn(s);
    const filed = s.log.filter((l) => l.code === 'bed_missing' && l.detail?.actorId === 'trader');
    expect(filed).toHaveLength(1);
    expect(isBugCode('bed_missing')).toBe(true);
    expect(fatigueOf(b).debt).toBeLessThan(30); // sleeping clears the debt
  });
});
