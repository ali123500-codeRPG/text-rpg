// TQ1: each turn-checker rule passes on a clean turn and names what broke when its world rule is broken.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameEvent, GameState } from '../../src/types';
import { makeVillage, beside } from '../harness';
import { play } from '../cases/w4-kit';
import { CONFIG } from '../../src/config';
import { IT } from '../../src/library/itemIds';
import { TURN_CHECK, TURN_RULES, checkTurn, snapTurn } from '../../src/save/turnCheck';

const fake = vi.hoisted(() => ({ heard: null as null | { speaker: string; text: string; volume: 'normal' }, dropPronouns: false }));
vi.mock('../../src/views', async (orig) => {
  const real = await orig<typeof import('../../src/views')>();
  return { ...real, buildNarrationView: (...a: Parameters<typeof real.buildNarrationView>) => {
    const v = real.buildNarrationView(...a);
    return { ...v, heard: [...v.heard, ...(fake.heard ? [fake.heard] : [])], actors: fake.dropPronouns ? v.actors.map(({ pronouns: _, ...x }) => x) : v.actors };
  } };
});

const ev = (s: GameState, p: Partial<GameEvent>): GameEvent =>
  ({ id: `e${Math.random()}`, turn: s.turn, actorId: 'patron_1', kind: 'idle', zone: 'tav_common', effects: [], noise: 'normal', visibility: 'normal', perception: {}, ...p }) as GameEvent;
const rules = (s: GameState, events: GameEvent[] = [], before = snapTurn(s)) => checkTurn(s, before, events).map((b) => b.rule);

describe('turn checker (TQ1)', () => {
  beforeEach(() => { TURN_CHECK.strict = false; fake.heard = null; fake.dropPronouns = false; });
  afterEach(() => { TURN_CHECK.strict = true; });

  it('a clean village turn breaks nothing, and strict mode throws with the rule named', () => {
    const s = makeVillage();
    TURN_CHECK.strict = true;
    expect(() => play(s)).not.toThrow();
    s.player.zone = 'nowhere';
    expect(() => checkTurn(s, snapTurn(s), [])).toThrow(/real_zone/);
  });

  it('real_zone, inside_zone: a missing zone, a wrong place, a point outside the rectangle', () => {
    const s = makeVillage();
    const p = s.actors.find((a) => a.id === 'patron_1')!;
    p.placeId = 'gate';
    expect(rules(s)).toContain('real_zone');
    p.placeId = 'tavern';
    p.pos = { x: 1e6, y: 0 };
    expect(rules(s)).toContain('inside_zone');
  });

  it('move_event: a zone change needs a move from that zone, a ride on the player\'s travel, a caught_up log or a new scenario', () => {
    const s = makeVillage();
    const before = snapTurn(s);
    const p = s.actors.find((a) => a.id === 'patron_1')!;
    Object.assign(p, { zone: 'tav_cellar', pos: undefined });
    expect(rules(s, [], before)).toContain('move_event');
    expect(rules(s, [ev(s, { kind: 'move', fromZone: 'tav_common', zone: 'tav_cellar' })], before)).not.toContain('move_event');
    s.log.push({ turn: s.turn, code: 'caught_up', detail: { actorId: 'patron_1' } });
    expect(rules(s, [], before)).not.toContain('move_event');
    s.log = [];
    s.stage.scenarioNumber++;
    expect(rules(s, [], before)).not.toContain('move_event');
  });

  it('dead_still: the dead neither act nor take blows', () => {
    const s = makeVillage();
    s.actors.find((a) => a.id === 'patron_1')!.core.condition.hpLostPct = 1000;
    const before = snapTurn(s);
    expect(before.dead).toContain('patron_1');
    expect(rules(s, [ev(s, { kind: 'move' })], before)).toContain('dead_still');
    expect(rules(s, [ev(s, { actorId: 'player', kind: 'attack', target: 'patron_1' })], before)).toContain('dead_still');
  });

  it('event_refs: unknown zone, unknown actor, a reused id', () => {
    const s = makeVillage();
    expect(rules(s, [ev(s, { zone: 'nowhere' })])).toContain('event_refs');
    expect(rules(s, [ev(s, { actorId: 'ghost' })])).toContain('event_refs');
    expect(rules(s, [ev(s, { id: 'x' }), ev(s, { id: 'x' })])).toContain('event_refs');
  });

  it('fight_ends: an engagement or a hunt nothing renewed for ENGAGEMENT_END_TURNS turns', () => {
    const s = makeVillage();
    s.turn = 10;
    const p = s.actors.find((a) => a.id === 'patron_1')!;
    p.engagement = { start: 1, last: 10 - CONFIG.ENGAGEMENT_END_TURNS, kinds: ['fight'] };
    expect(rules(s)).toContain('fight_ends');
    delete p.engagement;
    p.mind!.knowledge.player = { status: 'engaged', source: 'seen', revealed: [], closedTurn: 9 - CONFIG.ENGAGEMENT_END_TURNS };
    expect(rules(s)).toContain('fight_ends');
  });

  it('invariants, one_item_one_place: a grip used twice, an item in two places', () => {
    const s = makeVillage();
    s.player.core.inventory.push({ id: 'd1', itemId: IT.dagger, equippedIn: ['grip:right_arm'] });
    expect(rules(s)).toContain('invariants');
    s.player.core.inventory.pop();
    s.zones[0].groundItems.push({ ...s.player.core.inventory[0] });
    expect(rules(s)).toContain('one_item_one_place');
  });

  it('condition_range, links_real: NaN health, an unknown band, belief or hold', () => {
    const s = makeVillage();
    const p = s.actors.find((a) => a.id === 'patron_1')!;
    const before = snapTurn(s);
    p.core.condition.hpLostPct = NaN;
    expect(rules(s, [], before)).toContain('condition_range');
    p.core.condition.hpLostPct = 0;
    const broken = (f: (a: GameState['actors'][number]) => void) => { const t = makeVillage(); f(t.actors.find((a) => a.id === 'patron_1')!); return rules(t); };
    expect(broken((a) => { a.bandId = 'nobody'; })).toContain('links_real');
    expect(broken((a) => { a.mind!.knowledge.ghost = { status: 'aware', source: 'seen', revealed: [] }; })).toContain('links_real');
    expect(broken((a) => { a.heldBy = 'guard_1'; })).toContain('links_real'); // the guard stands at the gate
  });

  it('view_pronouns, heard_only: views keep pronouns, and the Narrator gets only words the player heard', () => {
    const s = makeVillage();
    beside(s, 'patron_1');
    expect(rules(s)).toEqual([]);
    fake.heard = { speaker: 'Old Wim', text: 'a whisper the player never heard', volume: 'normal' };
    expect(rules(s)).toContain('heard_only');
    fake.heard = null;
    fake.dropPronouns = true;
    expect(rules(s)).toContain('view_pronouns');
    fake.dropPronouns = false;
    s.actors.find((a) => a.id === 'patron_1')!.pronouns = undefined;
    expect(rules(s)).toEqual([]); // no pronouns to lose
  });

  it('every rule has a test above', () => {
    const src = readFileSync(expect.getState().testPath!, 'utf8');
    expect(TURN_RULES.filter((r) => !src.includes(`'${r}'`))).toEqual([]);
  });
});
