// 214 NW12, NW14, NW15, NW18–NW22: sleeping and keeping watch. A sleeper perceives nothing, does nothing and is struck
// as unaware; a blow or a loud noise (a shout or louder) wakes it; with Keen Ear (Light Sleeper, NW14) it may hear someone
// hostile come near. The player's sleep stops when someone hostile arrives; still asleep, the player's turns pass with
// nothing done. NPCs sleep by their routines under the same rules, and an awake band member who sees someone hostile
// shouts its sleeping bandmates awake. Sleeping with companions shares the night out in watches, one each, capped at
// 12 hours, the player taking the middle watch.
import { describe, expect, it } from 'vitest';
import type { Actor, GameEvent, GameState, Intent, ParserActionType } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { headTo, installRoutines } from '../../src/minds';
import { now, startClock } from '../../src/time';
import { CONFIG } from '../../src/config';
import { spawnNpc } from '../../src/library/spawn';
import { TP } from '../../src/library/templateIds';
import { PK } from '../../src/library/perkIds';
import { fallAsleep, planNight, wakeByEvent, wakeCalls } from '../../src/engine/sleep';
import { perceptionOf } from '../../src/perception';
import { buildPlayerView } from '../../src/views';
import { HL } from '../../src/library/tableIds';

const act = (type: ParserActionType, target: string | null = null): Intent => ({
  move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: { type, skill: '', target, targetPart: null, item: null, mode: null, approach: '', stance: 'normal' },
});
const turn = (s: GameState, intent: Intent) => { s.turn += 1; return resolveTurn(s, { intent, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };
const quiet = (zone = 'tav_cellar') => makeVillage({ playerZone: zone, without: ['slime_1', 'slime_2', 'patron_1'] });
const companion = (s: GameState, id: string) => {
  const c = spawnNpc(null, TP.patron, { id, zone: s.player.zone, placeId: s.player.placeId, bandId: s.player.bandId, name: id });
  installRoutines(c, 'companion', {}, undefined, s.turn, createRng(1));
  s.actors.push(c);
  return c;
};
const ev = (over: Partial<GameEvent>): GameEvent => ({ id: 'x', turn: 1, actorId: 'guard_1', kind: 'attack', zone: 'tav_cellar', effects: [], noise: 'normal', visibility: 'normal', perception: {}, ...over });

describe('214 sleeping and keeping watch', () => {
  it('NW12: alone and undisturbed, a sleep runs its 8 hours, heals a rest per 4 hours and wakes you rested', () => {
    const s = quiet();
    startClock(s, 'evening');
    s.player.core.condition.hpLostPct = 80;
    const t0 = now(s);
    turn(s, act('sleep'));
    expect(now(s) - t0).toBe(480 + 1);
    expect(s.log.filter((l) => l.code === 'healed' && (l.detail as { source: string }).source === HL.rest)).toHaveLength(2);
    expect(s.player.asleep).toBeUndefined();
    expect(s.night).toBeUndefined();
    expect(s.log.some((l) => l.code === 'woke' && (l.detail as { why: string }).why === 'rested')).toBe(true);
  });
  it('NW12/NW18: someone hostile arriving stops the sleep; still asleep, your turn passes with nothing done', () => {
    const s = quiet();
    startClock(s, 'evening');
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    (g.mind!.overrides ??= {}).player = 'hostile';
    headTo(s, g, 'tav_cellar');
    const t0 = now(s);
    turn(s, act('sleep'));
    expect(s.log.some((l) => l.code === 'sleep_stopped')).toBe(true);
    expect(now(s) - t0).toBeLessThan(480);
    expect(g.zone).toBe('tav_cellar');
    expect(s.player.asleep).toBeDefined(); // no Keen Ear: nothing woke you
    expect(s.night).toBeDefined();
    // asleep, you see no one; what you type is not done, and the guard's blow lands on an unaware sleeper and wakes you
    expect(buildPlayerView(s).actors).toEqual([]);
    const before = s.player.zone;
    const evs = turn(s, { ...act('observe'), move: { toZone: 'tav_common' } });
    expect(s.player.zone).toBe(before);
    const blow = evs.find((e) => e.kind === 'attack' && e.target === s.player.id);
    if (blow) {
      expect(JSON.stringify(blow)).toContain('"unaware":true');
      expect(s.log.some((l) => l.code === 'woke' && (l.detail as { why: string }).why === 'blow')).toBe(true);
      expect(s.player.asleep).toBeUndefined();
    }
  });
  it('NW14: a blow or a loud noise wakes a sleeper; normal talk does not; asleep it perceives nothing but the blow', () => {
    const s = quiet();
    fallAsleep(s, s.player, now(s) + 480);
    expect(perceptionOf(ev({ kind: 'speak', target: undefined, noise: 'normal' }), s, s.player)).toBeNull();
    expect(perceptionOf(ev({ target: s.player.id }), s, s.player)).toMatchObject({ cue: 'touch' });
    wakeByEvent(s, ev({ kind: 'speak', noise: 'normal' }));
    expect(s.player.asleep).toBeDefined();
    wakeByEvent(s, ev({ kind: 'call_help', noise: 'loud' }));
    expect(s.player.asleep).toBeUndefined();
    fallAsleep(s, s.player, now(s) + 480);
    wakeByEvent(s, ev({ target: s.player.id }));
    expect(s.player.asleep).toBeUndefined();
    expect(s.log.filter((l) => l.code === 'woke').map((l) => (l.detail as { why: string }).why)).toEqual(['noise', 'blow']);
  });
  it('NW14/NW19: with Keen Ear, a sharp-eared sleeper hears someone hostile walk in and wakes aware of them', () => {
    const s = quiet();
    startClock(s, 'evening');
    s.player.core.perks.push({ perkId: PK.keen_ear, source: 'level', gainedTurn: 0 });
    CONFIG.WAKE_GRADE.quiet = 'none'; // an easy check, so the seeded roll passes
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    (g.mind!.overrides ??= {}).player = 'hostile';
    headTo(s, g, 'tav_cellar');
    turn(s, act('sleep'));
    expect(s.log.some((l) => l.code === 'wake_check')).toBe(true);
    const woke = s.log.find((l) => l.code === 'woke' && (l.detail as { actorId: string }).actorId === s.player.id);
    expect((s.log.find((l) => l.code === 'wake_check')!.detail as { pass: boolean }).pass).toBe(true);
    {
      expect(woke!.detail).toMatchObject({ why: 'heard', by: 'guard_1' });
      expect(s.player.asleep).toBeUndefined();
      expect(s.night).toBeUndefined(); // woken, your night is over
    }
  });
  it('NW20: an NPC sleeps by its routine; asleep it hears no words, and a shout wakes it', () => {
    const s = quiet('tav_common');
    const b = s.actors.find((a) => a.id === 'trader')!;
    b.mind!.slots = { ...b.mind!.slots, bed: 'tav_cellar' };
    b.zone = 'tav_cellar'; delete b.pos;
    s.clocks.time = CONFIG.TIME_OF_DAY_FROM.night + 30;
    turn(s, act('observe'));
    expect(b.asleep).toBeDefined();
    expect(perceptionOf(ev({ actorId: s.player.id, kind: 'speak', zone: 'tav_cellar', noise: 'normal' }), s, b)).toBeNull();
    wakeByEvent(s, ev({ actorId: s.player.id, kind: 'speak', zone: 'tav_cellar', noise: 'loud' }));
    expect(b.asleep).toBeUndefined();
    // it doesn't fall straight back to sleep
    turn(s, act('observe'));
    expect(b.asleep).toBeUndefined();
  });
  it('NW21: an awake bandmate who sees someone hostile shouts the sleepers awake', () => {
    const s = quiet();
    const c = companion(s, 'comp');
    fallAsleep(s, s.player, now(s) + 480);
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    expect(wakeCalls(s)).toEqual([]);
    (g.mind!.overrides ??= {}).player = 'hostile';
    g.zone = 'tav_cellar'; delete g.pos;
    c.mind!.knowledge.guard_1 = { status: 'aware', lastKnownZone: 'tav_cellar', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    expect(wakeCalls(s)).toEqual([expect.objectContaining({ actorId: 'comp', type: 'call_help' })]);
  });
  it('NW15/NW22: with companions the night is shared out in watches, one each, everyone sleeping 8 hours, capped at 12', () => {
    const s = quiet();
    startClock(s, 'evening');
    const one = companion(s, 'comp_a');
    expect(planNight(s, 480, [one])).toMatchObject({ end: now(s) + 720 }); // a pair: capped at 12 hours, 6-hour watches
    const two = companion(s, 'comp_b');
    const n = planNight(s, 480, [one, two]);
    expect(n.end - n.start).toBe(720); // three: 12 hours, 4-hour watches
    expect(n.watches.map((w) => [w.actorId, w.to - w.from])).toEqual([['comp_a', 240], [s.player.id, 240], ['comp_b', 240]]);
    expect(planNight(s, 480, [one, two, { id: 'comp_c' } as Actor]).end - now(s)).toBe(640); // four: 10 hours 40
    // the whole night runs in one turn when nothing happens; you sleep 8 hours of it
    s.player.core.condition.hpLostPct = 80;
    const t0 = now(s);
    turn(s, act('sleep'));
    expect(now(s) - t0).toBe(720 + 1);
    expect(s.log.some((l) => l.code === 'woke' && (l.detail as { actorId: string; why: string }).actorId === s.player.id && (l.detail as { why: string }).why === 'watch')).toBe(true);
    expect(s.log.filter((l) => l.code === 'healed' && (l.detail as { source: string }).source === HL.rest)).toHaveLength(2);
    expect([s.player, one, two].map((a) => !!a.asleep)).toEqual([false, false, false]);
  });
});
