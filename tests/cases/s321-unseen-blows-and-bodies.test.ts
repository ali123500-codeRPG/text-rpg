// 321 BF65 (BG-241): a blow from someone hidden is felt by the one struck and seen by anyone who sees them (the hit, the fall,
// the death), while the striker stays hidden; that raises the alarm and gives a Planner call to react. A body come upon is
// found once. On a sleep step but awake, someone reads as lying awake, never asleep.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { beside, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { plannerActors } from '../../src/agents/game';
import { earlierLine } from '../../src/views';

const hidden = (night = false): GameState => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  s.clocks.time = CONFIG.TIME_OF_DAY_FROM[night ? 'night' : 'evening'] + 30;
  s.player.posture = 'stealthy';
  for (const a of s.actors) delete a.mind!.knowledge.player; // nobody knows the player is there
  s.player.core.skills[SK.unarmed_strike] = { raw: 300, state: 'normal' };
  beside(s, 'patron_1', 'player', 0.5);
  beside(s, 'trader', 'patron_1', 1.5);
  return s;
};
const hit = (s: GameState) => play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', skill: SK.unarmed_strike } }) });

describe('321 unseen blows and bodies', () => {
  it('a shot from hiding: the victim feels it, a bystander sees it, both are alarmed and get to think; the shooter stays unknown', () => {
    const s = hidden();
    const p = s.actors.find((a) => a.id === 'patron_1')!, t = s.actors.find((a) => a.id === 'trader')!;
    beside(s, 'patron_1', 'player', 5);
    beside(s, 'trader', 'patron_1', 1.5);
    for (const i of s.player.core.inventory) delete i.equippedIn;
    s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
    s.player.core.skills[SK.ranged_light] = { raw: 300, state: 'normal' };
    for (const k of [SK.sneaking, SK.combat_stealth]) s.player.core.skills[k] = { raw: 400, state: 'normal' }; // the stealth roll keeps the shooter hidden
    const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', skill: SK.ranged_light, item: 'bow' } }) });
    expect(p.core.condition.hpLostPct).toBeGreaterThan(0);
    const st = ev.find((e) => e.kind === 'struck' && e.actorId === 'patron_1')!;
    expect(st.perception.patron_1).toMatchObject({ cue: 'touch' });
    expect(st.perception.trader).toBeDefined();
    expect(st.perception.player).toBeUndefined(); // the player saw their own blow
    expect(t.mind!.alarm?.armed).toBe(true);
    expect(p.mind!.alarm?.armed).toBe(true);
    expect(t.mind!.knowledge.player?.status ?? 'unaware').toBe('unaware');
    expect(earlierLine(s, t, st)).toMatch(/struck by someone unseen/);
    p.mind!.control = 'agent'; t.mind!.control = 'agent';
    expect(plannerActors(s)).toEqual(expect.arrayContaining(['patron_1', 'trader']));
  });

  it('a body come upon is found once: alarm, and never found again', () => {
    const s = hidden();
    const p = s.actors.find((a) => a.id === 'patron_1')!, t = s.actors.find((a) => a.id === 'trader')!;
    p.core.condition.hpLostPct = 200; // dead
    const ev = play(s);
    expect(ev.filter((e) => e.kind === 'found_body' && e.actorId === 'trader' && e.target === 'patron_1')).toHaveLength(1);
    expect(t.mind!.alarm?.armed).toBe(true);
    expect(earlierLine(s, t, ev.find((e) => e.kind === 'found_body')!)).toMatch(/found .* lying dead/);
    expect(play(s).some((e) => e.kind === 'found_body')).toBe(false);
  });

  it('one that saw the fall never "finds" the body later', () => {
    const s = hidden();
    const t = s.actors.find((a) => a.id === 'trader')!;
    s.actors.find((a) => a.id === 'patron_1')!.core.condition.hpLostPct = CONFIG.HEALTH_TRACK.find(([l]) => l === 'injured')?.[1] ?? 90;
    s.player.core.skills[SK.unarmed_strike] = { raw: 600, state: 'normal' };
    for (let i = 0; i < 4 && s.actors.find((a) => a.id === 'patron_1')!.core.condition.hpLostPct < 100; i++) hit(s);
    const later = [...play(s), ...play(s)];
    expect(s.actors.find((a) => a.id === 'patron_1')!.core.condition.hpLostPct).toBeGreaterThanOrEqual(100);
    expect(t.mind!.bodiesFound).toContain('patron_1');
    expect(later.some((e) => e.kind === 'found_body')).toBe(false);
  });

  it('a sleeper struck awake is no longer shown asleep while its routine still says sleep', () => {
    const s = hidden(true);
    const p = s.actors.find((a) => a.id === 'patron_1')!;
    play(s); // night: it drops off where it is (no bed given)
    expect(p.asleep).toBeDefined();
    hit(s);
    expect(p.asleep).toBeUndefined();
    const idle = play(s).find((e) => e.actorId === 'patron_1' && e.activity);
    if (idle) expect(idle.activity).not.toBe('sleep');
    expect(p.asleep).toBeUndefined(); // alarmed: it does not drop off again
  });
});
