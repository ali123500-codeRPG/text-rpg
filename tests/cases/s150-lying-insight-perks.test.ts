// 150 Falsehood and Insight perks (LI1, LI2): Bluff (Falsehood 20), a free perk move once per foe per engagement: a Falsehood roll
// against the foe's answer to a lie; unless the foe wins, it acts last next turn. Takes One to Know One (Falsehood 60, GU2 b): a
// lie in words is answered with the better of Insight and Falsehood, a lie told with the body with the better of Insight and
// Guile, and the other skill of the pair augments the roll by CONFIG.TAKES_ONE_SHARE. Plain as Day (Insight 60): a lie seen through is called a lie.
// Read Their Face (Insight 100): the stance toward the owner of anyone who spoke to the owner this scenario shows.
import { tick } from '../harness/time';
import { CONFIG } from '../../src/config';
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage } from '../harness';
import { getLibrary } from '../../src/library';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { perkMoveBlock, resolvePerkMove } from '../../src/engine/perkMoves';
import { bluffed } from '../../src/engine/perkMarks';
import { answerRoll, pressedWords, tellFor, PLAIN, TELL } from '../../src/engine/speech';
import { augmentsOf, tierMult } from '../../src/ruleset/gear';
import { buildPlayerView } from '../../src/views';
import { deck } from '../../src/ui/deck';
import type { Actor, GameEvent, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const skill = (a: Actor, id: string, raw: number) => { a.core.skills[id] = { raw, state: 'normal' }; };
/** patron_1 in the player's zone, opposed to the player */
const foe = (s: GameState, id = 'patron_1') => {
  const f = npc(s, id);
  f.zone = s.player.zone;
  f.mind!.overrides = { ...(f.mind!.overrides ?? {}), player: 'opposed' };
  return f;
};

describe('150 Falsehood and Insight perks', () => {
  it('are on the Falsehood and Insight ladders; Not Born Yesterday is banked', () => {
    const perks = getLibrary().perks;
    expect(perks[PK.bluff]?.ladder).toEqual({ skill: SK.falsehood, milestone: 20 });
    expect(perks[PK.takes_one_to_know_one]?.ladder).toEqual({ skill: SK.falsehood, milestone: 60 });
    expect(perks[PK.plain_as_day]?.ladder).toEqual({ skill: SK.insight, milestone: 60 });
    expect(perks[PK.read_their_face]?.ladder).toEqual({ skill: SK.insight, milestone: 100 });
    for (const id of [PK.bluff, PK.takes_one_to_know_one, PK.plain_as_day, PK.read_their_face]) expect(BUILT_PERKS.has(id)).toBe(true);
    expect(perks[PK.not_born_yesterday]).toBeUndefined(); // banked write-ups stay out of the game library
  });

  it('Bluff needs the perk and a foe in the zone, and works once per foe per engagement', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    wim.zone = s.player.zone;
    expect(perkMoveBlock(s, s.player, PK.bluff, wim.id)).toBe('not_owned');
    give(s.player, PK.bluff);
    expect(perkMoveBlock(s, s.player, PK.bluff, wim.id)).toBe('not_a_foe');
    foe(s);
    const other = foe(s, 'guard_1');
    expect(perkMoveBlock(s, s.player, PK.bluff, wim.id)).toBeNull();
    resolvePerkMove(s, s.player, PK.bluff, wim.id, forcedRng([95, 5]));
    expect(perkMoveBlock(s, s.player, PK.bluff, wim.id)).toBe('used_this_engagement');
    expect(perkMoveBlock(s, s.player, PK.bluff, other.id)).toBeNull(); // another foe can still be bluffed
  });

  it('a believed Bluff makes the foe hesitate next turn (AT60); one seen through does nothing', () => {
    const s = makeVillage();
    const wim = foe(s);
    give(s.player, PK.bluff);
    skill(s.player, SK.falsehood, 40);
    skill(wim, SK.insight, 20);
    const r = resolvePerkMove(s, s.player, PK.bluff, wim.id, forcedRng([95, 5]));
    expect(r.result?.a.skill).toBe(SK.falsehood);
    expect(r.result?.b.skill).toBe(SK.insight);
    expect(r.effects[0].kind).toBe('bluff_believed');
    expect(bluffed(s, wim)).toBe(true);
    tick(s, CONFIG.ROUND_S);
    expect(bluffed(s, wim)).toBe(true); // a round on
    tick(s, CONFIG.ROUND_S);
    expect(bluffed(s, wim)).toBe(false); // PERK_MARK_ROUNDS rounds on

    const s2 = makeVillage();
    const w2 = foe(s2);
    give(s2.player, PK.bluff);
    const miss = resolvePerkMove(s2, s2.player, PK.bluff, w2.id, forcedRng([5, 95]));
    expect(miss.effects[0].kind).toBe('bluff_seen_through');
    expect(bluffed(s2, w2)).toBe(false);
  });

  it('shows in the action deck against a foe in the zone, and in the Parser view as a perk move', () => {
    const s = makeVillage();
    foe(s);
    give(s.player, PK.bluff);
    const pv = buildPlayerView(s);
    expect(pv.player.perkMoves?.find((m) => m.id === PK.bluff)).toMatchObject({ name: 'Bluff', does: expect.stringContaining('Behind you!') });
    expect(deck({ pv, s }).find((g) => g.group === 'perks')?.actions.some((a) => a.label === 'Bluff "Behind you!"' && a.steps[0]?.key === 'target')).toBe(true);
  });

  it('Takes One to Know One answers a lie with the better of Insight and Falsehood', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    skill(wim, SK.insight, 5);
    skill(wim, SK.falsehood, 60);
    expect(answerRoll(s, wim, SK.insight, 'player', forcedRng([50])).skill).not.toBe(SK.falsehood);
    give(wim, PK.takes_one_to_know_one);
    expect(answerRoll(s, wim, SK.insight, 'player', forcedRng([50])).skill).toBe(SK.falsehood);
    expect(answerRoll(s, wim, SK.persuasion, 'player', forcedRng([50])).skill).not.toBe(SK.falsehood); // only lies
  });

  it('Takes One to Know One answers a lie told with the body with the better of Insight and Guile (GU2 b)', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    skill(wim, SK.insight, 30);
    skill(wim, SK.falsehood, 60);
    skill(wim, SK.guile, 40);
    give(wim, PK.takes_one_to_know_one);
    expect(answerRoll(s, wim, SK.insight, 'player', forcedRng([50]), [], 'body').skill).toBe(SK.guile);
    skill(wim, SK.guile, 0);
    expect(answerRoll(s, wim, SK.insight, 'player', forcedRng([50]), [], 'body').skill).toBe(SK.insight); // Falsehood 60 is not the pair
    expect(answerRoll(s, wim, SK.insight, 'player', forcedRng([50])).skill).toBe(SK.falsehood); // a lie in words: it is
  });

  it('the unpicked skill of the pair augments the picked one by TAKES_ONE_SHARE, only on that kind of answer', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    skill(wim, SK.insight, 20);
    skill(wim, SK.falsehood, 60);
    skill(wim, SK.guile, 40);
    give(wim, PK.takes_one_to_know_one);
    const add = (to: string, when: 'answer_spoken_lie' | 'answer_body_lie') => augmentsOf(wim, to, undefined, [when]).reduce((n, a) => n + a.value, 0);
    expect(add(SK.falsehood, 'answer_spoken_lie')).toBeCloseTo(20 * CONFIG.TAKES_ONE_SHARE * tierMult(SK.insight));
    expect(add(SK.guile, 'answer_body_lie')).toBeCloseTo(20 * CONFIG.TAKES_ONE_SHARE * tierMult(SK.insight));
    expect(add(SK.insight, 'answer_body_lie')).toBeCloseTo(40 * CONFIG.TAKES_ONE_SHARE * tierMult(SK.guile));
    expect(add(SK.falsehood, 'answer_body_lie')).toBe(0);
    expect(augmentsOf(wim, SK.falsehood).reduce((n, a) => n + a.value, 0)).toBe(0); // never on Falsehood's own rolls
  });

  it('Plain as Day says a lie seen through is a lie', () => {
    const s = makeVillage();
    expect(tellFor(s.player)).toBe(TELL);
    const lie = { push: { type: 'deceive', tell: true }, contest: { a: { tier: 'success' } } } as unknown as GameEvent;
    expect(pressedWords(lie, s.player)?.took).toBe(TELL);
    give(s.player, PK.plain_as_day);
    expect(tellFor(s.player)).toBe(PLAIN);
    expect(pressedWords(lie, s.player)?.took).toBe(PLAIN);
  });

  it('Read Their Face shows the stance of someone who spoke to the owner this scenario', () => {
    const s = makeVillage();
    const wim = foe(s);
    const said: GameEvent = { id: 'ev_rtf', turn: s.turn, actorId: wim.id, kind: 'speak', zone: wim.zone, target: 'player', effects: [],
      noise: 'normal', visibility: 'normal', perception: { player: { level: 'full', cue: 'sight' } }, line: { text: 'Lovely evening.', volume: 'normal' } } as GameEvent;
    s.events.push(said);
    const seen = () => buildPlayerView(s).actors.find((a) => a.id === wim.id);
    expect(seen()?.stance).toBeUndefined();
    give(s.player, PK.read_their_face);
    expect(seen()?.stance).toBe('opposed');
    const quiet = npc(s, 'guard_1');
    quiet.zone = s.player.zone;
    expect(buildPlayerView(s).actors.find((a) => a.id === quiet.id)?.stance).toBeUndefined(); // never spoke to the player
  });
});
