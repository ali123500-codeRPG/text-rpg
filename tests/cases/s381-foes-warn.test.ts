// 381 Foes share what they notice (WN1-WN13): a foe that sees through a trick or spots someone hidden warns its allies
// with a shout (or a cry); knowing a trick answers it WARNED_SHIFT tiers better from then on; a warned believer looks again.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { intent as wtIntent, wholeTurn } from '../harness/turn';
import { CONFIG } from '../../src/config';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { RC } from '../../src/library/raceIds';
import { FX } from '../../src/library/tableIds';
import { FIGHT_RULES } from '../../src/library/fightRules';
import { openPlayDead, startPlayDead } from '../../src/engine/playDead';
import { HIDDEN, TRICK, knowsTrick, learn, pointedShift, queueLearned, sawThrough, warnedShift } from '../../src/engine/ruses';
import { codeWarn, giveWarning, warnEvent, warnVoice, warnedChecks } from '../../src/engine/warnings';
import { updateBeliefs } from '../../src/perception';
import { buildPlayerView } from '../../src/views';
import { deck } from '../../src/ui/deck';
import { checkParserLegality } from '../../src/agents/legality';
import { intent, play } from './w4-kit';
import { bannedLines } from '../harness/guard';
import type { Actor, GameEvent, GameState, Order } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const skill = (a: Actor, sk: string, raw: number) => { a.core.skills[sk] = { raw, state: 'normal' }; };
const lostAt = (level: string) => CONFIG.HEALTH_TRACK.find(([l]) => l === level)![1];
const hold = (a: Actor): Order => ({ actorId: a.id, type: 'hold', target: null, skill: null, intent: 'hold', source: 'fallback' });

/** a code-run tavern foe hostile to the player, beside it in the square */
function foe(s: GameState, id: string, x: number): Actor {
  const p = place(s, id, 'street_square');
  p.pos = { x, y: -14 };
  p.mind!.overrides = { player: 'hostile' };
  p.mind!.control = 'code';
  p.mind!.knowledge.player = { status: 'engaged', source: 'seen', revealed: [], lastKnownZone: 'street_square', lastSeenTurn: s.turn };
  delete p.asleep;
  for (const k of [SK.battle_sense, SK.command, SK.fieldcraft, SK.stratagem]) skill(p, k, 0);
  return p;
}
/** the player plays dead in the square before two tavern foes: the patron sees through it, the trader is fooled */
function twoFoes() {
  const s = makeVillage();
  place(s, 'player', 'street_square');
  s.player.pos = { x: 14, y: -14 };
  const sharp = foe(s, 'patron_1', 15), dull = foe(s, 'trader', 16);
  skill(sharp, SK.insight, 1000); skill(dull, SK.insight, 0);
  give(s.player, PK.play_dead); skill(s.player, SK.guile, 0);
  s.player.core.condition.hpLostPct = lostAt('wounded');
  openPlayDead(s, s.player);
  startPlayDead(s, s.player, createRng(3));
  for (const a of [sharp, dull]) a.engagement = { start: s.turn, last: s.turn, kinds: ['fight'], uses: {} } as never;
  return { s, sharp, dull };
}

