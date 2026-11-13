// 272 The world clock, stage 3b (AT8, AT56, AT65, AT67, AT68): a rest or a wait outside a fight runs on the world clock
// in steps, and stops when the coming-near check fires (contact; someone closing in within the warning time; a change in
// someone accepted) or a fight is in the player's senses. A rest is deep: any stop breaks it, and it heals by the share
// that ran. Rest, wait and healing items can always be started.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { headTo } from '../../src/minds';
import { now, startClock } from '../../src/time';
import { isActive } from '../../src/engine/relations';
import { CONFIG } from '../../src/config';
import { mechanicsLines } from '../../src/agents/game';
import { checkNear, contact, startWatch, stepS, warnS } from '../../src/engine/comingNear';
import { moveSpeed } from '../../src/engine/speed';
import { IT } from '../../src/library/itemIds';
import { DU, HL } from '../../src/library/tableIds';
import type { Actor, GameEvent, GameState } from '../../src/types';

const rest = intent({ action: { type: 'rest' } });
const tavern = () => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
const wim = (s: GameState) => s.actors.find((a) => a.id === 'patron_1')!;
const at = (s: GameState, a: Actor, x: number, y: number) => { a.zone = s.player.zone; a.placeId = s.player.placeId; a.pos = { x: s.player.pos!.x + x, y: s.player.pos!.y + y }; };
const stopped = (s: GameState) => s.log.find((l) => l.code === 'stretch_stopped')?.detail as { kind: string; why: string; by: string[]; seconds: number } | undefined;

describe('272 the world clock', () => {
  it('AT56: a rest nobody disturbs runs its hour and heals in full; someone walking out past the player does not stop it', () => {
    const s = tavern();
    headTo(s, wim(s), 'street_square', 'weaver'); // a passer-by leaving
    s.player.core.condition.hpLostPct = 50;
    const t = now(s);
    play(s, { intent: rest });
    expect(now(s) - t).toBeCloseTo(60, 6);
    expect(stopped(s)).toBeUndefined();
    expect(s.player.core.condition.hpLostPct).toBeLessThan(26);
  });
  it('AT67: someone whose path ends at the player stops the rest as they close in; the rest heals by the share that ran', () => {
    const s = tavern();
    const w = wim(s);
    w.zone = 'street_square';
    delete w.pos;
    headTo(s, w, 'tav_common', 'weaver');
    w.mind!.knowledge.player = { status: 'tracking', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] } as never;
    s.player.core.condition.hpLostPct = 50;
    const t = now(s);
    const ev = play(s, { intent: rest });
    expect(stopped(s)).toMatchObject({ kind: 'rest', why: 'closing', by: ['patron_1'] });
    const ran = stopped(s)!.seconds;
    expect(ran).toBeLessThan(60 * 60);
    expect(now(s) - t).toBeCloseTo(ran / 60, 1);
    expect(s.player.core.condition.hpLostPct).toBeGreaterThan(49); // a minute's share of a rest
    expect(s.player.core.condition.hpLostPct).toBeLessThan(50);
    expect(mechanicsLines(s, ev)).toContain('Rest stopped after 1 min: someone is coming at you');
  });
  it('AT67: a wait runs to the time named, and its time shows', () => {
    const s = tavern();
    const t = now(s);
    const ev = play(s, { intent: intent({ action: { type: 'wait' } }) });
    expect(now(s) - t).toBeGreaterThan(60);
    expect(s.log.find((l) => l.code === 'time_passed')).toBeDefined();
    expect(mechanicsLines(s, ev).some((l) => l.startsWith('Time passes:'))).toBe(true);
  });
  it('AT8: a healing item works with a foe beside the player', () => {
    const s = makeVillage();
    place(s, 'player', 'field_mid'); // slime_1 is here
    s.player.core.condition.hpLostPct = 50;
    s.player.core.inventory.push({ id: 'dr', itemId: IT.healing_draught, qty: 1 });
    play(s, { intent: intent({ action: { type: 'use_item', item: 'dr' } }) });
    expect(s.player.core.condition.hpLostPct).toBeLessThan(50);
  });
  it('AT27: in a fight a rest is a long action; an attack breaks it (deep) and it heals by the share done', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    at(s, g, 0.5, 0);
    g.mind!.overrides = { player: 'hostile' };
    g.mind!.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    s.mode = 'tactical';
    s.player.react = { s: 0, init: 100, turn: s.turn };
    g.react = { s: 0, init: 50, turn: s.turn };
    s.player.core.condition.hpLostPct = 50;
    const hold = { actorId: 'guard_1', type: 'hold', target: null, skill: null, intent: '', source: 'trigger' } as const;
    play(s, { intent: rest, fired: [hold] });
    expect(s.player.busy).toMatchObject({ row: DU.rest, need: 60 * 60 });
    expect(s.player.busy!.done).toBeGreaterThan(0);
    play(s, { intent: rest, fired: [{ ...hold, type: 'attack', target: 'player' }] });
    expect(s.player.busy).toBeUndefined();
    expect(s.log.some((l) => l.code === 'busy_broken')).toBe(true);
    expect(s.log.some((l) => l.code === 'healed' && (l.detail as { source: string }).source === HL.rest)).toBe(true);
  });
});

