// BF8: a lie seen through by LIE_PLAIN_GAP tiers or more is plainly a lie; a one-tier win gives the hint, and Plain as Day
// makes every win plain. BF10: a lie the player ties with leaves the hint (a doubt), short of seeing through it.
// BF11 (BG-139, run 95): a place an NPC's own agent moved it to holds AGENT_STAY_TURNS before its routine takes it back.
// BF9 (BG-136): anyone following the player who is together with them travels with them, not only bandmates.
import { DU } from '../../src/library/tableIds';
import { actionRow } from '../../src/ruleset/actionTime';
import { expect, it } from 'vitest';
import type { ContestResult, GameEvent } from '../../src/types';
import type { Actor } from '../../src/types';
import { makeVillage } from '../harness';
import { staying } from '../../src/minds';
import { applySpeech, pressedWords, PLAIN, TELL } from '../../src/engine/speech';
import { companions } from '../../src/engine/travel';
import { CONFIG } from '../../src/config';
import { PK } from '../../src/library/perkIds';
import { act, plannerOut, play } from './w4-kit';
import { ago, tick, turnsFor } from '../harness/time';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const lie = (gap: number, push: object) => ({ push: { type: 'deceive', ...push }, contest: { a: { tier: 'success' }, gap } }) as unknown as GameEvent;

it('BF8, BF10: how plainly a lie seen through reads', () => {
  const s = makeVillage();
  const c = (gap: number) => ({ gap, winner: gap > 0 ? 'b' : gap < 0 ? 'a' : 'tie' }) as ContestResult;
  const npc = s.actors.find((a) => a.id === 'patron_1')!;
  expect(applySpeech(npc, s.player, 'deceive', c(0))).toEqual({ doubt: true });
  expect(applySpeech(npc, s.player, 'deceive', c(-1))).toEqual({});
  expect(pressedWords(lie(0, { doubt: true }), s.player)).toEqual({ took: TELL });
  expect(pressedWords(lie(1, { tell: true }), s.player)).toEqual({ took: TELL });
  expect(pressedWords(lie(CONFIG.LIE_PLAIN_GAP, { tell: true }), s.player)).toEqual({ took: PLAIN });
  give(s.player, PK.plain_as_day);
  expect(pressedWords(lie(1, { tell: true }), s.player)).toEqual({ took: PLAIN });
  expect(pressedWords(lie(0, { doubt: true }), s.player)).toEqual({ took: TELL }); // a tie is not a win
});

it('BF11: a place its own agent chose holds before the routine takes it back', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  const m = s.actors.find((a) => a.id === 'patron_1')!;
  m.mind!.control = 'agent';
  play(s, { agentOutputs: [plannerOut(m.id, act('move', 'street_door'))] });
  m.mind!.control = 'code';
  expect(m.zone).toBe('street_door');
  for (let i = 0; i < turnsFor(CONFIG.AGENT_STAY_S, actionRow(DU.action)!.seconds); i++) { play(s); expect(m.zone).toBe('street_door'); }
  play(s);
  expect(staying(s, m)).toBe(false); // from here its routine leads again
});

it('BF9: someone following the player travels with them', () => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  const m = s.actors.find((a) => a.id === 'patron_1')!;
  expect(companions(s, s.player)).not.toContain(m);
  m.mind!.routine = { id: 'follow', anchorTurn: s.turn, at: 0 };
  expect(companions(s, s.player)).toContain(m);
});
