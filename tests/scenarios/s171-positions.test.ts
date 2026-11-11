// 171 Positions (step 2, ZP1–ZP4): everyone stands at a point in metres; distance is a straight line with sight between
// the zones, else the walking path through doorways; a move walks slotMetres toward its zone and a dash runs on; a melee
// attack out of reach closes in on the move slot first, and loses the blow when still out of reach.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { placeZones } from '../../src/scene/geometry';
import { verticalOf } from '../../src/scene/heights';
import { distM, placeAll, sightDistM } from '../../src/engine/position';
import { perceptionOf } from '../../src/perception';
import { ruleset } from '../../src/ruleset';
import { forcedRng } from '../harness';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { AM } from '../../src/library/tableIds';
import type { GameEvent, GameState } from '../../src/types';

/** the test village with real zone sizes laid out on the map: rooms 60 m², streets 400 m², fields 1600 m² (40 m across) */
function mapped(playerZone?: string): GameState {
  const s = makeVillage(playerZone ? { playerZone } : {});
  const zs = s.places.flatMap((p) => p.zones);
  for (const z of zs) z.area = CONFIG.ZONE_SIZE_M2[z.id.startsWith('field') ? 'open' : z.id.startsWith('street') || z.id.startsWith('gate') ? 'yard' : 'room'];
  placeZones(s, zs);
  placeAll(s);
  return s;
}
const r = (n: number) => Math.round(n * 10) / 10;

describe('171 positions', () => {
  it('BG-6: "down the street" is level; "down the cellar steps" goes down a storey', () => {
    expect(verticalOf('down the street')).toBe(0);
    expect(verticalOf('up the road')).toBe(0);
    expect(verticalOf('down the cellar steps')).toBe(-1);
    expect(verticalOf('the stairs up')).toBe(1);
  });

  it('ZP1: code places everyone inside their zone, an arm\'s length apart', () => {
    const s = mapped();
    const z = s.places.flatMap((p) => p.zones).find((x) => x.id === 'tav_common')!;
    const here = [s.player, ...s.actors].filter((a) => a.zone === 'tav_common');
    expect(here.length).toBeGreaterThan(1);
    for (const a of here) expect(Math.abs(a.pos!.x - z.rect!.x)).toBeLessThanOrEqual(z.rect!.w / 2);
    expect(distM(s, here[0], here[1])).toBeGreaterThanOrEqual(CONFIG.PLACE_GAP_M - 0.01);
  });

  it('ZP4: a straight line with sight between the zones, else the walking path through the doorways', () => {
    const s = mapped();
    const trader = place(s, 'trader', 'tav_counter'); // the common room sees the counter
    trader.pos = { x: 7.7, y: 0 };
    s.player.pos = { x: 0, y: 0 };
    expect(r(distM(s, s.player, trader))).toBe(7.7);
    const guard = s.actors.find((a) => a.id === 'guard_1')!; // at the gate: no sight from inside the tavern
    expect(sightDistM(s, s.player, guard)).toBe(Infinity);
    expect(distM(s, s.player, guard)).toBeGreaterThan(Math.hypot(guard.pos!.x, guard.pos!.y) - 0.01);
  });

  it('ZP2: a move walks 8.4 m toward its zone, a dash runs 21.6 m more, and a move to a zone stops a step past its edge', () => {
    const s = mapped('field_edge');
    s.player.pos = { x: 93.9, y: 0 }; // the field's centre: 20 m from field_mid
    const ev = play(s, { intent: intent({ move: { toZone: 'field_mid' }, action: { type: 'wait' } }) }); // the main slot is busy: no dash
    expect(s.player.zone).toBe('field_edge');
    expect(ev.find((e) => e.actorId === 'player' && e.kind === 'move')).toMatchObject({ metres: 8.4 });
    expect(r(s.player.pos!.x)).toBe(102.3);
    const t = mapped('field_edge');
    t.player.pos = { x: 93.9, y: 0 };
    play(t, { intent: intent({ move: { toZone: 'field_mid' } }) }); // no action: the main slot runs on (a dash)
    expect(t.player.zone).toBe('field_mid');
    expect(r(t.player.pos!.x)).toBe(r(113.9 + CONFIG.ENTER_M));
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

  it('ZP3: still out of reach after closing in, the blow is lost', () => {
    const s = mapped('field_edge');
    s.player.pos = { x: 93.9, y: 0 };
    const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'slime_1', skill: SK.melee_medium } }) });
    expect(ev.find((e) => e.actorId === 'player' && e.kind === 'move')).toMatchObject({ metres: 8.4 });
    expect(ev.find((e) => e.actorId === 'player' && e.target === 'slime_1' && e.kind !== 'move')?.kind).toBe('wasted');
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

  it('PR 2: sight is measured in metres from where the event happened', () => {
    const s = mapped('field_edge');
    const seen = (x: number, visibility: GameEvent['visibility']) => {
      place(s, 'player', x > 113.9 ? 'field_mid' : 'field_edge').pos = { x, y: 0 };
      const ev = { id: 'e', turn: 1, actorId: 'slime_1', kind: 'idle', zone: 'field_mid', pos: { x: 120, y: 0 }, effects: [], noise: 'silent', visibility, perception: {} } as GameEvent;
      return perceptionOf(ev, s, s.player)?.level ?? null;
    };
    expect(seen(100, 'normal')).toBe('full'); // 20 m: a walking figure is made out to 25 m
    expect(seen(80, 'normal')).toBe('partial'); // 40 m: glimpsed (to 200 m)
    expect(seen(80, 'low')).toBe('partial'); // a still figure: made out to 15 m
    expect(seen(119.5, 'faint')).toBe('partial'); // 0.5 m counts as SAME_ZONE_M (1 m): past faint's clear 0.5 m
  });

  it('RD5: a shot is crowded only by a hostile within 2 m, not by one across the room', () => {
    const s = mapped('tav_common');
    const wim = place(s, 'patron_1', 'tav_common');
    wim.mind!.overrides = { player: 'hostile' };
    for (const i of s.player.core.inventory) delete i.equippedIn;
    s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['hand:right_arm', 'hand:left_arm'] });
    const crowded = () => ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: 'bow', targetPart: null, aimed: false }, s, forcedRng([50, 50, 50]))
      .attack.modifiers.some((m) => m.source === 'hostile close');
    s.player.pos = { x: -3, y: 0 };
    wim.pos = { x: 3, y: 0 }; // 6 m: across the room
    expect(crowded()).toBe(false);
    wim.pos = { x: -1.5, y: 0 }; // 1.5 m: close enough to strike
    expect(crowded()).toBe(true);
  });
});
