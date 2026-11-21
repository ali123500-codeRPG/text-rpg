// 171 Positions (step 2, ZP1–ZP4): everyone stands at a point in metres; distance is a straight line with sight between
// the zones, else the walking path through doorways; a move walks slotMetres toward its zone and a dash runs on; a melee
// attack out of reach closes in on the move slot first, and loses the blow when still out of reach.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { inTitle, middle, wayTo } from '../../src/plan/where';
import { boxOf, sharedSides } from '../../src/plan/geom';
import { verticalOf } from '../../src/scenario/heights';
import { distM, sightDistM } from '../../src/engine/position';
import { ruleset } from '../../src/ruleset';
import { forcedRng } from '../harness';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { AM } from '../../src/library/tableIds';
import type { GameState } from '../../src/types';

/** the test village drawn on its floor plan: rooms 64 m², streets 400 m², fields 1600 m² (40 m across) */
const mapped = (playerZone?: string): GameState => makeVillage(playerZone ? { playerZone } : {});
/** the point of the way from title a to title b */
const doorway = (s: GameState, a: string, b: string) => wayTo(s, a, b)!.opening.at;
const r = (n: number) => Math.round(n * 10) / 10;
const zoneOf = (s: GameState, id: string) => s.places.flatMap((p) => p.zones).find((z) => z.id === id)!;

