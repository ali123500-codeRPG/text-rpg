// 402 BW8-BW26, part 2: breaking through walls and barriers in play. The order break names the title to break through
// to (the way's barrier, else the wall toward it) or a wall by id. Work stays on the wall or barrier as shares, so helpers
// add their rates; halfway it is Crippled (a crack only an amorphous body passes; a barrier's state), done Destroyed (a
// doorway-sized hole joining the titles, or a frontier where nothing is built). Each turn of blows sounds as the material,
// one step louder as it gives way. Regrowing materials lose the work after REGROW_S idle. No roll.
import { describe, expect, it } from 'vitest';
import type { Barrier, GameState, Intent, Wall } from '../../src/types';
import { byDoor, createRng, makeVillage, putBarrier } from '../harness';
import { resolveTurn } from '../../src/engine';
import { buildNarrationView, buildPlayerView } from '../../src/views';
import { checkParserLegality } from '../../src/agents/legality';
import { wallsAround, holeSpot } from '../../src/plan/holes';
import { seesNow } from '../../src/plan/line';
import { walkPath } from '../../src/plan/path';
import { waysOut } from '../../src/plan/where';
import { addWear, breakJob, jobShare, regrow, secondsLeft, type BreakJob } from '../../src/engine/breakThrough';
import { breakSeconds, wallStuff } from '../../src/ruleset/breaking';
import { zoneById } from '../../src/engine/relations';
import { passage } from '../../src/engine/barriers';
import { now } from '../../src/time';
import { CONFIG } from '../../src/config';
import { BK, BM } from '../../src/library/tableIds';
import { BT } from '../../src/library/raceIds';
import { NOISE } from '../../src/scales';

const quiet = (zone = 'tav_common') => makeVillage({ playerZone: zone, without: ['slime_1', 'slime_2', 'guard_1', 'patron_1'] });
const intent = (p: Partial<Intent>): Intent => ({ move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null, ...p });
const brk = (target: string): Intent => intent({ action: { type: 'break', skill: '', target, targetPart: null, item: null, mode: null, approach: '' } });
const turn = (s: GameState, i: Intent, seed = 1) => { s.turn += 1; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(seed)); };
const wallTo = (s: GameState, from: string, to: string | undefined): Wall => wallsAround(s, zoneById(s, from)!).find((x) => x.behind?.id === to)!.wall;
/** stands the player half a metre in from the wall's breaking spot */
function atWall(s: GameState, w: Wall): void {
  const z = zoneById(s, s.player.zone)!, at = holeSpot(s, w, s.player.pos ?? { x: 0, y: 0 })!;
  const c = z.outline.reduce((p, q) => ({ x: p.x + q.x / z.outline.length, y: p.y + q.y / z.outline.length }), { x: 0, y: 0 });
  const dx = c.x - at.x, dy = c.y - at.y, len = Math.hypot(dx, dy);
  s.player.pos = { x: at.x + dx / len * 0.5, y: at.y + dy / len * 0.5 };
}
const wallJob = (s: GameState, target: string) => breakJob(s, s.player, target) as Extract<BreakJob, { kind: 'wall' }>;

