import { it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play, act, plannerOut } from '../scenarios/w4-kit';
import { isActive } from '../../src/engine/relations';
import { createPlayer, recommendedBuild } from '../../src/library/spawn';
import { CONFIG } from '../../src/config';
it('legend vs slime marks', () => {
  for (const instant of [false, true]) {
    let gains = 0, marks = 0, fights = 0, wins = 0, turns = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const s = makeVillage({ playerZone: 'field_mid', without: ['trader', 'patron_1', 'guard_1', 'slime_2'] });
      (CONFIG as { SKILL_UP_INSTANT: boolean }).SKILL_UP_INSTANT = instant;
      const pl = createPlayer({ ...recommendedBuild('CL2'), name: 'A' } as never, s.storyId);
      Object.assign(s.player, { core: pl.core, progression: pl.progression });
      const start = Object.fromEntries(Object.entries(pl.core.skills).map(([k, v]) => [k, v.raw]));
      const sl = place(s, 'slime_1', 'field_mid'); sl.mind!.overrides = { player: 'hostile' };
      let t = 0;
      for (; t < 15 && isActive(s.player) && isActive(sl); t++) {
        play(s, { intent: intent({ action: { type: 'attack', target: 'slime_1' } }), agentOutputs: [plannerOut('slime_1', act('attack', 'player'))] }, seed * 100 + t);
        marks += Object.values(s.player.progression!.markCounts ?? {}).length ? 1 : 0;
      }
      for (let q = 0; q < 3; q++) play(s, { intent: intent({ action: { type: 'other' } }) }, seed * 100 + 50 + q);
      fights++; turns += t; if (isActive(s.player) && !isActive(sl)) wins++;
      gains += s.player.progression!.xpLog ? 0 : 0;
      gains += Object.entries(s.player.core.skills).reduce((n, [k, v]) => n + Math.max(0, v.raw - (start[k] ?? 0)), 0);
    }
    console.log(instant ? 'instant' : 'end', { fights, wins, turnsPerFight: turns / fights, turnsWithMarks: marks, skillPointsGainedTotal: gains });
  }
});
it('start', () => { const pl = createPlayer({ ...recommendedBuild('CL2'), name: 'A' } as never, 'x'); console.log(JSON.stringify(Object.fromEntries(Object.entries(pl.core.skills).map(([k, v]) => [k, v.raw])))); });