describe('171 positions', () => {
  it('BG-6: "down the street" is level; "down the cellar steps" goes down a storey', () => {
    expect(verticalOf('down the street')).toBe(0);
    expect(verticalOf('up the road')).toBe(0);
    expect(verticalOf('down the cellar steps')).toBe(-1);
    expect(verticalOf('the stairs up')).toBe(1);
  });

  it('BG-7: a walk from the far wall reaches the next title through its door, never stopping between them', () => {
    const s = mapped('tav_common');
    const room = boxOf(zoneOf(s, 'tav_common').outline);
    s.actors = s.actors.filter((a) => a.zone !== 'tav_common' && a.zone !== 'street_door');
    s.player.pos = { x: room.x, y: room.y + room.d / 2 - 0.5 }; // the far wall: more than one slot from the door
    for (let i = 0; i < 3 && s.player.zone !== 'street_door'; i++) play(s, { intent: intent({ move: { toZone: 'street_door' }, action: { type: 'wait' } as never }) });
    expect(s.player.zone).toBe('street_door');
  });

  it('BG-7: a title whose way names no direction touches the title it leads from on a free side, not across a gap', () => {
    const s = mapped();
    expect(sharedSides(zoneOf(s, 'tav_common').outline, zoneOf(s, 'street_door').outline).length).toBeGreaterThan(0);
  });

  it('ZP1: code places everyone inside their zone, an arm\'s length apart', () => {
    const s = mapped();
    const z = s.places.flatMap((p) => p.zones).find((x) => x.id === 'tav_common')!;
    const here = [s.player, ...s.actors].filter((a) => a.zone === 'tav_common');
    expect(here.length).toBeGreaterThan(1);
    for (const a of here) expect(inTitle(z, a.pos!)).toBe(true);
    expect(distM(s, here[0], here[1])).toBeGreaterThanOrEqual(CONFIG.PLACE_GAP_M - 0.01);
  });

  it('ZP4: a straight line with sight between the zones, else the walking path through the doorways', () => {
    const s = mapped();
    const trader = place(s, 'trader', 'tav_counter'); // the common room sees the counter
    trader.pos = { x: 7.7, y: 0 };
    s.player.pos = { x: 0, y: 0 };
    expect(r(distM(s, s.player, trader))).toBe(7.3); // SZ5: between their bodies: 7.7 less the player's front (0.15) and the trader's side (0.25)
    const guard = s.actors.find((a) => a.id === 'guard_1')!; // at the gate: no sight from inside the tavern
    expect(sightDistM(s, s.player, guard)).toBe(Infinity);
    expect(distM(s, s.player, guard)).toBeGreaterThan(Math.hypot(guard.pos!.x, guard.pos!.y) - 0.01);
  });

  it('ZP2: a move walks 8.4 m toward its zone, a dash runs 21.6 m more, and a move to a zone stops a step past its edge', () => {
    const s = mapped('field_edge');
    const door = doorway(s, 'field_edge', 'field_mid');
    const c = middle(zoneOf(s, 'field_edge')); // the field's centre: 20 m from field_mid
    expect(r(Math.hypot(door.x - c.x, door.y - c.y))).toBe(20);
    s.player.pos = { ...c };
    const ev = play(s, { intent: intent({ move: { toZone: 'field_mid' }, action: { type: 'wait' } }) }); // the main slot is busy: no dash
    expect(s.player.zone).toBe('field_edge');
    expect(ev.find((e) => e.actorId === 'player' && e.kind === 'move')).toMatchObject({ metres: 8.4 });
    expect(r(Math.hypot(s.player.pos!.x - c.x, s.player.pos!.y - c.y))).toBe(8.4);
    const t = mapped('field_edge');
    t.player.pos = { ...c };
    play(t, { intent: intent({ move: { toZone: 'field_mid' } }) }); // no action: the main slot runs on (a dash)
    expect(t.player.zone).toBe('field_mid');
    expect(r(Math.hypot(t.player.pos!.x - door.x, t.player.pos!.y - door.y))).toBe(r(CONFIG.ENTER_M + 0.15)); // SZ19: a step to its body's near edge (half its 0.3 m depth)
  });

  it('ZP3: an attack out of reach closes in on the move slot, then strikes', () => {
    const s = mapped('tav_common');
    const p = place(s, 'patron_1', 'tav_common');
    s.player.pos = { x: 0, y: 0 };
    p.pos = { x: 3, y: 0 };
    const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', skill: SK.melee_medium } }) });
    const step = ev.find((e) => e.actorId === 'player' && e.kind === 'move')!;
    expect(step).toMatchObject({ target: 'patron_1', zone: 'tav_common' });
    expect(step.fromZone).toBeUndefined();
    expect(ev.find((e) => e.actorId === 'player' && e.kind === 'attack')?.target).toBe('patron_1');
  });

  it('BG-255: still out of reach after closing in, the blow becomes a run at them, as far as a dash', () => {
    const s = mapped('field_edge');
    s.player.pos = middle(zoneOf(s, 'field_edge'));
    const dash = structuredClone(s);
    const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'slime_1', skill: SK.melee_medium } }) });
    const moves = ev.filter((e) => e.actorId === 'player' && e.kind === 'move');
    expect(moves[0]).toMatchObject({ metres: 8.4 });
    expect(ev.find((e) => e.actorId === 'player' && e.target === 'slime_1' && e.kind !== 'move')).toBeUndefined();
    // the turn timer: the run covers what a dash at them would (AE2), no more
    const ran = moves.reduce((n, e) => n + (e.metres ?? 0), 0);
    const ev2 = play(dash, { intent: intent({ move: { toZone: 'field_mid', spot: { near: 'slime_1' } } }) });
    const dashed = ev2.filter((e) => e.actorId === 'player' && e.kind === 'move').reduce((n, e) => n + (e.metres ?? 0), 0);
    expect(r(ran)).toBe(r(dashed));
  });

  it('a spear reaches across the doorway into the next zone without stepping in', () => {
    const s = mapped('tav_common');
    s.player.core.inventory.push({ id: 'sp', itemId: IT.spear });
    const trader = place(s, 'trader', 'tav_counter');
    s.player.pos = { x: 3.5, y: 0 };
    trader.pos = { x: 6, y: 0 }; // 2.5 m: past the sword's 1.6 m, inside the spear's 2.8 m
    const stow = [{ op: 'stow' as const, item: `player_${IT.arming_sword}_1` }, { op: 'stow' as const, item: `player_${IT.round_shield}_2` }];
    const ev = play(s, { intent: intent({ gear: [...stow, { op: 'draw' as const, item: 'sp' }], action: { type: 'attack', target: 'trader', skill: SK.melee_medium, item: 'sp', mode: AM.thrust } }) });
    expect(ev.find((e) => e.actorId === 'player' && e.kind === 'move')).toBeUndefined();
    expect(ev.find((e) => e.actorId === 'player' && e.kind === 'attack')?.target).toBe('trader');
  });

  it('RD5: a shot is crowded only by a hostile within 2 m, not by one across the room', () => {
    const s = mapped('tav_common');
    const wim = place(s, 'patron_1', 'tav_common');
    wim.mind!.overrides = { player: 'hostile' };
    for (const i of s.player.core.inventory) delete i.equippedIn;
    s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
    const crowded = () => ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: 'bow', targetPart: null, aimed: false }, s, forcedRng([50, 50, 50]))
      .attack.modifiers.some((m) => m.source === 'hostile close');
    s.player.pos = { x: -3, y: 0 };
    wim.pos = { x: 3, y: 0 }; // 6 m: across the room
    expect(crowded()).toBe(false);
    wim.pos = { x: -1.5, y: 0 }; // 1.5 m: close enough to strike
    expect(crowded()).toBe(true);
  });
});