describe('402 breaking through walls and barriers (BW8-BW26)', () => {
  it('BW12 a: the player sees the walls round their title, what they are made of and what is behind; the Parser may target them', () => {
    const s = quiet();
    const walls = buildPlayerView(s).zone.walls!;
    expect(walls.map((w) => w.behind)).toEqual(expect.arrayContaining(['unknown']));
    const toCounter = walls.find((w) => w.to === 'tav_counter')!;
    expect(toCounter.of).toBe('brick'); // BW26 a: a wall kind's default material
    for (const t of [toCounter.id, 'tav_counter', walls.find((w) => !w.to)!.id]) expect(checkParserLegality(brk(t), buildPlayerView(s)).illegal).toEqual([]);
    expect(checkParserLegality(brk('field_far'), buildPlayerView(s)).illegal).toEqual(['action.target field_far']);
  });

  it('BW11 a: half the work cracks the wall (seen through; only an amorphous body passes), all of it breaks a doorway-sized hole joining the titles', () => {
    const s = quiet();
    const w = wallTo(s, 'tav_common', 'tav_counter');
    atWall(s, w);
    const job = wallJob(s, 'tav_counter');
    expect(job.kind).toBe('wall');
    const t = breakSeconds(s, s.player, job.stuff);
    expect(addWear(s, s.player, job, t * 0.3).reached).toBeUndefined();
    expect(w.dents).toHaveLength(1);
    expect(addWear(s, s.player, job, t * 0.3).reached).toBe('crippled');
    const crack = s.openings.find((o) => o.id === job.dent.hole)!;
    expect(crack).toMatchObject({ crack: true, wall: w.id, joins: ['tav_common', 'tav_counter'] });
    expect(seesNow(s, crack)).toBe(true);
    const A = { ...s.player.pos!, floor: 0 }, B = { ...crack.at, floor: 0 };
    const beyond = { x: B.x + (B.x - A.x), y: B.y + (B.y - A.y), floor: 0 };
    expect(walkPath(s, A, beyond, { walker: s.player, body: s.player })?.through ?? []).not.toContain(crack);
    s.player.core.bodyTypeId = BT.amorphous;
    expect(walkPath(s, A, beyond, { walker: s.player, body: s.player })?.through).toContain(crack);
    s.player.core.bodyTypeId = BT.humanoid;
    expect(addWear(s, s.player, job, t * 0.5)).toEqual({ share: 1, reached: 'destroyed' });
    expect(crack.crack).toBeUndefined();
    expect(crack.widthM).toBe(CONFIG.BREAK_HOLE_M[0]);
    expect(w.dents).toBeUndefined();
    expect(waysOut(s, 'tav_common').some((l) => l.opening === crack && l.to === 'tav_counter')).toBe(true);
    expect(walkPath(s, A, beyond, { walker: s.player, body: s.player })?.through).toContain(crack);
    const next = wallJob(s, w.id); // breaking there again starts a new hole beside it, never through it
    expect(Math.hypot(next.dent.at.x - crack.at.x, next.dent.at.y - crack.at.y)).toBeGreaterThanOrEqual(CONFIG.BREAK_HOLE_M[0] - 1e-9);
  });

  it('BW12 a: a wall with nothing built behind it breaks into a frontier', () => {
    const s = quiet();
    const w = wallTo(s, 'tav_common', undefined);
    atWall(s, w);
    const job = wallJob(s, w.id);
    expect(job.to).toBeUndefined();
    addWear(s, s.player, job, breakSeconds(s, s.player, job.stuff));
    const hole = s.openings.find((o) => o.wall === w.id)!;
    expect(hole.frontier).toBe(true);
    expect(hole.joins[0]).toBe('tav_common');
  });

  it('BW13 a: helpers add their rates: each one\'s work counts as a share of the whole at their own speed', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'patron_1'] });
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    const w = wallTo(s, 'tav_common', 'tav_counter');
    atWall(s, w);
    g.zone = s.player.zone; g.placeId = s.player.placeId; g.pos = { ...s.player.pos! };
    const job = wallJob(s, 'tav_counter');
    addWear(s, s.player, job, breakSeconds(s, s.player, job.stuff) * 0.25);
    const helper = breakJob(s, g, 'tav_counter') as Extract<BreakJob, { kind: 'wall' }>;
    expect(helper.dent).toBe(job.dent); // the same spot
    addWear(s, g, helper, breakSeconds(s, g, helper.stuff) * 0.25);
    expect(jobShare(job)).toBeCloseTo(0.5, 6);
    expect(secondsLeft(s, s.player, job)).toBeCloseTo(breakSeconds(s, s.player, job.stuff) * 0.5, 3);
  });

  it('out of a fight the order runs the whole break on the world clock; the breakthrough is one step louder than the blows', () => {
    const s = quiet();
    const w = wallTo(s, 'tav_common', 'tav_counter');
    atWall(s, w);
    const need = breakSeconds(s, s.player, wallStuff(w)!);
    expect(need).toBeGreaterThan(CONFIG.EXPLORE_TURN_S); // a long action (a stretch on the world clock)
    const t0 = now(s);
    const ev = turn(s, brk('tav_counter')).find((e) => e.kind === 'break_through')!;
    expect(ev.breakThrough).toMatchObject({ wall: w.id, to: 'tav_counter', share: 1, state: 'destroyed' });
    expect(ev.noise).toBe(NOISE.at(NOISE.pos(wallStuff(w)!.material.noise) + 1));
    expect((now(s) - t0) * 60).toBeGreaterThanOrEqual(need - 1);
    expect(waysOut(s, 'tav_common').some((l) => l.to === 'tav_counter' && l.opening.wall === w.id)).toBe(true);
    const nv = buildNarrationView(s, [ev]).events.find((e) => e.kind === 'break_through')!;
    expect(nv.breakThrough).toMatchObject({ what: 'brick wall', to: zoneById(s, 'tav_counter')!.name, state: 'destroyed' });
  });

  it('in a fight each turn puts the turn\'s time into it and sounds as the material; a door broken down lets anyone through', () => {
    const s = quiet('street_door');
    byDoor(s, 'player', 'street_door', 'tav_common', 0.5);
    const b: Barrier = putBarrier(s, 'tav_common', 'street_door', { id: 'front_door', kind: BK.door, grade: 'minor', lock: { locked: true } });
    s.mode = 'tactical';
    s.player.react = { s: 0, init: 100, turn: s.turn };
    const ev = turn(s, brk('tav_common')).find((e) => e.kind === 'break_through')!;
    expect(ev.breakThrough!.barrier).toBe('front_door');
    expect(ev.breakThrough!.share).toBeGreaterThan(0);
    expect(ev.breakThrough!.share).toBeLessThan(1);
    expect(ev.noise).toBe('loud'); // oak: loud blows
    expect(Object.values(b.wear!)[0]).toBeGreaterThan(0);
    // finish it off
    addWear(s, s.player, breakJob(s, s.player, 'tav_common') as BreakJob, 1e6);
    expect(b.state).toBe('destroyed');
    expect(passage(b, undefined, 'street_door')).toBe('open');
  });

  it('BW9 b: work on a material that regrows is lost after REGROW_S with nobody at it, and its crack closes', () => {
    const s = quiet();
    const w = wallTo(s, 'tav_common', 'tav_counter');
    w.material = BM.living_wood; w.thicknessM = 0.4;
    atWall(s, w);
    const job = wallJob(s, 'tav_counter');
    addWear(s, s.player, job, breakSeconds(s, s.player, job.stuff) * 0.6);
    const crack = job.dent.hole;
    expect(crack).toBeDefined();
    s.turn += 1;
    s.turnEnds = { [job.dent.turn]: now(s) - CONFIG.REGROW_S / 60 / 2 };
    const again = wallJob(s, 'tav_counter');
    regrow(s, again);
    expect(jobShare(again)).toBeGreaterThan(0); // half a minute: still there
    s.turnEnds = { [job.dent.turn]: now(s) - (CONFIG.REGROW_S + 1) / 60 };
    regrow(s, again);
    expect(jobShare(again)).toBe(0);
    expect(s.openings.some((o) => o.id === crack)).toBe(false);
  });

});


