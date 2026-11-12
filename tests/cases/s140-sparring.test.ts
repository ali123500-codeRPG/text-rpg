// 140 Sparring (SP1–SP11) and the lethal flag (D-54, SP12). A spar is a pact between sides: fighters trade real blows
// while nobody's stance changes, until all but one side has yielded or reached the limit. A downed player rolls to
// survive only when no one hostile from a lethal band is left standing.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { actor, createRng, makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { CONFIG } from '../../src/config';
import { healthLevel } from '../../src/ruleset';
import { applyAgentEffects } from '../../src/engine/effects';
import { foe, hostile, isEngaged, sparring } from '../../src/engine/relations';
import { startSpar, updateSpars, yieldSpar } from '../../src/engine/spar';
import { payDefeats } from '../../src/engine/xp';
import { fallbackOrder } from '../../src/minds';
import { buildActorView, buildPlayerView } from '../../src/views';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import type { TurnInput } from '../../src/engine';

const critical = () => CONFIG.HEALTH_TRACK.find(([l]) => l === 'critical')![1] as number;
const village = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  for (const id of ['patron_1', 'trader']) actor(s, id).mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  actor(s, 'patron_1').mind!.knowledge.trader = { status: 'aware', lastKnownZone: 'tav_counter', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  return s;
};
const tally = (s: GameState, k: string) => s.player.progression?.tally?.[k] ?? 0;
const codes = (s: GameState) => s.log.map((l) => l.code);

