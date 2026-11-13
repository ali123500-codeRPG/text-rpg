// 113 Action economy (AE1–AE12, action time AT19): a turn is seconds of move time plus seconds of main time. A shot that
// locks movement takes its seconds from the move time too; a player with no action dashes (runs the main slot's metres too) unless a leg is Crippled;
// "after" acts first. Distances are metres: a move slot walks slotMetres, a dash runs slotMetres(main) more.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { resolveTurn } from '../../src/engine';
import type { GameEvent, GameState, Intent } from '../../src/types';
import { slotMetres } from '../../src/engine/speed';
import { IT } from '../../src/library/itemIds';
import { CONFIG, resetConfig } from '../../src/config';
import { DU } from '../../src/library/tableIds';
import { actionRow, actionSeconds } from '../../src/ruleset/actionTime';
import { afterEach } from 'vitest';

const intent = (move: Intent['move'], action: Partial<NonNullable<Intent['action']>> | null = null): Intent => ({
  move, gear: null, spoken: null, addressees: null, deferred: [], clarify: null,
  action: action ? { type: 'attack', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal', ...action } : null,
});
const turn = (s: GameState, i: Intent) => { s.turn += 1; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };
/** metres the player walked in these events */
const walked = (ev: GameEvent[]) => ev.filter((e) => e.kind === 'move' && e.actorId === 'player').reduce((m, e) => m + ((e as { metres?: number }).metres ?? 0), 0);
const slots = (s: GameState, move: number, main = 0) => move * slotMetres(s, s.player, 'move') + main * slotMetres(s, s.player, 'main');
const bow = (s: GameState) => {
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
};

describe('113 action economy', () => {
  afterEach(() => resetConfig());
  it('AT19: a shot in reach takes its seconds from the move time too; the move walks only on what is left', () => {
    const s = makeVillage();
    place(s, 'player', 'field_edge');
    bow(s);
    const shot = actionSeconds(actionRow(DU.bow_light)!); // a light bow shot locks movement
    const ev = turn(s, intent({ toZone: 'gate_inner' }, { type: 'attack', target: 'slime_1' }));
    expect(ev.filter((e) => e.kind === 'attack' && e.actorId === 'player')).toHaveLength(1);
    expect(walked(ev)).toBeCloseTo(slotMetres(s, s.player, 'move', CONFIG.FIGHT_TURN_S - shot), 0);
    const t = makeVillage();
    place(t, 'player', 'field_edge');
    bow(t);
    t.player.core.inventory.find((i) => i.id === 'bow')!.itemId = IT.longbow; // a medium bow shot takes the whole turn
    const ev2 = turn(t, intent({ toZone: 'gate_inner' }, { type: 'attack', target: 'slime_1' }));
    expect(t.player.zone).toBe('field_edge');
    expect(ev2.some((e) => e.kind === 'attack' && e.actorId === 'player')).toBe(true);
    expect(t.log.some((l) => l.code === 'move_dropped' && (l.detail as { reason?: string }).reason === 'ranged_attack')).toBe(true);
  });
  it('a ranged attack out of reach gives way to the move', () => {
    const s = makeVillage();
    place(s, 'player', 'street_square');
    place(s, 'slime_2', 'tav_common'); // the tavern door has no sight: out of the bow's reach from both zones
    bow(s);
    const ev = turn(s, intent({ toZone: 'gate_inner' }, { type: 'attack', target: 'slime_2' }));
    expect(walked(ev)).toBeGreaterThan(0);
    expect(ev.some((e) => e.kind === 'attack' && e.actorId === 'player')).toBe(false);
  });
  it('a long move with no action is a dash (the main slot runs too); a Crippled leg stops it', () => {
    const s = makeVillage();
    place(s, 'player', 'street_door');
    expect(walked(turn(s, intent({ toZone: 'field_far' })))).toBeCloseTo(slots(s, 1, 1), 0);
    const c = makeVillage();
    place(c, 'player', 'street_door');
    c.player.core.condition.parts.left_leg = -30;
    expect(walked(turn(c, intent({ toZone: 'field_far' })))).toBeCloseTo(slots(c, 1), 0);
    expect(c.log.some((l) => l.code === 'dash_blocked')).toBe(true);
  });
  it('CO13: a movement spends the move time first, then the main time when no action is planned', () => {
    const t = makeVillage();
    place(t, 'player', 'street_door');
    expect(walked(turn(t, intent({ toZone: 'field_far' }, { type: 'attack', target: 'slime_1' })))).toBeCloseTo(slots(t, 1), 0); // a main action planned: the move time only
  });
  it('"after" resolves the action before the move', () => {
    const s = makeVillage();
    place(s, 'player', 'field_mid');
    const ev = turn(s, intent({ toZone: 'field_edge', after: true }, { type: 'attack', target: 'slime_1' }));
    const mine = ev.filter((e) => e.actorId === 'player').map((e) => e.kind);
    expect(mine.indexOf('attack')).toBeGreaterThanOrEqual(0);
    expect(mine.indexOf('attack')).toBeLessThan(mine.indexOf('move'));
    expect(walked(ev)).toBeGreaterThan(0);
  });
});
