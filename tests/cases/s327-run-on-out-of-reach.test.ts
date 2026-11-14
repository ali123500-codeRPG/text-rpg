// 327 BG-255 (NV9 b): a blow the close-in walk (ZP3, the move time) leaves out of reach is not swung at nothing: the striker
// runs on at the target on its main time, exactly as a dash (AE2), and strikes next turn. The same for the player (s171),
// an agent's blow, a code-run fighter's combat-list blow, and an agent blow gone stale that code takes over (TP2).
import { describe, expect, it } from 'vitest';
import type { Actor, GameEvent, GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { CONFIG } from '../../src/config';
import { spawnNpc } from '../../src/library/spawn';
import { TP } from '../../src/library/templateIds';
import { SK } from '../../src/library/skillIds';

const field = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
  s.clocks.time = CONFIG.TIME_OF_DAY_FROM.evening;
  const z = s.zones.find((x) => x.id === 'tav_common')!;
  z.rect = { x: 0, y: 0, w: 40, d: 40 };
  s.player.pos = { x: 0, y: 0 };
  return s;
};
const at = (s: GameState, id: string, x: number, y: number): Actor => {
  const a = spawnNpc(null, TP.patron, { id, zone: 'tav_common', placeId: s.player.placeId, bandId: 'tavern_folk', name: id, storyId: s.storyId });
  s.actors.push(a);
  a.pos = { x, y };
  (a.mind!.overrides ??= {}).player = 'hostile';
  return a;
};
const fists = (id: string) => plannerOut(id, act('attack', 'player', { skill: SK.unarmed_strike, item: 'unarmed' }));
const d = (a: Actor, b: Actor) => Math.hypot(a.pos!.x - b.pos!.x, a.pos!.y - b.pos!.y);
const lost = (ev: GameEvent[], id: string) => ev.find((e) => e.actorId === id && e.kind === 'wasted');
const struck = (ev: GameEvent[], id: string) => ev.some((e) => e.actorId === id && e.kind === 'attack');
const ran = (ev: GameEvent[], id: string) => ev.filter((e) => e.actorId === id && e.kind === 'move').reduce((n, e) => n + (e.metres ?? 0), 0);

describe('327 running on at a foe out of reach', () => {
  it('an agent\'s punch from 20 m runs on past its move, loses no blow, and lands next turn', () => {
    const s = field();
    const g = at(s, 'brawler', 20, 0);
    g.mind!.control = 'agent';
    const ev = play(s, { intent: intent(), agentOutputs: [fists(g.id)] });
    expect(lost(ev, g.id)).toBeUndefined();
    expect(struck(ev, g.id)).toBe(false);
    expect(s.log.some((l) => l.code === 'ran_on' && l.detail?.actorId === g.id)).toBe(true);
    expect(d(g, s.player)).toBeLessThan(20 - ran(ev, g.id) + 0.01);
    const walked = ev.find((e) => e.actorId === g.id && e.kind === 'move')!.metres!;
    expect(ran(ev, g.id)).toBeGreaterThan(walked + 1); // the move time's walk, then the run on its main time
    const ev2 = play(s, { intent: intent(), agentOutputs: [fists(g.id)] });
    expect(lost(ev2, g.id)).toBeUndefined();
    expect(struck(ev2, g.id)).toBe(true);
  });

  it('within its move it closes in and strikes the same turn, as before', () => {
    const s = field();
    const g = at(s, 'brawler', 3, 0);
    g.mind!.control = 'agent';
    const ev = play(s, { intent: intent(), agentOutputs: [fists(g.id)] });
    expect(struck(ev, g.id)).toBe(true);
    expect(s.log.some((l) => l.code === 'ran_on')).toBe(false);
  });

  it('a code-run fighter\'s combat-list blow runs on the same way', () => {
    const s = field();
    const g = at(s, 'brawler', 20, 0);
    g.mind!.control = 'code';
    g.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    const ev = play(s, { intent: intent() });
    expect(lost(ev, g.id)).toBeUndefined();
    expect(s.log.some((l) => l.code === 'ran_on' && l.detail?.actorId === g.id)).toBe(true);
  });

  it('an agent blow gone stale (TP2) that code takes over runs on too, with no lost blow', () => {
    const s = field();
    const g = at(s, 'brawler', 20, 0);
    g.mind!.control = 'agent';
    g.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    const ev = play(s, { intent: intent(), agentOutputs: [plannerOut(g.id, act('attack', 'player', { skill: SK.unarmed_strike, item: 'unarmed' }), { move: { toZone: 'tav_common', after: true } })] });
    expect(s.log.some((l) => l.code === 'order_dropped' && l.detail?.actorId === g.id)).toBe(true);
    expect(lost(ev, g.id)).toBeUndefined();
    expect(s.log.some((l) => l.code === 'ran_on' && l.detail?.actorId === g.id)).toBe(true);
  });
});
