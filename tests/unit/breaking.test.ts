// Breaking walls and barriers by strength (BW18-BW26): the lift curve, the cube rule, tools, walking through, and the
// materials table with its default materials.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { barrierStuff, breakSeconds, breakSecondsAt, breakStrength, breakTool, liftKg, materialRow, walksThrough, wallStuff } from '../../src/ruleset/breaking';
import { refFighter } from '../../src/engine/fightModel';
import { equipLoadout } from '../../src/library/spawn';
import { getLibrary } from '../../src/library';
import { BK, BM, WK } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import { CONFIG } from '../../src/config';
import type { Actor, GameState, Wall } from '../../src/types';

const sheet = (S: GameState, id: string, skills: Record<string, number>, kit: string[] = []): Actor => {
  const a = refFighter(S, 0, id).ref;
  a.core.skills = Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, { raw: v, state: 'normal' as const }]));
  a.core.inventory = equipLoadout(S, kit, id);
  return a;
};
const row = (id: string) => materialRow(id)!;
const wall = (kind: string, extra: Partial<Wall> = {}): Wall => ({ id: 'w', placeId: 'p', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, floor: 0, top: 3, kind, thicknessM: CONFIG.WALL_THICKNESS_M, ...extra });

describe('lift (BW19 a)', () => {
  it('follows the anchors up to 100 and doubles every 50 past it, with no top', () => {
    expect(liftKg(50)).toBe(250);
    expect(liftKg(75)).toBe(510);
    expect(liftKg(100)).toBe(600);
    expect(liftKg(150)).toBeCloseTo(1200, 6);
    expect(liftKg(200)).toBeCloseTo(2400, 6);
    expect(liftKg(400)).toBeCloseTo(600 * 64, 6);
    expect(liftKg(62.5)).toBeCloseTo(380, 6);
  });
});

describe('breaking time (BW20 a, BW22 a)', () => {
  it('a working professional with a tool takes the material time; time grows with thickness and falls with the cube of force', () => {
    const brick = row(BM.brick);
    expect(breakSecondsAt(brick, brick.exampleCm, 50, true)).toBeCloseTo(brick.secondsAt50, 6);
    expect(breakSecondsAt(brick, brick.exampleCm * 2, 50, true)).toBeCloseTo(brick.secondsAt50 * 2, 6);
    const ref = liftKg(50) + CONFIG.BREAK_TOOL_KG;
    expect(breakSecondsAt(brick, brick.exampleCm, 50, false)).toBeCloseTo(brick.secondsAt50 * (ref / liftKg(50)) ** 3, 6);
    expect(breakSecondsAt(brick, brick.exampleCm, 200, false)).toBeCloseTo(brick.secondsAt50 * (ref / 2400) ** 3, 6);
  });
  it('a tool matters in the human range and fades past 100', () => {
    const stone = row(BM.stone);
    const gain = (s: number) => breakSecondsAt(stone, 60, s, false) / breakSecondsAt(stone, 60, s, true);
    expect(gain(50)).toBeGreaterThan(2);
    expect(gain(300)).toBeLessThan(1.05);
  });
  it('the ladder pictures: mortal masonry is walked through by 300; starmetal still stops a Transcendent (BW21 a)', () => {
    const castle = breakSecondsAt(row(BM.stone), 250, 300, false), door = breakSecondsAt(row(BM.oak), 5, 200, false);
    expect(castle).toBeLessThanOrEqual(CONFIG.WALK_THROUGH_S);
    expect(door).toBeLessThanOrEqual(CONFIG.WALK_THROUGH_S);
    expect(breakSecondsAt(row(BM.starmetal), 20, 300, false)).toBeGreaterThan(CONFIG.WALK_THROUGH_S);
    expect(breakSecondsAt(row(BM.stone), 250, 50, true)).toBeGreaterThan(3600); // hours of work for a mason
  });
  it('reads the actor: strength rating, best tool, Shield Breaker counts a heavy weapon', () => {
    const S = makeVillage({ seed: 3 });
    const bare = sheet(S, 'bare', { [SK.melee_heavy]: 50, [SK.endurance]: 50 });
    const tooled = sheet(S, 'tool', { [SK.melee_heavy]: 50, [SK.endurance]: 50 }, [IT.pick]);
    expect(breakTool(S, bare)).toBeUndefined();
    expect(breakTool(S, tooled)?.itemId).toBeDefined();
    const stuff = { material: row(BM.brick), cm: 20 };
    expect(breakSeconds(S, tooled, stuff)).toBeLessThan(breakSeconds(S, bare, stuff));
    expect(breakSeconds(S, bare, stuff)).toBeCloseTo(breakSecondsAt(stuff.material, 20, breakStrength(S, bare), false), 6);
    const great = sheet(S, 'great', { [SK.melee_heavy]: 300, [SK.endurance]: 300 });
    expect(walksThrough(S, great, { material: row(BM.stone), cm: 250 })).toBe(true);
    expect(walksThrough(S, bare, stuff)).toBe(false);
  });
});

describe('materials (BW24 a, BW26 a, BW8 a, BW9 b)', () => {
  it('every row has a source line, an example thickness inside its range, and no warded row', () => {
    for (const m of Object.values(getLibrary().barrierMaterials ?? {})) {
      expect(m.source.length, m.id).toBeGreaterThan(10);
      expect(m.exampleCm, m.id).toBeGreaterThanOrEqual(m.thicknessCm[0]);
      expect(m.exampleCm, m.id).toBeLessThanOrEqual(m.thicknessCm[1]);
      expect(m.name.toLowerCase(), m.id).not.toContain('ward');
    }
  });
  it('every solid wall kind and every barrier kind names a default material', () => {
    for (const k of Object.values(getLibrary().wallKinds ?? {})) if (!k.none) expect(materialRow(k.material), k.id).toBeDefined();
    for (const k of Object.values(getLibrary().barrierKinds ?? {})) expect(materialRow(k.material), k.id).toBeDefined();
  });
  it('a wall with no material reads its kind\'s at that material\'s example thickness; its own material reads its own thickness', () => {
    expect(wallStuff(wall(WK.wall))).toEqual({ material: row(BM.brick), cm: row(BM.brick).exampleCm });
    expect(wallStuff(wall(WK.glazed))?.material.id).toBe(BM.glass);
    expect(wallStuff(wall(WK.wall, { material: BM.stone, thicknessM: 2.5 }))).toEqual({ material: row(BM.stone), cm: 250 });
    expect(barrierStuff({ id: 'b', kind: BK.rubble, grade: 'minor' })?.material.id).toBe(BM.rubble);
    expect(barrierStuff({ id: 'b', kind: BK.door, grade: 'minor', thicknessCm: 8 })).toEqual({ material: row(BM.oak), cm: 8 });
  });
});