describe('402 walking through (BW21 a)', () => {
  const walkTo = (s: GameState, zone: string, at: { x: number; y: number }) => turn(s, intent({ move: { toZone: zone, spot: { at } } }));
  it('a wall that would take WALK_THROUGH_S or less does not stop the walker: a straight walk breaks a hole on the way, one step louder', () => {
    const s = quiet();
    const w = wallTo(s, 'tav_common', 'street_door');
    w.material = BM.glass; w.thicknessM = 0.005; // a pane: under 2 s for this walker
    expect(breakSeconds(s, s.player, wallStuff(w)!)).toBeLessThanOrEqual(CONFIG.WALK_THROUGH_S);
    s.player.pos = { x: -3, y: -3 };
    const ev = walkTo(s, 'street_door', { x: -3, y: -5 });
    const b = ev.find((e) => e.kind === 'break_through')!;
    expect(b.breakThrough).toMatchObject({ wall: w.id, to: 'street_door', state: 'destroyed', walked: true });
    expect(b.noise).toBe(NOISE.at(NOISE.pos(wallStuff(w)!.material.noise) + 1));
    expect(s.player.zone).toBe('street_door');
    expect(s.openings.some((o) => o.wall === w.id && o.kind && !o.barrier && o.labels[0].startsWith('a hole broken'))).toBe(true);
  });
  it('a wall that would take longer stops them: the walk goes round by the door, nothing broken', () => {
    const s = quiet();
    s.player.pos = { x: -3, y: -3 };
    const ev = walkTo(s, 'street_door', { x: -3, y: -5 });
    expect(ev.some((e) => e.kind === 'break_through')).toBe(false);
    expect(s.player.zone).toBe('street_door');
  });
  it('a shut door weak enough is broken down on the way through; the walk round being no longer, a wall is left standing', () => {
    const s = quiet();
    const b = putBarrier(s, 'tav_common', 'street_door', { id: 'front_door', kind: BK.door, grade: 'minor', lock: { locked: true }, material: BM.glass, thicknessCm: 0.5 });
    s.player.pos = { x: 0, y: -2 };
    const ev = walkTo(s, 'street_door', { x: 0, y: -6 });
    expect(ev.find((e) => e.kind === 'break_through')?.breakThrough).toMatchObject({ barrier: 'front_door', state: 'destroyed', walked: true });
    expect(b.state).toBe('destroyed');
    expect(s.player.zone).toBe('street_door');
    expect(s.openings.some((o) => o.labels[0].startsWith('a hole broken'))).toBe(false);
  });
});