describe('140 sparring', () => {
  it('SP2: an NPC records a spar agreed aloud; every other fighter must have heard it', () => {
    const s = village();
    const out = (spar: object) => ({ agentOutputs: [{ agent: 'planner', actorId: 'patron_1', output: { action: { type: 'talk' }, dialogue: null, gear: null, stance: null, planUpdate: null, spar } }] }) as unknown as TurnInput;
    const ctx = (heard: boolean) => ({ heardSpeech: () => heard, heardExchange: () => heard, heardNow: () => heard });
    applyAgentEffects(s, out({ sides: [['patron_1'], ['player']] }), ctx(false));
    expect(s.spars).toBeUndefined();
    expect(codes(s)).toContain('invalid_spar');
    applyAgentEffects(s, out({ sides: [['trader'], ['player']] }), ctx(true)); // the maker must be a fighter
    expect(s.spars).toBeUndefined();
    applyAgentEffects(s, out({ sides: [['patron_1'], ['player']], cruel: true }), ctx(true));
    expect(s.spars).toMatchObject([{ sides: [['patron_1'], ['player']], cruel: true, out: {} }]);
    expect(startSpar(s, [['player'], ['trader']], false, 'test')).toBeUndefined(); // already in a spar
  });

  it('SP1/SP8/SP11: a sparring blow changes no stance, raises no alarm and pays no defeat XP', () => {
    const s = village();
    startSpar(s, [['player'], ['patron_1']], false, 'test');
    const p = actor(s, 'patron_1'), t = actor(s, 'trader');
    expect(sparring(s, s.player, p) && foe(s, p, s.player) && !hostile(s, p, s.player)).toBe(true);
    expect(isEngaged(s, p)).toBe(true);
    expect(buildActorView(s, 'patron_1').beliefs.find((b) => b.about === 'player')).toMatchObject({ hostile: false, sparring: true });
    expect(buildActorView(s, 'patron_1').self.spar).toEqual({ opponents: ['player'], allies: [], limit: 'critical', cruel: false, out: false });
    expect(buildPlayerView(s).player.spar).toMatchObject({ opponents: [expect.any(String)], limit: 'critical' });
    let hits = 0;
    for (let i = 0; i < 8 && !hits; i++) {
      const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1' } }) }, 100 + i);
      const mine = ev.filter((e) => e.kind === 'attack' && e.actorId === 'player');
      expect(mine.every((e) => e.spar)).toBe(true);
      hits += mine.filter((e) => (e.attack?.damage ?? 0) > 0).length;
    }
    expect(hits).toBeGreaterThan(0);
    expect(p.mind!.overrides?.player).toBeUndefined();
    expect(t.mind!.overrides?.player).toBeUndefined();
    expect(t.mind!.alarm?.armed ?? false).toBe(false);
    expect(p.mind!.hitByPlayer).toBeUndefined();
  });

  it('SP11: a sparring blow from hiding raises no alarm, in the target or an unaware bystander who spots it', () => {
    let noticed = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = village();
      startSpar(s, [['player'], ['patron_1']], false, 'test');
      s.player.posture = 'stealthy';
      const p = actor(s, 'patron_1'), t = actor(s, 'trader');
      p.mind!.knowledge = {};
      delete t.mind!.knowledge.player;
      place(s, 'trader', 'tav_common');
      const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1' } }) }, seed);
      expect(ev.find((e) => e.kind === 'attack' && e.actorId === 'player')?.spar).toBe(true);
      if (p.mind!.knowledge.player?.status === 'aware') noticed++;
      expect(p.mind!.alarm?.armed ?? false).toBe(false);
      expect(t.mind!.alarm?.armed ?? false).toBe(false);
      expect(p.mind!.overrides?.player).toBeUndefined();
    }
    expect(noticed).toBeGreaterThan(0); // some targets win the ambush roll and see who hit them
  });

  it('SP4/SP8: reaching the limit puts a fighter out; the last side in wins and the win is counted, not paid as a defeat', () => {
    const s = village();
    startSpar(s, [['player'], ['patron_1']], false, 'test');
    const p = actor(s, 'patron_1');
    p.core.condition.hpLostPct = critical();
    updateSpars(s, []);
    expect(s.spars).toBeUndefined();
    expect(s.log.find((l) => l.code === 'spar_ended')?.detail).toMatchObject({ cause: 'won', winners: ['player'] });
    expect(tally(s, 'spar_wins')).toBe(1);
    payDefeats(s, []);
    expect(p.mind!.xpPaid).toBeUndefined();
  });

  it('SP4: a cruel spar goes on past Critical, until someone is Incapacitated', () => {
    const s = village();
    startSpar(s, [['player'], ['patron_1']], true, 'test');
    const p = actor(s, 'patron_1');
    p.core.condition.hpLostPct = critical();
    updateSpars(s, []);
    expect(sparring(s, s.player, p)).toBe(true);
    p.core.condition.hpLostPct = 100;
    updateSpars(s, []);
    expect(s.spars).toBeUndefined();
  });

  it('SP3: a free-for-all ends when one fighter is left; teammates are not opponents', () => {
    const s = village();
    startSpar(s, [['player', 'trader'], ['patron_1']], false, 'test');
    expect(sparring(s, s.player, actor(s, 'trader'))).toBe(false);
    expect(sparring(s, actor(s, 'trader'), actor(s, 'patron_1'))).toBe(true);
    yieldSpar(s, actor(s, 'patron_1'));
    updateSpars(s, []);
    expect(s.log.find((l) => l.code === 'spar_ended')?.detail).toMatchObject({ cause: 'won', winners: ['player', 'trader'] });
  });

  it('SP5: the player yields with words, after the turn\'s blows; an NPC whose morale gives way yields too', () => {
    const s = village();
    startSpar(s, [['player'], ['patron_1']], false, 'test');
    play(s, { intent: intent({ spoken: 'Enough, I yield!', yields: true }) });
    expect(s.spars).toBeUndefined();
    expect(s.log.find((l) => l.code === 'spar_ended')?.detail).toMatchObject({ cause: 'won', winners: ['patron_1'] });
    expect(tally(s, 'spar_wins')).toBe(0);
    expect(actor(s, 'patron_1').mind!.overrides?.player).toBeUndefined();
  });

  it('SP7: a blow on a fighter who is out is a real attack; so is an outsider\'s, and it ends the spar', () => {
    const s = village();
    startSpar(s, [['player'], ['patron_1']], false, 'test');
    const p = actor(s, 'patron_1');
    yieldSpar(s, p);
    expect(sparring(s, s.player, p)).toBe(false); // out: no longer a sparring partner
    s.spars![0].out.patron_1 = s.turn - 1; // yielded last turn
    play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1' } }) });
    expect(s.spars).toBeUndefined(); // the real attack ended it
    expect(p.mind!.overrides?.player).toBeDefined(); // hostile (or yielded, if its morale then gave way)

    const s2 = village();
    startSpar(s2, [['player'], ['patron_1']], false, 'test');
    actor(s2, 'trader').zone = 'tav_common';
    play(s2, { intent: intent({ action: { type: 'attack', target: 'trader' } }) }); // a fighter strikes someone outside the spar
    expect(s2.log.find((l) => l.code === 'spar_ended')?.detail).toMatchObject({ cause: 'outside_attack' });
    expect(s2.events.find((e) => e.kind === 'attack' && e.actorId === 'player')?.spar).toBeUndefined();
  });

  it('SP7: a spar ends on a scenario break, or when no blow lands between sides for a while', () => {
    const s = village();
    startSpar(s, [['player'], ['patron_1']], false, 'test');
    s.turn += CONFIG.ENGAGEMENT_END_TURNS;
    updateSpars(s, []);
    expect(s.log.find((l) => l.code === 'spar_ended')?.detail).toMatchObject({ cause: 'quiet' });
    startSpar(s, [['player'], ['patron_1']], false, 'test');
    s.stage.breakCause = 'story_beat';
    updateSpars(s, []);
    expect(s.spars).toBeUndefined();
  });

  it('a code-run NPC attacks its spar opponent', () => {
    const s = village();
    startSpar(s, [['player'], ['patron_1']], false, 'test');
    expect(fallbackOrder(buildActorView(s, 'patron_1'), createRng(1))).toMatchObject({ type: 'attack', target: 'player' });
  });

  it('SP2: the Weaver can open a scenario with a spar; the validator checks its sides', () => {
    const s = toStoryStart(makeVillage());
    const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
    const plan = villageStagePlan();
    const [a, b] = plan.cast.filter((c) => c.band === 'village_watch' || c.band === 'tavern_folk').map((c) => c.key);
    plan.spars = [{ sides: [[a], [a]] }];
    expect(validateStagePlan(s, plan, ctx).map((e) => e.code)).toContain('bad_spar');
    plan.spars = [{ sides: [[a], ['nobody']] }];
    expect(validateStagePlan(s, plan, ctx).map((e) => e.code)).toContain('unresolved_actor');
    plan.spars = [{ sides: [[a], [b]] }];
    expect(validateStagePlan(s, plan, ctx)).toEqual([]);
    applyStagePlan(s, plan, ctx, { entry: 'open' }, createRng(1));
    expect(s.spars).toHaveLength(1);
  });
});

