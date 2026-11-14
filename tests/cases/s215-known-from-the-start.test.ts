// BF1 (BG-114, answer a): the cast already knows everyone it can see at a scenario's opening, so two people the
// Weaver set up as opposed in one room don't "notice" each other on turn 1, raise the alarm and flee. Someone set up
// hiding (a stealthy routine) is not known: the stealth contests find them as play starts.
import { expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { TP } from '../../src/library/templateIds';
import { createRng, makeVillage } from '../harness';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { play } from './w4-kit';

it('BF1: opposed people set up in sight of each other keep their routines; a hider stays unknown', () => {
  const s = toStoryStart(makeVillage());
  s.clocks.time = CONFIG.TIME_OF_DAY_FROM.evening; // BF68: the patron sleeps through the morning; in the evening it drinks at its seat
  const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
  const p = villageStagePlan();
  p.cast = p.cast.filter((c) => c.band !== 'slimes');
  p.bands = p.bands.filter((b) => b.key !== 'slimes').map((b) => ({ ...b, relations: {} }));
  p.scenario!.endings[0].when = { kind: 'judged' };
  p.cast.find((c) => c.key === 'patron_1')!.overrides = [{ actor: 'barkeep', stance: 'opposed' }];
  p.cast.push({ template: TP.patron, key: 'thief_1', label: 'a sharp-eyed woman', name: 'Ressa', appearance: 'quick hands',
    band: 'tavern_folk', routineSetId: 'thief', slots: { route: ['tav_common'], refuge: 'tav_cellar' }, awarenessOfPlayer: 'unaware', motive: 'loose coin' });
  expect(validateStagePlan(s, p, ctx)).toEqual([]);
  applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
  const wim = s.actors.find((a) => a.id === 'patron_1')!;
  expect(wim.mind!.knowledge.barkeep?.status).toBe('aware');
  expect(wim.mind!.knowledge.thief_1?.status ?? 'unaware').toBe('unaware');
  expect(wim.mind!.alarm?.armed).toBe(true); // known from the start: that alarm is spent, none raised
  const routine = wim.mind!.routine!.id;
  play(s);
  expect(wim.mind!.routine!.id).toBe(routine);
  expect(wim.mind!.alarm?.lastAlarmTurn).toBeUndefined();
});