describe('381 Foes share what they notice', () => {
  it('WN11 a: one that sees through a trick knows it from then on and answers it WARNED_SHIFT (2) tiers better; its own look queues a warning (WN8), a second look does not', () => {
    const { s, sharp, dull } = twoFoes();
    expect(CONFIG.WARNED_SHIFT).toBe(2);
    expect(s.player.playingDead?.believers).toEqual(['trader']);
    expect(knowsTrick(sharp, 'player', TRICK.play_dead)).toBe(true);
    expect(sharp.mind?.knowledge.player?.revealed).toContain('ruse:play_dead');
    expect(warnedShift(sharp, 'player', TRICK.play_dead)).toEqual([{ source: 'Knows the trick', value: 2 }]);
    expect(sharp.mind?.toWarn).toEqual([{ about: 'player', trick: TRICK.play_dead }]);
    expect(warnedShift(dull, 'player', TRICK.play_dead)).toEqual([]);
    sawThrough(s, dull, s.player, TRICK.feint, false);
    expect(knowsTrick(dull, 'player', TRICK.feint)).toBe(true);
    expect(dull.mind?.toWarn).toBeUndefined();
  });

  it('WN8 a: row W1 Warn the others (Battle Sense 10) adds a warning beside the order, once per foe and trick a fight, only while an ally in earshot lacks the news', () => {
    expect(FIGHT_RULES.find((r) => r.id === FX.warn)).toMatchObject({ skill: SK.battle_sense, min: 10 });
    const { s, sharp, dull } = twoFoes();
    expect(codeWarn(s, sharp, hold(sharp)).warn).toBeUndefined(); // Battle Sense 0: no row
    skill(sharp, SK.battle_sense, 10);
    expect(codeWarn(s, sharp, hold(sharp))).toMatchObject({ type: 'hold', warn: 'player' });
    learn(s, dull, 'player', TRICK.play_dead); // no one left to tell
    expect(codeWarn(s, sharp, hold(sharp)).warn).toBeUndefined();
  });

  it('WN1-WN3: the warning is a shout heard by all, its allies learn the trick, it ends Stealthy, and is not given twice a fight', () => {
    const { s, sharp, dull } = twoFoes();
    skill(sharp, SK.battle_sense, 10);
    sharp.posture = 'stealthy';
    const ev = play(s, { intent: intent() });
    const warn = ev.find((e) => e.kind === 'warn' && e.actorId === 'patron_1');
    expect(warn?.target).toBe('player');
    expect(warn?.line?.text).toBe("It's a trick!");
    expect(warn?.noise).toBe('loud');
    expect(warn?.perception.player).toBeDefined(); // the trickster hears it too
    expect(warn?.effects).toContainEqual(expect.objectContaining({ kind: 'warned', actorId: 'trader', data: expect.objectContaining({ by: 'patron_1', tricks: [TRICK.play_dead] }) }));
    expect(knowsTrick(dull, 'player', TRICK.play_dead)).toBe(true);
    expect(sharp.posture).toBe('open');
    expect(sharp.mind?.toWarn).toBeUndefined();
    sharp.mind!.toWarn = [{ about: 'player', trick: TRICK.play_dead }];
    dull.mind!.knowledge.player.revealed = [];
    expect(codeWarn(s, sharp, hold(sharp)).warn).toBeUndefined(); // warned this fight already
  });

  it('WN3 a / WN13 a: a believer that learns the trick looks again at turn end, once, and a win takes it off the believers', () => {
    const { s, dull } = twoFoes();
    skill(dull, SK.insight, 1000);
    learn(s, dull, 'player', TRICK.play_dead);
    queueLearned(s, 'trader', 'player', 'ruse:play_dead');
    queueLearned(s, 'trader', 'player', 'ruse:play_dead'); // a second warning: still one look
    const r = warnedChecks(s, createRng(1));
    expect(r.map((x) => [x.x.id, x.effect.kind])).toEqual([['trader', 'play_dead_seen_through']]);
    expect(s.player.playingDead?.believers).toEqual([]);
    expect(warnedChecks(s, createRng(1))).toEqual([]);
  });

  it('WN2 a: any line copies revealed facts, even to one that already sees the person, and a trick learned that way is looked at again', () => {
    const { s, sharp, dull } = twoFoes();
    const line: GameEvent = { id: 't.x', turn: s.turn, actorId: 'patron_1', kind: 'speak', zone: 'street_square', line: { text: 'He fakes it!', volume: 'shout' }, effects: [], noise: 'loud', visibility: 'normal', perception: { trader: { level: 'full', cue: 'sound', heard: true } } };
    expect(dull.mind?.knowledge.player?.status).toBe('engaged');
    updateBeliefs(s, { kind: 'event', event: line });
    expect(knowsTrick(dull, 'player', TRICK.play_dead)).toBe(true);
    expect((s.scratch?.rusesLearned as unknown[]).length).toBe(1);
    expect(sharp.id).toBe('patron_1');
  });

  it('WN5 a: people warn in words, semi-intelligent beasts cry, the unintelligent never warn', () => {
    const s = makeVillage();
    const p = s.actors.find((a) => a.id === 'patron_1')!;
    expect(warnVoice(s, p)).toBe('words');
    p.core.raceId = RC.wolf;
    expect(warnVoice(s, p)).toBe('cry');
    p.core.raceId = RC.slime;
    expect(warnVoice(s, p)).toBeNull();
  });

  it('WN4 b: about someone hidden, a warned ally is pointed at it: its next notice or search roll is POINTED_SHIFT easier, once', () => {
    const { s, sharp, dull } = twoFoes();
    delete s.player.playingDead;
    s.player.posture = 'stealthy';
    dull.mind!.knowledge.player = { status: 'unaware', source: 'seen', revealed: [] };
    sharp.mind!.toWarn = [{ about: 'player', trick: HIDDEN }];
    skill(sharp, SK.battle_sense, 10);
    expect(codeWarn(s, sharp, hold(sharp)).warn).toBe('player');
    expect(warnEvent(s, sharp, 'player').line?.text).toBe('There! Someone hiding!');
    const ev: GameEvent = { id: 't.w', turn: s.turn, actorId: 'patron_1', kind: 'warn', target: 'player', zone: 'street_square', effects: [], noise: 'loud', visibility: 'normal', perception: { trader: { level: 'full', cue: 'sound', heard: true } } };
    expect(giveWarning(s, sharp, 'player', ev)).toEqual([{ kind: 'warned', actorId: 'trader', data: { by: 'patron_1', about: 'player', tricks: [TRICK.play_dead], pointed: true } }]);
    expect(dull.mind?.pointed?.player).toBe(s.turn);
    expect(dull.mind?.knowledge.player?.status).toBe('suspicious');
    dull.mind!.pointed = { player: s.turn };
    expect(pointedShift(s, dull, s.player)).toEqual([{ source: 'Pointed out', value: CONFIG.POINTED_SHIFT }]);
    expect(pointedShift(s, dull, s.player)).toEqual([]);
  });

  it('WN9 a: the player warns its own side: the deck offers Warn, the Parser may say it, and an ally learns the trick', () => {
    const s = makeVillage();
    place(s, 'player', 'street_square'); s.player.pos = { x: 14, y: -14 };
    const bandit = foe(s, 'patron_1', 16);
    const friend = place(s, 'guard_1', 'street_square'); friend.pos = { x: 13, y: -14 }; friend.bandId = s.player.bandId; delete friend.asleep;
    friend.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [], lastKnownZone: 'street_square', lastSeenTurn: s.turn }; // a companion knows you
    expect(buildPlayerView(s).player.warnable).toBeUndefined();
    learn(s, s.player, bandit.id, TRICK.play_dead);
    const pv = buildPlayerView(s);
    expect(pv.player.warnable).toEqual([{ id: 'patron_1', why: 'trick' }]);
    expect(deck({ pv, s }).flatMap((g) => g.actions).some((a) => a.kind === 'warn')).toBe(true);
    const bad = { ...wtIntent({}), warn: 'trader' };
    expect(checkParserLegality(bad, pv).intent.warn).toBeNull();
    expect(checkParserLegality({ ...bad, warn: 'patron_1' }, pv).intent.warn).toBe('patron_1');
    const ev = play(s, { intent: intent({ warn: 'patron_1' }) });
    expect(ev.some((e) => e.kind === 'warn' && e.actorId === s.player.id && e.target === 'patron_1')).toBe(true);
    expect(knowsTrick(friend, 'patron_1', TRICK.play_dead)).toBe(true);
  });

  it('D-51 b: outside a fight a code-run companion following the player warns it of someone hidden, once per foe; a stranger does not', () => {
    const s = makeVillage();
    place(s, 'player', 'street_square'); s.player.pos = { x: 14, y: -14 };
    const sneak = place(s, 'patron_1', 'street_square'); sneak.pos = { x: 18, y: -14 }; delete sneak.asleep;
    sneak.posture = 'stealthy'; sneak.mind!.overrides = { player: 'hostile' }; sneak.mind!.control = 'code';
    const friend = place(s, 'guard_1', 'street_square'); friend.pos = { x: 13, y: -14 }; friend.bandId = s.player.bandId; delete friend.asleep;
    friend.mind!.control = 'code';
    friend.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [], lastKnownZone: 'street_square', lastSeenTurn: s.turn };
    skill(friend, SK.battle_sense, 10);
    expect(friend.engagement).toBeUndefined();
    friend.mind!.toWarn = [{ about: 'patron_1', trick: HIDDEN }];
    const ev = play(s, { intent: intent() });
    const warn = ev.find((e) => e.kind === 'warn' && e.actorId === 'guard_1');
    expect(warn?.target).toBe('patron_1');
    expect(warn?.line?.text).toBe('There! Someone hiding!');
    expect(warn?.effects).toContainEqual(expect.objectContaining({ kind: 'warned', actorId: 'player', data: expect.objectContaining({ by: 'guard_1', about: 'patron_1', pointed: true }) }));
    friend.mind!.toWarn = [{ about: 'patron_1', trick: HIDDEN }]; // spotted again: no second warning about the same foe
    expect(play(s, { intent: intent() }).some((e) => e.kind === 'warn' && e.actorId === 'guard_1')).toBe(false);
    const stranger = place(s, 'trader', 'street_square'); stranger.pos = { x: 12, y: -14 }; delete stranger.asleep; stranger.mind!.control = 'code';
    skill(stranger, SK.battle_sense, 10);
    stranger.mind!.toWarn = [{ about: 'patron_1', trick: HIDDEN }];
    expect(play(s, { intent: intent() }).some((e) => e.kind === 'warn' && e.actorId === 'trader')).toBe(false);
  });

  it('whole turn: the player\'s warning is narrated as a shout its ally takes in', async () => {
    const g = wholeTurn();
    const s = g.game.state()!;
    place(s, 'player', 'street_square'); s.player.pos = { x: 14, y: -14 };
    const bandit = foe(s, 'patron_1', 16);
    const friend = place(s, 'guard_1', 'street_square'); friend.pos = { x: 13, y: -14 }; friend.bandId = s.player.bandId; delete friend.asleep;
    friend.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [], lastKnownZone: 'street_square', lastSeenTurn: s.turn }; // a companion knows you
    learn(s, s.player, bandit.id, TRICK.play_dead);
    const { events } = await g.turn({ ...wtIntent({}), warn: 'patron_1' }, "he's faking!");
    expect(events.find((e) => e.kind === 'warn')?.effects.some((f) => f.kind === 'warned' && f.actorId === 'guard_1')).toBe(true);
  });

  it('guard: a trick known is the fact "ruse:<trick>", made only in engine/ruses.ts (the Planner prompt explains it)', () => {
    expect(bannedLines(/['"`]ruse:/, { 'src/engine/ruses.ts': 'RUSE, the one prefix', 'src/agents/prompts.ts': 'tells NPC agents what the fact means' })).toEqual([]);
  });
});