describe('272 NPCs on code in a stretch (stage 3c)', () => {
  const hunted = () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    place(s, 'guard_1', 'street_square'); // out of the player's senses
    g.mind!.overrides = { player: 'hostile' };
    g.mind!.knowledge.player = { status: 'hunting', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    return { s, g };
  };
  it('AT63/AT66: a foe hunting the player closes in on code during a rest, and the coming-near check stops it', () => {
    const { s, g } = hunted();
    play(s, { intent: rest });
    expect(g.zone).toBe('tav_common');
    expect(stopped(s)).toMatchObject({ kind: 'rest', by: ['guard_1'] });
    expect(stopped(s)!.seconds).toBeLessThan(60 * 60);
  });
  it('AT63: asleep, the player gets no warning: the night stops when the foe comes in', () => {
    const { s, g } = hunted();
    startClock(s, 'night');
    play(s, { intent: intent({ action: { type: 'sleep' } }) });
    expect(g.zone).toBe('tav_common');
    expect(s.log.find((l) => l.code === 'sleep_stopped')?.detail).toMatchObject({ by: ['guard_1'] });
  });
  it('AT55: a fight out of the player\'s senses runs on code, a blow a round, and does not stop the rest', () => {
    const s = makeVillage({ playerZone: 'tav_cellar', without: ['slime_1', 'slime_2'] });
    const g = s.actors.find((a) => a.id === 'guard_1')!, tr = s.actors.find((a) => a.id === 'trader')!;
    place(s, 'trader', 'field_mid');
    place(s, 'guard_1', 'field_mid');
    g.pos = { x: tr.pos!.x + 1, y: tr.pos!.y };
    g.mind!.overrides = { [tr.id]: 'hostile' };
    g.mind!.knowledge[tr.id] = { status: 'engaged', lastKnownZone: tr.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    const t = now(s);
    play(s, { intent: rest });
    expect(isActive(tr)).toBe(false);
    expect(stopped(s)).toBeUndefined();
    expect(now(s) - t).toBeCloseTo(60, 6);
  });
});

describe('272 the coming-near check', () => {
  const watched = () => {
    const s = tavern();
    const w = wim(s);
    w.zone = 'street_square';
    delete w.pos;
    const watch = startWatch(s, s.player, 'standing');
    return { s, w, watch };
  };
  it('AT67: someone rushing in faster than RUSH_SHARE × their walk fires it within the warning time; a walker passing is listed', () => {
    const check = (speedOf: (walk: number, run: number) => number) => {
      const s = makeVillage({ without: ['slime_1', 'slime_2'] });
      const field = s.zones.find((z) => z.id === 'field_far')!.rect!;
      s.player.zone = 'field_far';
      s.player.pos = { x: field.x - field.w / 2 + 1, y: field.y };
      const w = wim(s);
      const watch = startWatch(s, s.player, 'standing');
      expect(watch.accepted.has(w.id)).toBe(false); // in the tavern, out of the senses
      const { walk, run } = moveSpeed(s, w);
      const near = CONFIG.HOSTILE_NEAR_M + run * warnS(watch) - 0.5;
      w.zone = 'field_far';
      w.placeId = s.player.placeId;
      w.pos = { x: s.player.pos.x + near, y: field.y };
      const from = { zone: 'field_far', pos: { x: w.pos.x + speedOf(walk, run) * 2, y: field.y } };
      return { r: checkNear(s, watch, new Map([[w.id, from]]), 2), accepted: watch.accepted.has(w.id), walk, run };
    };
    const rush = check((_, run) => run);
    expect(rush.run).toBeGreaterThan(CONFIG.RUSH_SHARE * rush.walk);
    expect(rush.r).toEqual({ why: 'closing', by: ['patron_1'] });
    const stroll = check((walk) => walk);
    expect(stroll.r).toBeNull();
    expect(stroll.accepted).toBe(true); // a passer-by, listed
  });
  it('AT67: someone accepted fires it again on a change: seen sneaking', () => {
    const s = tavern();
    const w = wim(s);
    const watch = startWatch(s, s.player, 'standing');
    expect(watch.accepted.has(w.id)).toBe(true);
    expect(checkNear(s, watch, new Map(), 3)).toBeNull();
    w.posture = 'stealthy';
    expect(checkNear(s, watch, new Map(), 3)).toEqual({ why: 'change', by: [w.id] });
  });
  it('AT67: contact: an attack aimed at the watcher, or words to them they hear', () => {
    const s = tavern();
    const blow = { actorId: 'patron_1', kind: 'attack', target: 'player', noise: 'quiet', perception: {} } as unknown as GameEvent;
    expect(contact(s.player, [blow])).toEqual({ why: 'contact', by: ['patron_1'] });
    const words = { actorId: 'patron_1', kind: 'speak', target: 'player', line: { text: 'hey', volume: 'normal' }, noise: 'normal', perception: { player: { level: 'full', cue: 'sound', heard: true } } } as unknown as GameEvent;
    expect(contact(s.player, [words])).toEqual({ why: 'contact', by: ['patron_1'] });
    expect(contact(s.player, [{ ...words, target: 'trader', perception: {} } as GameEvent])).toBeNull();
  });
  it('AT67: steps are at most half the shortest time anyone perceived and not accepted needs to fire it, within STEP_MIN_S and STEP_MAX_S', () => {
    const { s, w, watch } = watched();
    expect(stepS(s, watch)).toBe(CONFIG.STEP_MAX_S); // nobody new in the senses
    at(s, w, 0, 3);
    expect(stepS(s, watch)).toBe(CONFIG.STEP_MIN_S); // close by and not accepted
  });
});
