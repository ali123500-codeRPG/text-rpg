// 161 All-100 and All-150 work like the All-50 (a tree passive plus each skill's part at the step, granted once enough of
// the tree's skills reach it), and the first All-150: Perception's Every Sense One. What the owner sees it hears, and
// what it hears it sees; its sight and hearing rolls use the best of both senses.
import { describe, expect, it } from 'vitest';
import type { Actor, GameEvent, GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { perceptionOf } from '../../src/perception';
import { grantAllSteps } from '../../src/ruleset/allSteps';
import { fnRoller } from '../../src/ruleset';
import { ALL_BUNDLES, STEP_PARTS, SKILL_PARTS } from '../../src/library/allPerks';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { getLibrary } from '../../src/library';
import { hasPerk } from '../../src/ruleset/perks';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { FN } from '../../src/library/functionIds';
import { TR } from '../../src/library/treeIds';

const ev = (s: GameState, actorId: string, zone: string, visibility: GameEvent['visibility'], noise: GameEvent['noise']): GameEvent =>
  ({ id: 'x', turn: s.turn, actorId, kind: 'hold', zone, effects: [], noise, visibility, perception: {} }) as GameEvent;
const give = (a: Actor) => a.core.perks.push({ perkId: PK.one_sense, source: 'mastery', gainedTurn: 0, treeId: TR.perception, tier: 150 });
const raw = (a: Actor, skill: string, v: number) => { a.core.skills[skill] = { raw: v, state: 'normal' }; };

describe('161 All-150 Every Sense One', () => {
  it('is the Perception All-150 passive, built; All-50 parts are the 50 step of STEP_PARTS', () => {
    expect(ALL_BUNDLES.find((b) => b.treeId === TR.perception && b.step === 150)?.passive).toBe(PK.one_sense);
    expect(getLibrary().perks[PK.one_sense]?.allStep).toMatchObject({ treeId: TR.perception, step: 150 });
    expect(BUILT_PERKS.has(PK.one_sense)).toBe(true);
    expect(STEP_PARTS[50]).toBe(SKILL_PARTS);
  });

  it('is granted once three Perception skills reach 150, like an All-50 at its step', () => {
    const s = makeVillage();
    for (const sk of [SK.eyesight, SK.earshot, SK.insight]) raw(s.player, sk, 150);
    raw(s.player, SK.insight, 149);
    grantAllSteps(s, s.player);
    expect(hasPerk(s.player, PK.one_sense)).toBe(false);
    expect(hasPerk(s.player, PK.curiouser)).toBe(true); // the All-50 passive still comes at 50
    raw(s.player, SK.insight, 150);
    grantAllSteps(s, s.player);
    expect(s.player.core.perks.find((p) => p.perkId === PK.one_sense)).toMatchObject({ source: 'mastery', tier: 150, treeId: TR.perception });
  });

  it('what the owner only half sees, it also hears (so spoken words come through)', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    const e = ev(s, 'slime_1', 'field_edge', 'low', 'silent'); // a still shape two zones (16 m) away, no sound
    expect(perceptionOf(e, s, s.player)).toEqual({ level: 'partial', cue: 'sight' });
    give(s.player);
    expect(perceptionOf(e, s, s.player)).toEqual({ level: 'partial', cue: 'sound', heard: true });
  });

  it('what the owner hears clearly, it sees clearly', () => {
    const s = makeVillage();
    const e = ev(s, 'trader', s.player.zone, 'unseen', 'normal'); // heard in the owner's zone, never seen
    expect(perceptionOf(e, s, s.player)).toEqual({ level: 'full', cue: 'sound', heard: true });
    give(s.player);
    expect(perceptionOf(e, s, s.player)).toEqual({ level: 'full', cue: 'sight', heard: true });
  });

  it('a sight roll uses Earshot when it is the better sense, and a hearing roll uses Eyesight', () => {
    const s = makeVillage();
    raw(s.player, SK.eyesight, 20);
    raw(s.player, SK.earshot, 80);
    expect(fnRoller(s, s.player, FN.sight)).toBe(SK.eyesight);
    give(s.player);
    expect(fnRoller(s, s.player, FN.sight)).toBe(SK.earshot);
    raw(s.player, SK.eyesight, 90);
    expect(fnRoller(s, s.player, FN.hearing)).toBe(SK.eyesight);
  });
});
