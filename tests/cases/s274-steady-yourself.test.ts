// 274 SY1 (Speech with actions, furnished rooms): steadying yourself. A main action, in a fight only, never while Broken, not
// again within CONFIG.STEADY_COOLDOWN_S. One Resolve roll with Shaken against it; its tier wins back a share of max morale
// (CONFIG.STEADY_PCT) or, done badly, loses one. Great Success or better also leaves Mentally steady: the next morale loss
// is halved (CONFIG.STEADY_BUFF_MULT), then the buff is gone.
import { expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { forcedRng, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { wholeTurn } from '../harness/turn';
import { CONFIG } from '../../src/config';
import { FR } from '../../src/library/tableIds';
import { TIERS } from '../../src/scales';
import { actorById, isEngaged } from '../../src/engine/relations';
import { steady, steadyPct } from '../../src/engine/steady';
import { payFear } from '../../src/engine/morale';
import { maxMorale, moraleLost } from '../../src/ruleset/morale';
import { buildPlayerView } from '../../src/views';
import { NEEDS } from '../../src/engine/merge';

/** the patron is hostile to the player and knows where they are: the player is in a fight */
const foe = (s: GameState): GameState => {
  const m = actorById(s, 'patron_1')!.mind!;
  m.overrides = { player: 'hostile' };
  m.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  return s;
};
const fight = (): GameState => foe(makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] }));

it('SY1: the tier wins back (or loses) a share of max morale, more past either end', () => {
  makeVillage();
  expect(steadyPct(TIERS.pos('success'))).toBe(CONFIG.STEADY_PCT.success);
  expect(steadyPct(TIERS.pos('failure'))).toBeLessThan(0);
  expect(steadyPct(TIERS.pos('critical_success') + 2)).toBe(CONFIG.STEADY_PCT.critical_success + 2 * CONFIG.STEADY_PAST_PCT);
  expect(steadyPct(TIERS.pos('critical_failure') - 1)).toBe(CONFIG.STEADY_PCT.critical_failure - CONFIG.STEADY_PAST_PCT);
  expect(NEEDS.steady).toBeUndefined(); // needs no reach
});

it('SY1: a fine roll wins morale back and leaves Mentally steady; the next loss is halved, then the buff is gone', () => {
  const s = fight();
  s.player.core.condition.moraleLost = 0.5 * maxMorale(s.player);
  const r = steady(s, s.player, forcedRng([100]));
  expect(TIERS.pos(r.roll.tier)).toBeGreaterThanOrEqual(TIERS.pos('great_success'));
  expect(r.points).toBeGreaterThan(0);
  expect(r.buff).toBe(true);
  expect(buildPlayerView(s).player.mentallySteady).toBe(true);
  const before = moraleLost(s.player);
  payFear(s, forcedRng([]), s.player, FR.steady_slipped, { cost: 10 });
  expect(moraleLost(s.player) - before).toBeCloseTo(10 * CONFIG.STEADY_BUFF_MULT);
  expect(s.player.core.condition.mentallySteady).toBeUndefined();
  const again = moraleLost(s.player);
  payFear(s, forcedRng([]), s.player, FR.steady_slipped, { cost: 10 });
  expect(moraleLost(s.player) - again).toBeCloseTo(10);
});

it('SY1: a bad roll costs morale and leaves no buff', () => {
  const s = fight();
  const r = steady(s, s.player, forcedRng([1]));
  expect(r.points).toBeLessThan(0);
  expect(moraleLost(s.player)).toBeGreaterThan(0);
  expect(r.buff).toBe(false);
});

it('SY1: Shaken weighs on the roll', () => {
  const calm = fight(), shaken = fight();
  shaken.player.pressure = { patron_1: { shaken: 20 } };
  const a = steady(calm, calm.player, forcedRng([50])), b = steady(shaken, shaken.player, forcedRng([50]));
  expect(b.roll.margin).toBeLessThan(a.roll.margin);
});

it('SY1: refused out of a fight, again too soon, and while broken', () => {
  const calm = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  expect(play(calm, { intent: intent({ action: { type: 'steady' } }) }).find((e) => e.actorId === 'player' && e.kind === 'wasted')?.reason).toBe('not_in_fight');
  const s = fight();
  expect(isEngaged(s, s.player)).toBe(true);
  expect(play(s, { intent: intent({ action: { type: 'steady' } }) }).some((e) => e.actorId === 'player' && e.kind === 'steady')).toBe(true);
  expect(play(s, { intent: intent({ action: { type: 'steady' } }) }).find((e) => e.actorId === 'player' && e.kind === 'wasted')?.reason).toBe('too_soon');
  const b = fight();
  b.player.core.condition.moraleLost = maxMorale(b.player);
  expect(play(b, { intent: intent({ action: { type: 'steady' } }) }).find((e) => e.actorId === 'player' && e.kind === 'wasted')?.reason).toBe('broken');
});

it('whole turn: the Narrator gets the steady event in words, never points', async () => {
  const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  foe(g.game.state()!);
  await g.turn(intent({ action: { type: 'steady' } }));
  const req = g.claude.callsFor('narrator').at(-1) as { input: { content: string }[] };
  expect(req.input[1].content).toMatch(/"steady":"(calmer|worse|no change)"/);
});
