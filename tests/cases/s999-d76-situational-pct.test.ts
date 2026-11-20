// TEMPORARY (D-76, deleted before merge): over one whole turn, the unaware and outnumbered defense penalties are a % of
// the defender's average roll, so they grow with the defender's skill
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ruleset } from '../../src/ruleset';
import { npcAction } from '../harness/turn';
import { CONFIG } from '../../src/config';
import { intent, wholeTurn } from '../harness/turn';
import { beside, makeVillage, place } from '../harness/village';
import { createRng } from '../harness';
import { resolveTurn } from '../../src/engine';
import { DEFENSE_SKILL } from '../../src/library/skillIds';
import { D100_MEAN } from '../../src/rng';
import type { Actor, GameEvent, Intent } from '../../src/types';

const stab = (target: string): Intent => intent({ action: { type: 'attack', skill: '', target, targetPart: null, item: null, mode: null, approach: '' } });
const train = (a: Actor, raw: number) => { for (const sk of Object.values(DEFENSE_SKILL)) a.core.skills[sk] = { raw, state: 'normal' }; };
/** the defense modifier's % and the effective skill its points imply (points = % × (50.5 + SKILL_WEIGHT × skill)) */
const mods = (events: GameEvent[], source: string) => events.flatMap((e) => e.attack?.defense?.modifiers ?? []).filter((m) => m.source === source)
  .map((m) => ({ pct: m.pct, skill: (m.value / (m.pct! / 100) - D100_MEAN) / CONFIG.SKILL_WEIGHT }));

afterEach(() => vi.restoreAllMocks());
/** the guard loses every stealth contest of the ambush (forced dice, as in s412), so the blow finds it unaware */
const unseen = () => { const real = ruleset.contested; vi.spyOn(ruleset, 'contested').mockImplementation((a, b, st, rng) => { const r = real(a, b, st, rng); return a.rollKind === 'stealth' ? { ...r, gap: -1, winner: 'a' } : r; }); };

describe('D-76 situational defense penalties as % of the average roll (whole turn)', () => {
  it('unaware: −13% of the defender\'s average roll, more points the more skilled the defender', async () => {
    const at = async (raw: number) => {
      const g = wholeTurn();
      place(g.state, 'player', 'gate_inner');
      const guard = beside(g.state, 'guard_1');
      delete guard.mind!.knowledge.player;
      g.state.player.posture = 'stealthy';
      train(guard, raw);
      unseen();
      const { events } = await g.turn(stab('guard_1'));
      return mods(events, 'unaware');
    };
    const low = await at(10), high = await at(180);
    expect(low.length && high.length).toBeTruthy();
    expect([low[0].pct, high[0].pct]).toEqual([-13, -13]);
    expect(high[0].skill).toBeGreaterThan(low[0].skill + 100);
  });

  it('outnumbered: −7% of the defender\'s average roll on the second defense of a turn, scaling the same way', async () => {
    const at = async (raw: number) => {
      const st = makeVillage({ playerZone: 'field_mid' });
      for (const id of ['slime_1', 'slime_2']) { place(st, id, 'field_mid'); beside(st, id); }
      train(st.player, raw);
      st.turn += 1;
      const planner = (actorId: string) => ({ agent: 'planner', actorId, output: { action: npcAction('attack', 'player'), dialogue: null, gear: null, stance: null, planUpdate: null } }) as never;
      const events = resolveTurn(st, { intent: intent(), aimed: false, agentOutputs: [planner('slime_1'), planner('slime_2')], spokespeople: [] }, createRng(1));
      return mods(events, 'outnumbered');
    };
    const low = await at(10), high = await at(180);
    expect(low.length && high.length).toBeTruthy();
    expect([low[0].pct, high[0].pct]).toEqual([-7, -7]);
    expect(high[0].skill).toBeGreaterThan(low[0].skill + 100);
  });
});
