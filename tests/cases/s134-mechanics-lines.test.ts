// 134 Mechanics lines and turn results (play screen review UI5, T1, M2): the mechanics panel never shows dice for
// someone or something the player doesn't clearly perceive, reads in plain words, and level-ups, achievements and
// rolls against the player reach the story line as fields, so they show with mechanics off.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { mechanicsLines } from '../../src/agents/game';
import { SK } from '../../src/library/skillIds';
import type { GameEvent, GameState } from '../../src/types';

const ev = (s: GameState, x: Partial<GameEvent>): GameEvent => ({
  id: `e${Math.random()}`, turn: s.turn, actorId: 'player', kind: 'search', zone: s.player.zone, effects: [], noise: 'quiet', visibility: 'normal',
  perception: { player: { level: 'full', cue: 'sight' } }, ...x,
} as GameEvent);
const out = (skill: string) => ({ skill, grade: 'minor' as const, gate: 'out' as const });

describe('134 mechanics lines', () => {
  it('a sight roll shows only once its target is perceived (UI5); the player\'s own search reads plainly', () => {
    const s = makeVillage();
    expect(mechanicsLines(s, [ev(s, { target: 'slime_1', obstacle: out(SK.eyesight) })])).toEqual([]); // slime in the field, unseen
    expect(mechanicsLines(s, [ev(s, { target: 'patron_1', obstacle: out(SK.eyesight) })])).toEqual(['Your eyesight vs Minor: out of reach, no roll']);
    expect(mechanicsLines(s, [ev(s, { obstacle: out(SK.eyesight) })])).toEqual(['Your eyesight vs Minor: out of reach, no roll']);
  });

});
