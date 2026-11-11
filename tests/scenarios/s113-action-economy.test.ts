// 113 Action economy (AE1–AE12): a turn is one move plus one main action. A ranged attack and a
// move don't share a turn; a player with no action dashes a second link unless a leg is Crippled; "after" acts first.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { resolveTurn } from '../../src/engine';
import type { GameState, Intent } from '../../src/types';
import { IT } from '../../src/library/itemIds';
import { CONFIG, resetConfig } from '../../src/config';
import { afterEach } from 'vitest';

const intent = (move: Intent['move'], action: Partial<NonNullable<Intent['action']>> | null = null): Intent => ({
  move, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: action ? { type: 'attack', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal', ...action } : null,
});
const turn = (s: GameState, i: Intent) => { s.turn += 1; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };
const bow = (s: GameState) => {
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['hand:right_arm', 'hand:left_arm'] });
};

describe('113 action economy', () => {
  afterEach(() => resetConfig());
  it('a ranged attack in reach drops the move', () => {
    const s = makeVillage();
    place(s, 'player', 'field_edge');
    bow(s);
    const ev = turn(s, intent({ toZone: 'gate_inner' }, { type: 'attack', target: 'slime_1' }));
    expect(s.player.zone).toBe('field_edge');
    expect(ev.some((e) => e.kind === 'attack' && e.actorId === 'player')).toBe(true);
    expect(s.log.some((l) => l.code === 'move_dropped' && (l.detail as { reason?: string }).reason === 'ranged_attack')).toBe(true);
  });
  it('a ranged attack out of reach gives way to the move', () => {
    const s = makeVillage();
    place(s, 'player', 'street_square');
    place(s, 'slime_2', 'tav_common'); // the tavern door has no sight: out of the bow's reach from both zones
    bow(s);
    const ev = turn(s, intent({ toZone: 'gate_inner' }, { type: 'attack', target: 'slime_2' }));
    expect(s.player.zone).toBe('gate_inner');
    expect(ev.some((e) => e.kind === 'attack' && e.actorId === 'player')).toBe(false);
  });
  it('ZP3: a shot costs the main action and a move slot; with a second move slot the move still goes one link', () => {
    const s = makeVillage();
    place(s, 'player', 'field_edge');
    bow(s);
    CONFIG.MOVE_SLOTS = 2;
    const ev = turn(s, intent({ toZone: 'gate_inner' }, { type: 'attack', target: 'slime_1' }));
    expect(ev.some((e) => e.kind === 'attack' && e.actorId === 'player')).toBe(true);
    expect(s.player.zone).toBe('gate_inner');
  });
  it('a move two links away with no action is a dash; a Crippled leg stops it', () => {
    const s = makeVillage();
    place(s, 'player', 'street_door');
    turn(s, intent({ toZone: 'gate_inner' }));
    expect(s.player.zone).toBe('gate_inner');
    const c = makeVillage();
    place(c, 'player', 'street_door');
    c.player.core.condition.parts.left_leg = -30;
    turn(c, intent({ toZone: 'gate_inner' }));
    expect(c.player.zone).toBe('street_square');
    expect(c.log.some((l) => l.code === 'dash_blocked')).toBe(true);
  });
  it('CO13: a movement spends move slots first, then the main slot, so more move slots walk farther', () => {
    const s = makeVillage();
    place(s, 'player', 'street_door');
    CONFIG.MOVE_SLOTS = 2;
    turn(s, intent({ toZone: 'field_edge' }));
    expect(s.player.zone).toBe('field_edge'); // 2 move slots + the unused main slot = 3 links
    const t = makeVillage();
    place(t, 'player', 'street_door');
    CONFIG.MOVE_SLOTS = 2; // makeVillage resets config
    turn(t, intent({ toZone: 'field_edge' }, { type: 'attack', target: 'slime_1' }));
    expect(t.player.zone).toBe('gate_inner'); // a main action planned: only the 2 move slots
  });
  it('"after" resolves the action before the move', () => {
    const s = makeVillage();
    place(s, 'player', 'field_mid');
    const ev = turn(s, intent({ toZone: 'field_edge', after: true }, { type: 'attack', target: 'slime_1' }));
    const mine = ev.filter((e) => e.actorId === 'player').map((e) => e.kind);
    expect(mine.indexOf('attack')).toBeGreaterThanOrEqual(0);
    expect(mine.indexOf('attack')).toBeLessThan(mine.indexOf('move'));
    expect(s.player.zone).toBe('field_edge');
  });
});