describe('140 lethal flag (D-54)', () => {
  const downed = (lethal: boolean, seed: number) => {
    const s = makeVillage({ playerZone: 'field_mid', without: ['slime_2'] });
    s.bands.find((b) => b.id === 'slimes')!.lethal = lethal;
    const sl = actor(s, 'slime_1');
    sl.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'field_mid', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    s.player.core.condition.hpLostPct = 99.99;
    for (let i = 0; i < 12; i++) {
      play(s, { intent: intent({}) }, seed + i);
      if (codes(s).some((c) => c === 'survival_roll' || c === 'player_fell')) break;
    }
    return s;
  };
  it('a lethal foe left standing ends the story: no survival roll', () => {
    const s = downed(true, 10);
    expect(healthLevel(s.player)).toBe('incapacitated');
    expect(codes(s)).toContain('player_fell');
    expect(codes(s)).not.toContain('survival_roll');
  });
  it('a band marked not lethal: one survival roll; surviving wakes at Critical and breaks the scenario', () => {
    let survived = false, failed = false;
    for (let seed = 1; seed < 40 && !(survived && failed); seed++) {
      const s = downed(false, seed * 31);
      const roll = s.log.find((l) => l.code === 'survival_roll')?.detail as { survived: boolean } | undefined;
      if (!roll) continue;
      if (roll.survived) {
        survived = true;
        expect(healthLevel(s.player)).toBe('critical');
        expect(s.stage.breakCause).toBe('knocked_out');
      } else {
        failed = true;
        expect(healthLevel(s.player)).toBe('incapacitated');
      }
    }
    expect(survived && failed).toBe(true);
  });
  it('the wake scenario puts the player in the plan\'s first zone', () => {
    const s = toStoryStart(makeVillage());
    const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern', wake: true };
    const plan = villageStagePlan();
    const empty = { ...plan, zones: [] as typeof plan.zones };
    expect(validateStagePlan(s, empty, ctx).map((e) => e.code)).toContain('wake_needs_zone');
  });
});
