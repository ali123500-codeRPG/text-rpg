// 186 SD7 window and ledge drops: a drop link is jumped down, never walked; the fall's flat damage comes from the real drop
// (CONFIG.FALL_BANDS) and lands on a leg; a Dodge roll on landing moves it a band (FALL_LANDING_STEP).
import { describe, expect, it } from 'vitest';
import type { GameState, Intent } from '../../src/types';
import { createRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { shortestPath, zoneById } from '../../src/engine/relations';
import { fallDamage, landingStep } from '../../src/ruleset';
import { buildNarrationView } from '../../src/views';
import { checkIntent, checkStagePlan } from '../../src/agents/schema';
import { CONFIG } from '../../src/config';
import { buildActorView } from '../../src/views';
import { mapPath } from '../../src/minds';

/** the bar is an upper floor, 7 m up, with a window over the square */
function upstairs(): GameState {
  const s = makeVillage({ playerZone: 'tav_counter', without: ['slime_1', 'slime_2'] });
  zoneById(s, 'tav_counter')!.height = 7;
  zoneById(s, 'street_square')!.height = 0;
  zoneById(s, 'tav_counter')!.links.push({ to: 'street_square', label: 'the window, down to the square', sight: true, drop: true });
  return s;
}
const jump = (to: string, j = true): Intent => ({ move: { toZone: to, ...(j ? { jump: true } : {}) }, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null });

describe('186 window and ledge drops (SD7)', () => {
  it('fall damage is flat by the drop, and the landing moves it a band', () => {
    expect(fallDamage(2)).toBe(0);
    expect(fallDamage(3)).toBe(CONFIG.FALL_BANDS[0].damage);
    expect(fallDamage(7)).toBe(CONFIG.FALL_BANDS[1].damage);
    expect(fallDamage(12)).toBe(CONFIG.FALL_BANDS[2].damage);
    expect(fallDamage(3, -1)).toBe(0);
    expect(fallDamage(2, 1)).toBe(CONFIG.FALL_BANDS[0].damage);
    expect(fallDamage(12, 1)).toBe(CONFIG.FALL_BANDS[3].damage);
    expect(fallDamage(200, 1)).toBe(CONFIG.FALL_BANDS.at(-1)!.damage); // past the last band it stays
  });
  it('scaling past the human range: falls keep hurting more to about terminal speed, and landings past Critical keep helping', () => {
    expect(fallDamage(20)).toBeGreaterThan(fallDamage(10));
    expect(fallDamage(60)).toBeGreaterThan(fallDamage(20));
    expect(landingStep({ tier: 'critical_success' })).toBe(-1);
    expect(landingStep({ tier: 'critical_success', beyond: 3 })).toBe(-4);
    expect(landingStep({ tier: 'critical_failure', beyond: -2 })).toBe(1); // the bottom end reads its own row
    expect(fallDamage(20, landingStep({ tier: 'critical_success', beyond: 3 }))).toBe(0); // a supernatural landing from 20 m
  });
  it('a drop is seen through but never walked', () => {
    const s = upstairs();
    const walk = shortestPath(s, 'tav_counter', 'street_square');
    expect(walk?.[0]).not.toBe('street_square'); // the walk goes round by the door
    expect(shortestPath(s, 'tav_counter', 'street_square', true)).toEqual(['street_square']);
  });
  it('a jump lands in the zone below, hurts a leg by the drop, and the Narrator sees the fall', () => {
    const s = upstairs();
    s.turn += 1;
    const events = resolveTurn(s, { intent: jump('street_square'), aimed: false, agentOutputs: [], spokespeople: [] }, createRng(3));
    expect(s.player.zone).toBe('street_square');
    const ev = events.find((e) => e.kind === 'move' && e.fall)!;
    expect(ev.fall).toMatchObject({ metres: 7 });
    expect(ev.fall!.damage).toBeGreaterThan(0); // 7 m is the second band; one band down still hurts
    expect(s.player.core.condition.hpLostPct).toBeGreaterThan(0);
    expect(buildNarrationView(s, events).events.find((e) => e.id === ev.id)).toMatchObject({ fall: { metres: 7 } });
  });
  it('code minds path round a drop too (NPCs do not jump yet)', () => {
    const s = upstairs();
    const v = buildActorView(s, 'trader');
    expect(v.map.find((z) => z.id === 'tav_counter')!.links.find((l) => l.to === 'street_square')).toMatchObject({ drop: true });
    expect(mapPath(v.map, 'tav_counter', 'street_square')?.[0]).not.toBe('street_square');
  });
  it('without jump, a move to the zone below walks round', () => {
    const s = upstairs();
    s.turn += 1;
    resolveTurn(s, { intent: jump('street_square', false), aimed: false, agentOutputs: [], spokespeople: [] }, createRng(3));
    expect(s.player.core.condition.hpLostPct).toBe(0);
    expect(s.player.zone).not.toBe('tav_counter');
  });
  it('the Parser may say jump, and the Weaver may mark a link as a drop', () => {
    expect(checkIntent({ move: { toZone: 'z', jump: true }, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null }).value.move).toMatchObject({ jump: true });
    const v = checkStagePlan({ event: { summary: 's', challenge: 'none', gain: 'none' }, places: [], frontiers: [], bands: [], cast: [], seeds: { plans: [], triggers: [], secrets: [] }, rewards: [], hiddenTerms: [], weaverNote: '',
      zones: [{ key: 'z', place: 'p', kind: 'k', name: 'n', look: 'l', links: [{ to: 'y', label: 'the window', sight: true, drop: true }] }] });
    expect(v.value.zones[0].links[0]).toMatchObject({ drop: true });
  });
});
