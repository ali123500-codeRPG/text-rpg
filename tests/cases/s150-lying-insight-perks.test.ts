// 150 Lying and Insight perks (LI1, LI2): Bluff (Lying 20), a free perk move once per foe per engagement: a Lying roll
// against the foe's answer to a lie; unless the foe wins, it acts last next turn. Takes One to Know One (Lying 60): a lie
// is answered with the better of Insight and Lying. Plain as Day (Insight 60): a lie seen through is called a lie.
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

describe('150 Lying and Insight perks', () => {
  it('are on the Lying and Insight ladders; Not Born Yesterday is banked', () => {
    const perks = getLibrary().perks;
    expect(perks[PK.bluff]?.ladder).toEqual({ skill: SK.lying, milestone: 20 });
    expect(perks[PK.takes_one_to_know_one]?.ladder).toEqual({ skill: SK.lying, milestone: 60 });
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
    skill(s.player, SK.lying, 40);
    skill(wim, SK.insight, 20);
    const r = resolvePerkMove(s, s.player, PK.bluff, wim.id, forcedRng([95, 5]));
    expect(r.result?.a.skill).toBe(SK.lying);
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

  it('Takes One to Know One answers a lie with the better of Insight and Lying', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    skill(wim, SK.insight, 5);
    skill(wim, SK.lying, 60);
    expect(answerRoll(s, wim, SK.insight, 'player', forcedRng([50])).skill).not.toBe(SK.lying);
    give(wim, PK.takes_one_to_know_one);
    expect(answerRoll(s, wim, SK.insight, 'player', forcedRng([50])).skill).toBe(SK.lying);
    expect(answerRoll(s, wim, SK.persuasion, 'player', forcedRng([50])).skill).not.toBe(SK.lying); // only lies
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
