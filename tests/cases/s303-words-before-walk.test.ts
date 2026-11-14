// BF36: on turn 24 Wren called "Here! Take it to him..." as he left, but his words were placed where his walk ended, beyond
// the kitchen wall, so Happi never heard them. Words beside a move are now heard from where they are said: an NPC says them
// as it sets off unless it chose to say them on arrival (speakAt "end"); the player's word order decides (move.after).
import { describe, expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { act, intent, play, plannerOut } from './w4-kit';
import { buildNarrationView } from '../../src/views';
import type { GameEvent, GameState } from '../../src/types';

const tavern = () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const w = beside(s, 'patron_1', 'player', 1);
  return { s, w };
};
const first = (ev: GameEvent[], id: string, f: (e: GameEvent) => boolean) => ev.findIndex((e) => e.actorId === id && f(e));
const said = (e: GameEvent) => !!e.line;
const walked = (e: GameEvent) => e.kind === 'move';
const heard = (s: GameState, ev: GameEvent[], text: string) => buildNarrationView(s, ev).events.some((e) => e.line?.text === text);

describe('BF36 words before or after a walk', () => {
  it('an NPC that talks and walks off says it as it sets off, where the player hears it', () => {
    const { s, w } = tavern();
    const ev = play(s, { agentOutputs: [plannerOut(w.id, act('talk', 'player'), { dialogue: { line: 'Take it to him.', volume: 'normal' }, move: { toZone: 'street_square' } })] });
    expect(w.zone).not.toBe('tav_common');
    expect(first(ev, w.id, said)).toBeGreaterThanOrEqual(0);
    expect(first(ev, w.id, said)).toBeLessThan(first(ev, w.id, walked));
    expect(heard(s, ev, 'Take it to him.')).toBe(true);
  });
  it('a line beside a dash is said before the dash', () => {
    const { s, w } = tavern();
    const ev = play(s, { agentOutputs: [plannerOut(w.id, act('hold'), { dialogue: { line: 'Here, take it!', volume: 'normal' }, move: { toZone: 'street_square' } })] });
    expect(first(ev, w.id, said)).toBeLessThan(first(ev, w.id, walked));
    expect(heard(s, ev, 'Here, take it!')).toBe(true);
  });
  it('speakAt end: the NPC walks there first, then says it', () => {
    const { s, w } = tavern();
    const ev = play(s, { agentOutputs: [plannerOut(w.id, act('talk', 'player'), { dialogue: { line: 'I am here.', volume: 'normal' }, move: { toZone: 'street_square', speakAt: 'end' } })] });
    expect(first(ev, w.id, said)).toBeGreaterThan(first(ev, w.id, walked));
  });
  it('the player who speaks first is heard from the start; walking first, from the end', () => {
    const a = tavern();
    const ev = play(a.s, { intent: intent({ move: { toZone: 'street_square', after: true }, action: { type: 'talk', target: a.w.id }, spoken: 'Wait here.', addressees: [a.w.id] }) });
    expect(first(ev, a.s.player.id, said)).toBeLessThan(first(ev, a.s.player.id, walked));
    const b = tavern();
    const ev2 = play(b.s, { intent: intent({ move: { toZone: 'street_square' }, action: { type: 'talk', target: null }, spoken: 'Anyone here?' }) });
    expect(first(ev2, b.s.player.id, said)).toBeGreaterThan(first(ev2, b.s.player.id, walked));
  });
});
