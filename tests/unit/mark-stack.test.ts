// SM1–SM4: marks stack (the first mark on a skill in an engagement owes a roll, and so does every MARK_STACK_EVERY-th
// mark after it); the owed rolls wait for the scenario's end (EG7; with GROWTH_AT_SCENARIO_END off they are made at the end
// of the turn of the mark); counts clear when the engagement ends or the scenario breaks.
import { afterEach, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { clearMarkCounts, markIfClose } from '../../src/ruleset/improve';
import { SK } from '../../src/library/skillIds';
import { intent, act, plannerOut, play } from '../cases/w4-kit';

const cfg = CONFIG as unknown as { MARK_STACK_EVERY: number; GROWTH_AT_SCENARIO_END: boolean };
afterEach(() => { cfg.MARK_STACK_EVERY = 2; cfg.GROWTH_AT_SCENARIO_END = true; });

it('marks 1, 3, 5 and 7 each owe a roll at MARK_STACK_EVERY 2; the lever changes it', () => {
  const s = makeVillage(), p = s.player;
  p.core.skills[SK.dodge] = { raw: 30, state: 'normal' };
  for (let i = 0; i < 7; i++) markIfClose(s, p, SK.dodge, 30);
  expect(p.progression!.marks).toEqual([SK.dodge, SK.dodge, SK.dodge, SK.dodge]);
  clearMarkCounts(p); p.progression!.marks = [];
  cfg.MARK_STACK_EVERY = 5;
  for (let i = 0; i < 7; i++) markIfClose(s, p, SK.dodge, 30);
  expect(p.progression!.marks).toEqual([SK.dodge, SK.dodge]); // marks 1 and 6
  clearMarkCounts(p); p.progression!.marks = [];
  cfg.MARK_STACK_EVERY = Infinity;
  for (let i = 0; i < 7; i++) markIfClose(s, p, SK.dodge, 30);
  expect(p.progression!.marks).toEqual([SK.dodge]); // one roll per engagement, as before
});

it('owed rolls wait for the scenario end (made the same turn with GROWTH_AT_SCENARIO_END off); counts hold for the engagement', () => {
  for (const instant of [false, true]) {
    let checked = 0;
    for (let seed = 1; seed < 60 && checked < 3; seed++) {
      const s = makeVillage({ without: ['trader', 'patron_1', 'slime_1', 'slime_2'] });
      cfg.GROWTH_AT_SCENARIO_END = !instant; // after makeVillage, which resets the config
      const guard = s.actors.find((a) => a.id === 'guard_1')!; // an even foe: its rolls sit in the player's window
      guard.zone = s.player.zone; guard.placeId = s.player.placeId;
      guard.mind!.overrides = { player: 'hostile' };
      play(s, { intent: intent({ action: { type: 'attack', target: 'guard_1' } }), agentOutputs: [plannerOut('guard_1', act('attack', 'player'))] }, seed);
      const pr = s.player.progression!;
      if (!Object.keys(pr.markCounts ?? {}).length || !s.player.engagement) continue;
      checked++;
      if (instant) expect(pr.marks).toEqual([]); // rolled at the end of the turn
      else expect(pr.marks.length).toBeGreaterThan(0); // waiting for the scenario to end
    }
    expect(checked).toBe(3);
  }
});
