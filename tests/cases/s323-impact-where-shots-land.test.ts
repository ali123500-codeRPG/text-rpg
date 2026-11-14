// 323 BF73 (BG-251): a shot or throw, hit or miss, sounds where it lands: an impact event by its target, at its spot, Loud on
// armour, a shield or a hard surface (a miss indoors), Raised on flesh or soft ground (a miss outdoors). Those it reaches that
// the attack didn't are alarmed and get to think; a missed target notices the miss by it, no longer by "feeling" it; the
// shooter stays hidden. Melee makes no impact.
import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState } from '../../src/types';
import { beside, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { plannerActors } from '../../src/agents/game';
import { earlierLine } from '../../src/views';

const archer = (zone = 'tav_common', skill = 300): GameState => {
  const s = makeVillage({ playerZone: zone, without: ['slime_1', 'slime_2', 'guard_1'] });
  s.clocks.time = CONFIG.TIME_OF_DAY_FROM.evening + 30;
  s.player.posture = 'stealthy';
  for (const a of s.actors) delete a.mind!.knowledge.player; // nobody knows the player is there
  const p = s.actors.find((a) => a.id === 'patron_1')!;
  p.zone = zone; p.placeId = s.zones.find((z) => z.id === zone)!.placeId;
  beside(s, 'patron_1', 'player', 5);
  const t = s.actors.find((a) => a.id === 'trader')!;
  t.zone = zone; t.placeId = p.placeId;
  beside(s, 'trader', 'patron_1', 2); // a bystander beside the target
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
  s.player.core.skills[SK.ranged_light] = { raw: skill, state: 'normal' };
  for (const k of [SK.sneaking, SK.combat_stealth]) s.player.core.skills[k] = { raw: 400, state: 'normal' }; // the stealth roll keeps the shooter hidden
  return s;
};
const shoot = (s: GameState, seed?: number, part: string | null = null) =>
  play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', skill: SK.ranged_light, item: 'bow', ...(part ? { targetPart: part } : {}) } }) }, seed);
const impactOf = (ev: GameEvent[]) => ev.find((e) => e.kind === 'impact');
/** shots until one misses (missed or dodged), with skill 0 */
const aMiss = (s: GameState): GameEvent[] => {
  for (let seed = 1; seed < 200; seed++) {
    const t = structuredClone(s);
    const ev = shoot(t, seed);
    const at = ev.find((e) => e.kind === 'attack');
    if (at?.attack && ['missed', 'dodged'].includes(at.attack.outcome)) { Object.assign(s, t); return ev; }
  }
  throw new Error('no miss');
};

describe('323 a shot sounds where it lands', () => {
  it('a hit on bare flesh: a Raised impact at the target, by the target, never naming the shooter', () => {
    const s = archer();
    const ev = shoot(s);
    const im = impactOf(ev)!;
    expect(im).toBeDefined();
    expect(im).toMatchObject({ actorId: 'patron_1', impact: 'soft', noise: 'raised', zone: 'tav_common' });
    expect(im.perception.trader).toBeDefined(); // the bystander hears the thud beside them
    expect(im.perception.player).toBeUndefined(); // the shooter saw their own shot
    const went = ev.find((e) => e.kind === 'move' && e.actorId === 'patron_1');
    if (went?.fromPos) expect(im.pos).toEqual(went.fromPos); // where the target stood when it landed
    expect(im.pos).not.toEqual(ev.find((e) => e.kind === 'attack')!.pos); // not where the shooter stood
    expect(ev.find((e) => e.kind === 'attack')!.ranged).toBe(true);
  });

  it('a hit on armour is Loud', () => {
    const s = archer();
    const p = s.actors.find((a) => a.id === 'patron_1')!;
    p.core.inventory.push({ id: 'mail', itemId: IT.mail_hauberk, equippedIn: ['armor'] });
    const ev = shoot(s, undefined, 'general');
    const at = ev.find((e) => e.kind === 'attack')!;
    expect(at.attack!.location).toBe('general');
    expect(impactOf(ev)).toMatchObject({ impact: 'hard', noise: 'loud' });
  });

  it('a miss indoors rings off the wall (Loud); outdoors it thuds into the grass (Raised)', () => {
    const indoor = archer('tav_common', 0);
    expect(impactOf(aMiss(indoor))).toMatchObject({ impact: 'hard', noise: 'loud' });
    const out = archer('field_edge', 0);
    out.zones.find((z) => z.id === 'field_edge')!.outdoor = true;
    expect(impactOf(aMiss(out))).toMatchObject({ impact: 'soft', noise: 'raised' });
  });

  it('missed from hiding, the target no longer feels it but hears it land: alarmed, gets to think, shooter still unknown', () => {
    const s = archer('tav_common', 0);
    const ev = aMiss(s);
    const p = s.actors.find((a) => a.id === 'patron_1')!;
    const at = ev.find((e) => e.kind === 'attack')!;
    expect(at.perception.patron_1?.cue).not.toBe('touch');
    const im = impactOf(ev)!;
    expect(im.perception.patron_1).toBeDefined();
    expect(p.mind!.alarm?.armed).toBe(true);
    expect(['unaware', 'suspicious']).toContain(p.mind!.knowledge.player?.status ?? 'unaware'); // alarmed, it may sense someone; never where the shot came from
    p.mind!.control = 'agent';
    expect(plannerActors(s)).toContain('patron_1');
    expect(earlierLine(s, p, im)).toMatch(/shot or thrown strike beside you/);
  });

  it('a melee blow makes no impact', () => {
    const s = archer();
    beside(s, 'patron_1', 'player', 0.5);
    s.player.core.skills[SK.unarmed_strike] = { raw: 300, state: 'normal' };
    for (const i of s.player.core.inventory) delete i.equippedIn;
    const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', skill: SK.unarmed_strike } }) });
    expect(ev.some((e) => e.kind === 'attack')).toBe(true);
    expect(impactOf(ev)).toBeUndefined();
  });
});
