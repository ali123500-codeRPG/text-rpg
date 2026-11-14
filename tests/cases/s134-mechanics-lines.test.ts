// 134 Mechanics lines and turn results (play screen review UI5, T1, M2): the mechanics panel never shows dice for
// someone or something the player doesn't clearly perceive, reads in plain words, and level-ups, achievements and
// rolls against the player reach the story line as fields, so they show with mechanics off.
import { describe, expect, it } from 'vitest';
import { makeVillage, place } from '../harness';
import { lineExtras, mechanicsLines, turnNotes } from '../../src/agents/game';
import { achievementName, awardXp, grantAchievement, xpToNext } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { CL } from '../../src/library/classIds';
import { ACH } from '../../src/library/achievementIds';
import { SK } from '../../src/library/skillIds';
import type { GameEvent, GameState, NarrationView, RollResult } from '../../src/types';

const ev = (s: GameState, x: Partial<GameEvent>): GameEvent => ({
  id: `e${Math.random()}`, turn: s.turn, actorId: 'player', kind: 'search', zone: s.player.zone, effects: [], noise: 'quiet', visibility: 'normal',
  perception: { player: { level: 'full', cue: 'sight' } }, ...x,
} as GameEvent);
const roll = (actorId: string, skill: string, d100: number, tier: RollResult['tier']): RollResult =>
  ({ actorId, skill, d100, margin: 0, tier, natural: 0, modifiers: [], tierShifts: [] });
const check = (actorId: string, skill: string) => ({ actorId, skill, target: 35, passed: false, modifiers: [] });

