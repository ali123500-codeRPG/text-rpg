// OD5 a, OD14 a, OD15 a (questions page "Obstacle difficulty"): what each tier of a graded act does in code, an NPC's
// agent grading its own act (a grade left out is flagged as grade_gap), and BG-257 (each roll line says what it did).
import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState, Intent } from '../../src/types';
import { forcedRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { npcActionToOrder } from '../../src/engine/merge';
import { zoneById } from '../../src/engine/relations';
import { makeFurniture } from '../../src/engine/furniture';
import { effectiveSkill } from '../../src/ruleset';
import { lineExtras } from '../../src/agents/game';
import { buildNarrationView } from '../../src/views';
import { NOISE } from '../../src/scales';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { act, intent } from './w4-kit';
import { layAll } from '../harness';

const village = (): GameState => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'patron_1', 'trader'] });
  s.player.core.skills[SK.endurance] = { raw: 50, state: 'normal' };
  zoneById(s, 'tav_common')!.furniture = makeFurniture('tav_common', [{ kind: 'other', name: 'winch', at: 'n', grade: 'major' }]);
  return s;
};
const winch = (s: GameState) => zoneById(s, 'tav_common')!.furniture![0];
const turn = (s: GameState, i: Intent, d: number[]): GameEvent[] => { s.turn += 1; s.log = []; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, forcedRng([50, ...d])); };
const tryWinch = (s: GameState, d: number, extra: object = {}) =>
  turn(s, intent({ action: { type: 'interact', skill: SK.endurance, target: winch(s).id, ...extra } }), [d]).find((e) => e.kind === 'interact')!;
const quiet = (s: GameState) => turn(s, intent({ action: { type: 'interact', skill: SK.endurance, target: winch(s).id } }), [50]).find((e) => e.kind === 'interact')!.noise;
const step = (n: GameEvent['noise'], by: number) => NOISE.keys[NOISE.pos(n) + by];

describe('334 what a graded act\'s tier does (OD5 a)', () => {
  it('the roll is at the grade the test thinks (Endurance 50 against Major)', () => {
    expect(effectiveSkill(village(), village().player, SK.endurance).value).toBe(50);
  });
  it('Critical Failure with nothing to break and no drop: a loud noise, one step up', () => {
    const s = village(), base = quiet(village());
    const ev = tryWinch(s, 1);
    expect(ev.tier).toBe('critical_failure');
    expect(ev.mishap).toEqual({ kind: 'noise' });
    expect(ev.noise).toBe(step(base, 1));
  });
  it('Critical Failure on a climb: a fall of its drop, on the falls table', () => {
    const s = village();
    const evs = turn(s, intent({ action: { type: 'interact', skill: SK.endurance, target: winch(s).id, fall: 4 } }), [1]);
    const ev = evs.find((e) => e.kind === 'interact')!;
    expect(ev.mishap).toEqual({ kind: 'fall' });
    expect(ev.fall).toMatchObject({ metres: 4 });
    expect(buildNarrationView(s, evs).events.find((e) => e.kind === 'interact')).toMatchObject({ graded: true, mishap: { kind: 'fall' }, fall: { metres: 4 } });
  });
  it('Critical Failure with an item used: it breaks into its broken version', () => {
    const s = village();
    s.player.core.inventory.push({ id: 'rope1', itemId: IT.lockpicks });
    const evs = turn(s, intent({ action: { type: 'use_item', skill: SK.endurance, target: winch(s).id, item: 'rope1' } }), [1]);
    const ev = evs.find((e) => e.kind === 'use_item')!;
    expect(ev.mishap).toEqual({ kind: 'tool', item: 'rope1' });
    expect(s.player.core.inventory.find((i) => i.id === 'rope1')!.itemId).toBe(`${IT.lockpicks}_broken`);
    expect(buildNarrationView(s, evs).events.find((e) => e.kind === 'use_item')!.mishap).toEqual({ kind: 'tool', item: 'broken lockpicks' });
  });
  it('Failure: beyond the actor at that skill until it is better; the next try has no roll', () => {
    const s = village();
    expect(tryWinch(s, 15).tier).toBe('failure');
    const again = tryWinch(s, 100);
    expect(again.obstacle?.gate).toBe('out');
    expect(again.roll).toBeUndefined();
    s.player.core.skills[SK.endurance] = { raw: 60, state: 'normal' };
    expect(tryWinch(s, 50).obstacle?.gate).toBe('roll');
  });
  it('Great Success: done quietly, one noise step down; Near Miss and Success change nothing in code', () => {
    const s = village(), base = quiet(village());
    const ev = tryWinch(s, 75);
    expect(ev.tier).toBe('great_success');
    expect(ev.noise).toBe(step(base, -1));
    const nm = tryWinch(s, 30);
    expect(nm.tier).toBe('near_miss');
    expect([nm.mishap, winch(s).beyond]).toEqual([undefined, undefined]);
  });
});

describe('334 who grades an NPC act (OD14 a)', () => {
  it('the NPC agent\'s grade and drop reach its order', () => {
    expect(npcActionToOrder('n1', act('other', null, { skill: SK.endurance, grade: 'major', fall: 3 }), {})).toMatchObject({ grade: 'major', fall: 3 });
  });
  it('a graded act with no grade anywhere is Moderate and flagged every time (grade_gap)', () => {
    const s = village();
    winch(s).grade = undefined;
    turn(s, intent({ action: { type: 'interact', skill: SK.endurance, target: winch(s).id } }), [50]);
    expect(s.log.filter((l) => l.code === 'grade_gap')).toHaveLength(1);
    winch(s).grade = undefined;
    turn(s, intent({ action: { type: 'interact', skill: SK.endurance, target: winch(s).id, grade: 'minor' } }), [50]);
    expect(s.log.filter((l) => l.code === 'grade_gap')).toHaveLength(0);
  });
});

describe('334 BG-257: each roll line says what that roll did', () => {
  const line = (s: GameState, evs: GameEvent[]) => lineExtras(s, evs, buildNarrationView(s, evs), '').check;
  it('a lock pick names what happened at the lock, never Look around\'s words', () => {
    const s = village();
    s.player.core.skills[SK.lockpicking] = { raw: 50, state: 'normal' };
    layAll(s, 'tav_common', { id: 'box', itemId: IT.chest, contents: [], lock: { locked: true }, grade: 'major' });
    const evs = turn(s, intent({ action: { type: 'pick', target: 'box' } }), [50]);
    expect(line(s, evs)?.result).toMatch(/^(the lock opens|still at it|not yet|beyond you for now|the pick snaps)$/);
  });
  it('a roll with no words of its own (healing) shows none; Look around keeps its words', () => {
    const s = village();
    const heal = { id: 'h', turn: 1, actorId: 'player', kind: 'heal', zone: 'tav_common', effects: [], noise: 'quiet', visibility: 'normal', perception: {},
      roll: { actorId: 'player', skill: SK.healing, d100: 80, margin: 30, tier: 'great_success', natural: 0, modifiers: [], tierShifts: [] } } as unknown as GameEvent;
    expect(line(s, [heal])?.result).toBe('');
    const look = turn(s, intent({ action: { type: 'observe', skill: SK.eyesight } }), [90]);
    expect(line(s, look)?.result).toMatch(/^(you make out who is there|nothing clearer)$/);
  });
});
