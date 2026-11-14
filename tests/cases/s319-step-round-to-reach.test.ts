// 319 BF71 (BG-247): closing in for a blow keeps no gap from the one it strikes and stops at the blow's reach; a straight-line
// spot that is taken makes it step round to the nearest free spot at that reach; hemmed in on every side, the blow is lost
// with no_room. A walk's end keeps PLACE_GAP_M (0.2 m) from everyone else, with no one let off for standing near its start.
import { describe, expect, it } from 'vitest';
import type { Actor, GameEvent, GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { CONFIG } from '../../src/config';
import { spawnNpc } from '../../src/library/spawn';
import { TP } from '../../src/library/templateIds';
import { SK } from '../../src/library/skillIds';
import { walkLeg } from '../../src/engine/position';

const room = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  s.clocks.time = CONFIG.TIME_OF_DAY_FROM.evening;
  const z = s.zones.find((x) => x.id === 'tav_common')!;
  z.rect = { x: 0, y: 0, w: 20, d: 20 };
  s.player.pos = { x: 0, y: 0 };
  return s;
};
const at = (s: GameState, id: string, x: number, y: number): Actor => {
  let a = s.actors.find((q) => q.id === id);
  if (!a) { a = spawnNpc(null, TP.patron, { id, zone: 'tav_common', placeId: s.player.placeId, bandId: 'tavern_folk', name: id, storyId: s.storyId }); s.actors.push(a); }
  a.zone = 'tav_common'; a.placeId = s.player.placeId; a.pos = { x, y };
  return a;
};
const fists = (id: string) => plannerOut(id, act('attack', 'player', { skill: SK.unarmed_strike, item: 'unarmed' }));
const d = (a: { pos?: { x: number; y: number } }, b: { pos?: { x: number; y: number } }) => Math.hypot(a.pos!.x - b.pos!.x, a.pos!.y - b.pos!.y);
const lost = (ev: GameEvent[], id: string) => ev.find((e) => e.actorId === id && e.kind === 'wasted');
const struck = (ev: GameEvent[], id: string) => ev.some((e) => e.actorId === id && e.kind === 'attack');
const agent = (a: Actor) => { a.mind!.control = 'agent'; (a.mind!.overrides ??= {}).player = 'hostile'; return a; };

describe('319 stepping round to reach', () => {
  it('a punch from 2 m at someone with a bystander on the line in lands after a step round', () => {
    const s = room();
    const by = at(s, 'trader', 0.6, 0);
    by.asleep = { since: 0 }; // stands still
    const g = agent(at(s, 'brawler', 2, 0)); // bare hands: 0.7 m
    const ev = play(s, { intent: intent(), agentOutputs: [fists(g.id)] });
    expect(lost(ev, g.id)).toBeUndefined();
    expect(struck(ev, g.id)).toBe(true);
    expect(d(g, s.player)).toBeLessThanOrEqual(0.7 + 0.01);
    expect(d(g, by)).toBeGreaterThanOrEqual(CONFIG.PLACE_GAP_M - 0.01);
  });

  it('three with fists on one target all reach him, each on a free spot', () => {
    const s = room();
    const ids = ['f1', 'f2', 'f3'];
    agent(at(s, 'f1', 2, 0)); agent(at(s, 'f2', -2, 0.1)); agent(at(s, 'f3', 0.1, 2));
    const ev = play(s, { intent: intent(), agentOutputs: ids.map(fists) });
    const xs = ids.map((id) => s.actors.find((a) => a.id === id)!);
    for (const a of xs) { expect(lost(ev, a.id), a.id).toBeUndefined(); expect(d(a, s.player)).toBeLessThanOrEqual(0.71); }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(d(xs[i], xs[j])).toBeGreaterThanOrEqual(CONFIG.PLACE_GAP_M - 0.01);
  });

  it('a target hemmed in on every side: the blow is lost with no_room, not out of reach', () => {
    const s = room();
    for (let i = 0; i < 12; i++) {
      const t = (2 * Math.PI * i) / 12;
      at(s, `wall_${i}`, 0.69 * Math.cos(t), 0.69 * Math.sin(t)).asleep = { since: 0 };
    }
    const g = agent(at(s, 'brawler', 3, 0.3));
    const ev = play(s, { intent: intent(), agentOutputs: [fists(g.id)] });
    expect(lost(ev, g.id)?.reason).toBe('no_room');
  });

  it('two walkers heading for the same spot end at least PLACE_GAP_M apart; none is let off for being near the start', () => {
    const s = room();
    const a = at(s, 'guard_1', 5, 0), b = at(s, 'trader', 0, 5);
    walkLeg(s, a, { zone: 'tav_common', pos: { x: 0, y: 0.1 } }, 10, 0, a);
    walkLeg(s, b, { zone: 'tav_common', pos: { x: 0, y: 0.1 } }, 10, 0, b);
    expect(d(a, b)).toBeGreaterThanOrEqual(CONFIG.PLACE_GAP_M - 0.01);
    const c = at(s, 'patron_1', b.pos!.x + 0.1, b.pos!.y); // starts on top of b, walks a step past it
    walkLeg(s, c, { zone: 'tav_common', pos: { x: b.pos!.x - 0.05, y: b.pos!.y } }, 1, 0, c);
    expect(d(c, b)).toBeGreaterThan(0.09); // never ends nearer than it began
  });

  it('turn 104 of the story: Hob, at the drover\'s side, lands his punch with Osric beside the line in and Sedge behind', () => {
    const s = room();
    s.player.pos = { x: 0.086, y: -1.315 };
    at(s, 'trader', 0, -2).asleep = { since: 0 }; // Sedge
    at(s, 'guard_1', -0.672, 0.095).asleep = { since: 0 }; // Osric
    at(s, 'drover', 0.376, 1.008).asleep = { since: 0 };
    const hob = agent(at(s, 'hob', 0.376, 1.008));
    const ev = play(s, { intent: intent(), agentOutputs: [fists(hob.id)] });
    expect(lost(ev, hob.id)).toBeUndefined();
    expect(struck(ev, hob.id)).toBe(true);
  });
});
