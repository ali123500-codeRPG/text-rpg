// 385 PZ15 (Phase out zones): the last checks that used zone links or "the same zone" as a distance now use metres,
// hearing or sight. BG-303 a bed nearby, BG-304 Fieldcraft's one-move zones, BG-305 the planners' view (s046), BG-306 the
// code-run attack, BG-307 a step waiting for someone to arrive, BG-308 a leader waiting, BG-309 stepping up to be heard.
import { describe, expect, it } from 'vitest';
import type { TitleSpec } from '../../src/types';
import { drawTitles } from '../../src/plan/draw';
import { actor, addPiece, createRng, makeVillage, place } from '../harness';
import { CONFIG } from '../../src/config';
import { PK } from '../../src/library/perkIds';
import { FU } from '../../src/library/tableIds';
import { withBed } from '../../src/scenario/apply';
import { oneMoveZones } from '../../src/views/tactics';
import { slotMetres } from '../../src/engine/speed';
import { fallbackOrder } from '../../src/minds';
import { buildActorView } from '../../src/views';
import { zoneById } from '../../src/engine/relations';
import { approachMove } from '../../src/engine/merge';
import { seedGoals } from '../../src/engine/goals';
import { hearsClearly } from '../../src/perception';
import { act, plannerOut, play } from './w4-kit';

describe('385 no zone links or same zone as distance', () => {
  it('BG-303: a bed two links off but 70 m away is not one\'s bed; one 8 m off through a doorway is', () => {
    const s = makeVillage();
    addPiece(s, 'field_mid', { kind: FU.bed, name: 'cot' }, 'cot');
    expect(withBed(s, 'gate_guard', { post: 'gate_inner' }, 'gate_inner').bed).toBe('gate_inner'); // gate_inner, field_edge, field_mid
    addPiece(s, 'tav_common', { kind: FU.bed, name: 'bunk' }, 'bunk');
    expect(withBed(s, 'barkeep', { counter: 'tav_counter', refuge: 'tav_cellar' }, 'tav_counter').bed).toBe('tav_common');
    expect(CONFIG.BED_NEAR_M).toBe(30);
  });

  it('BG-304: a zone four ways out that one move reaches is a Fieldcraft step-to zone', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const w = slotMetres(s, s.player, 'move') / 6;
    const rooms: TitleSpec[] = [0, 1, 2, 3, 4].map((i) => ({ id: `r${i}`, placeId: 'tavern', name: `room ${i}`, look: '', roof: false, light: 'bright',
      rect: { x: 100 + w * i, y: 100, w, d: 4 },
      ways: [...(i ? [{ to: `r${i - 1}`, label: 'west', kind: 'open' as const }] : []), ...(i < 4 ? [{ to: `r${i + 1}`, label: 'east', kind: 'open' as const }] : [])] }));
    drawTitles(s, rooms);
    Object.assign(s.player, { zone: 'r0', pos: { x: 100, y: 100 } });
    expect(oneMoveZones(s, s.player).map((n) => n.zone)).toContain('r4');
  });

  it('BG-306: a foe a step away across a field\'s edge is attacked, not walked toward', () => {
    const s = makeVillage({ playerZone: 'field_edge' });
    const sl = actor(s, 'slime_1');
    s.player.pos = { x: 89, y: -14 }; sl.pos = { x: 90.6, y: -14 }; // field_edge ends at x 90, field_mid begins there
    sl.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'field_edge', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    expect(fallbackOrder(buildActorView(s, 'slime_1'), createRng(1))).toMatchObject({ type: 'attack', target: 'player' });
  });

  it('BG-307: someone across the counter, near enough to talk, has arrived', () => {
    const s = makeVillage({ playerZone: 'street_square', without: ['slime_1', 'slime_2'] });
    const wim = actor(s, 'patron_1'); // in the common room; Mags is 7.7 m off behind the counter
    seedGoals(s, wim, [{ text: 'wait for Mags' }]);
    play(s, { agentOutputs: [plannerOut('patron_1', act('hold'), { steps: [{ wait: true, until: { arrival: 'trader' } }] })] });
    play(s);
    expect(s.hidden.drives!.patron_1.steps).toEqual([]);
  });

  it('BG-308: a leader stops waiting once the one it leads is near enough to talk, in any zone', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'patron_1'] });
    const m = actor(s, 'trader');
    m.core.perks = m.core.perks.filter((p) => p.perkId !== PK.keen_ear); // BG-312: plain hearing, whatever perks it rolled
    m.mind!.control = 'agent';
    play(s, { agentOutputs: [plannerOut(m.id, act('hold'), { headTo: 'street_door', lead: s.player.id })] });
    m.mind!.control = 'code';
    for (let i = 0; i < 6 && m.zone !== 'street_door'; i++) play(s);
    expect(m.zone).toBe('street_door');
    Object.assign(s.player.pos!, { x: 0, y: -3.6 }); m.pos = { x: 0, y: -4.6 }; // the player in the doorway, still in the tavern
    // BG-312: the front doorway holds a real door: shut, a normal voice 0.7 m off comes through muffled; open, clearly
    const door = s.barriers![s.openings.find((o) => o.joins.includes('street_door') && o.joins.includes('tav_common'))!.barrier!];
    expect(hearsClearly(s, m, s.player, 'normal')).toBe(false);
    door.open = true;
    expect(hearsClearly(s, m, s.player, 'normal')).toBe(true);
    play(s);
    expect(m.mind!.leading).toBeUndefined();
  });

  it('BG-309: someone two open ways off, out of earshot, is stepped toward to be heard', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    CONFIG.HEARING_FLOOR_DB = 30; // a normal voice is clear to about 5.6 m
    place(s, 'guard_1', 'gate_inner'); // street_door, street_square, gate_inner: open, seen across
    expect(approachMove(s, s.player, { type: 'talk', target: 'guard_1' }, null)).toMatchObject({ toZone: 'gate_inner' });
  });
});