describe('134 mechanics lines', () => {
  it('a sight roll shows only once its target is perceived (UI5); the player\'s own search reads plainly', () => {
    const s = makeVillage();
    expect(mechanicsLines(s, [ev(s, { target: 'slime_1', check: check('player', SK.eyesight) })])).toEqual([]); // slime in the field, unseen
    expect(mechanicsLines(s, [ev(s, { target: 'patron_1', check: check('player', SK.eyesight) })])).toEqual(['Your eyesight vs difficulty 35: failed']);
    expect(mechanicsLines(s, [ev(s, { check: check('player', SK.eyesight) })])).toEqual(['Your eyesight vs difficulty 35: failed']);
  });
  it('someone only heard shows no dice; someone seen goes by the name the player knows them by', () => {
    const s = makeVillage();
    const npc = (level: 'full' | 'partial') => ev(s, { actorId: 'patron_1', perception: { player: { level, cue: 'sound' } }, roll: roll('patron_1', SK.earshot, 40, 'success') });
    expect(mechanicsLines(s, [npc('partial')])).toEqual([]);
    expect(mechanicsLines(s, [npc('full')])[0]).toMatch(/^.+’s earshot d100 40 → Success$/);
    expect(mechanicsLines(s, [npc('full')])[0]).not.toMatch(/patron_1|Old Wim/);
  });
  it('a contest names both sides\' skills and the winner in words', () => {
    const s = makeVillage();
    const c = { a: roll('player', SK.persuasion, 70, 'great_success'), b: roll('patron_1', SK.persuasion, 20, 'failure'), gap: -2, winner: 'a' as const };
    expect(mechanicsLines(s, [ev(s, { kind: 'talk', target: 'patron_1', contest: c })])[0]).toMatch(/^Your persuasion d100 70 → Great Success vs .+’s persuasion d100 20 → Failure: you win$/);
  });
  it('attacks name the part, round the damage, and an unseen attacker stays "someone"', () => {
    const s = makeVillage();
    place(s, 'slime_1', s.player.zone);
    s.actors.find((a) => a.id === 'slime_1')!.posture = 'stealthy'; // nobody has seen it
    const attack = {
      attack: roll('slime_1', SK.unarmed_strike, 80, 'success'), defense: roll('player', SK.block, 30, 'near_miss'), defenseType: 'block' as const, gap: 1, gapShifts: [],
      outcome: 'full_hit' as const, location: 'general', locationHow: 'rolled' as const, multiplier: 1, damage: 9.5875, deciding: { attack: [], defense: [], gap: [] },
      attackerId: 'slime_1', targetId: 'player', weaponId: '', modeId: '',
    };
    const line = mechanicsLines(s, [ev(s, { actorId: 'slime_1', kind: 'attack', target: 'player', perception: {}, attack })])[0];
    expect(line).toMatch(/^Someone → you: .+; full hit \(torso\), damage 9\.6$/);
    expect(line).not.toMatch(/general|slime/i);
  });
  it('BF70 (BG-246): a roll moved by outcome steps shows the outcome before them, the steps and why, then the outcome they made', () => {
    const s = makeVillage();
    place(s, 'patron_1', s.player.zone);
    const short = { ...roll('patron_1', SK.melee_medium, 49, 'critical_failure'), beyond: -6, modifiers: [{ source: 'weapon', type: 'gear', value: 9 }], tierShifts: [{ source: "Short of an old sword's requirement", value: -8 }] } as RollResult;
    const attack = {
      attack: short, defense: { ...roll('player', SK.dodge, 30, 'failure'), tierShifts: [{ source: 'cover', value: 1 }] }, defenseType: 'dodge' as const, gap: null, gapShifts: [],
      outcome: 'missed' as const, location: null, locationHow: 'rolled' as const, multiplier: 1, damage: 0, deciding: { attack: [], defense: [], gap: [] },
      attackerId: 'patron_1', targetId: 'player', weaponId: '', modeId: '',
    };
    const line = mechanicsLines(s, [ev(s, { actorId: 'patron_1', kind: 'attack', target: 'player', attack } as never)])[0];
    expect(line).toContain("d100 49 → Near Miss [weapon +9], 8 steps down [Short of an old sword's requirement -8] → Critical Failure−−−−−−");
    expect(line).toContain('dodge d100 30 → Critical Failure, 1 step up [cover +1] → Failure');
    // with no steps the line reads as before
    expect(mechanicsLines(s, [ev(s, { roll: roll('player', SK.eyesight, 40, 'success') })])).toEqual(['Your eyesight d100 40 → Success']);
  });

  it('level-ups name the class; level-ups and achievements also land on the story line', () => {
    const s = makeVillage();
    awardXp(s, xpToNext(s.player), 'test');
    grantAchievement(s, ACH.defeats_10);
    const lines = mechanicsLines(s, []);
    expect(lines).toContain(`Level 2! (${getLibrary().classes[CL.swordsman].name})`);
    expect(lines.join(' ')).not.toMatch(/\(\d+\)/);
    const notes = turnNotes(s);
    expect(notes.levelUps).toEqual([{ classId: CL.swordsman, level: 2 }]);
    const got = s.player.progression!.achievements!.at(-1)!;
    expect(notes.achievements).toEqual([expect.objectContaining({ id: got.id, name: achievementName(s, got) })]);
    expect(notes.achievements![0].levelName).toBeTruthy(); // the play card shows the reward level, what it asks for and why
    expect(notes.achievements![0].earnedAt).toBeTruthy();
    expect(notes.achievements![0].why).toMatch(/^Turn /);
  });
  it('rolls others make against the player land on the story line as incomingChecks', () => {
    const s = makeVillage();
    const attack = {
      attack: roll('patron_1', SK.unarmed_strike, 80, 'success'), defense: roll('player', SK.dodge, 30, 'failure'), defenseType: 'dodge' as const, gap: 2, gapShifts: [],
      outcome: 'full_hit' as const, location: 'left_arm', locationHow: 'rolled' as const, multiplier: 1, damage: 3, deciding: { attack: [], defense: [], gap: [] },
      attackerId: 'patron_1', targetId: 'player', weaponId: '', modeId: '',
    };
    const e = ev(s, { actorId: 'patron_1', kind: 'attack', target: 'player', attack });
    const nv = { events: [{ id: e.id, kind: 'attack', level: 'full', cue: 'sight', packet: { actor: 'an old man', outcome: 'full hit', location: { part: 'left arm', how: 'rolled' }, changes: [] } }], heard: [] } as unknown as NarrationView;
    const x = lineExtras(s, [e], nv, '');
    expect(x.check).toBeUndefined();
    expect(x.incomingChecks).toEqual([{ by: 'an old man', kind: 'attack', skill: SK.unarmed_strike, tier: 'success', against: { what: 'your dodge', tier: 'failure' }, result: 'full hit, left arm' }]);
  });
});
