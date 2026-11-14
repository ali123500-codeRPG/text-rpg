// Playtest, turns 51-60 (waiting behind the log heap). BG-230: watching from hiding was read as Hide, a 2-second
// order, so each watching turn passed 2 seconds. BG-231: "wait for someone to appear" had no order: a wait only ran to
// a time of day, and a passer-by coming into sight never stopped it. Now a wait with target "someone" runs on until anyone
// new comes into the player's senses, or CONFIG.WAIT_SOMEONE_MAX_H; the player stays hidden through it. BG-228: a clarify
// can carry two or three replies the player might pick.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { headTo } from '../../src/minds';
import { now } from '../../src/time';
import { CONFIG } from '../../src/config';
import { mechanicsLines } from '../../src/agents/game';
import { checkParserLegality } from '../../src/agents/legality';
import { checkIntent } from '../../src/agents/schema';
import { PARSER_INSTRUCTIONS } from '../../src/agents/prompts';
import { buildPlayerView } from '../../src/views';
import { WAIT_SOMEONE } from '../../src/scales';
import type { GameState } from '../../src/types';

const tavern = () => makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
const alone = () => makeVillage({ playerZone: 'field_far', without: ['slime_1', 'slime_2', 'guard_1', 'trader', 'patron_1'] });
const waitFor = (target: string | null) => intent({ action: { type: 'wait', target } });
const stopped = (s: GameState) => s.log.find((l) => l.code === 'stretch_stopped')?.detail as { kind: string; why: string; by: string[]; seconds: number } | undefined;

describe('BG-231: wait until someone appears', () => {
  it('runs on until someone walks into sight, then stops and gives the turn back; the player stays hidden', () => {
    const s = tavern();
    const w = s.actors.find((a) => a.id === 'patron_1')!;
    w.zone = 'street_square';
    delete w.pos;
    headTo(s, w, 'tav_common', 'weaver'); // a walker coming in, not after the player: a plain wait lets them pass (AT56)
    s.player.posture = 'stealthy';
    const t = now(s);
    const ev = play(s, { intent: waitFor(WAIT_SOMEONE) });
    expect(stopped(s)).toMatchObject({ kind: 'wait', why: 'appeared' });
    expect(stopped(s)!.by).toContain('patron_1');
    expect(now(s) - t).toBeGreaterThan(0);
    expect(now(s) - t).toBeLessThan(CONFIG.WAIT_SOMEONE_MAX_H * 60);
    expect(s.player.posture).toBe('stealthy');
    expect(mechanicsLines(s, ev).some((l) => /^Wait stopped after .*: someone came into sight or hearing$/.test(l))).toBe(true);
  });
  it('a plain wait until a time of day lets the same walker pass (AT56)', () => {
    const s = tavern();
    const w = s.actors.find((a) => a.id === 'patron_1')!;
    w.zone = 'street_square';
    delete w.pos;
    headTo(s, w, 'tav_common', 'weaver');
    play(s, { intent: waitFor(null) });
    expect(stopped(s)?.by ?? []).not.toContain('patron_1');
  });
  it('with nobody coming it stops after WAIT_SOMEONE_MAX_H, and says how long passed', () => {
    const s = alone();
    const t = now(s);
    const ev = play(s, { intent: waitFor(WAIT_SOMEONE) });
    expect(stopped(s)).toBeUndefined();
    expect(now(s) - t).toBeCloseTo(CONFIG.WAIT_SOMEONE_MAX_H * 60, 0);
    expect(mechanicsLines(s, ev).some((l) => l.startsWith(`Time passes: ${CONFIG.WAIT_SOMEONE_MAX_H} h`))).toBe(true);
  });
  it('someone already in sight when the wait starts does not stop it', () => {
    const s = tavern();
    const t = now(s);
    play(s, { intent: waitFor(WAIT_SOMEONE) });
    expect(stopped(s)?.by ?? []).not.toContain('patron_1');
    expect(now(s) - t).toBeGreaterThan(1);
  });
  it('the Parser may name "someone" as a wait\'s target; its rules send watching with no end there, not to Sneak', () => {
    const s = alone();
    const pv = buildPlayerView(s);
    const leg = checkParserLegality(waitFor('someone'), pv);
    expect(leg.illegal).toEqual([]);
    expect(leg.intent.action).toMatchObject({ type: 'wait', target: WAIT_SOMEONE });
    expect(PARSER_INSTRUCTIONS).toContain('is "wait" with target "someone"');
    expect(PARSER_INSTRUCTIONS).toContain('once player.stealthy, staying hidden and watching is the wait for someone');
  });
});

describe('BG-228: a clarify carries replies to pick', () => {
  it('the Parser output keeps its answers', () => {
    const r = checkIntent({ move: null, action: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: 'Hold your place?', answers: ['I hold my place', 'I go back inside'] });
    expect(r.errors).toEqual([]);
    expect(r.value).toMatchObject({ clarify: 'Hold your place?', answers: ['I hold my place', 'I go back inside'] });
  });
});
