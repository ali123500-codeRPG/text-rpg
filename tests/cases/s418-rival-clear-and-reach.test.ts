// 418 BG-1508: an ending code could not check was left to the Weaver: "a rival cleared the cellar first, or the slimes got
// into the sacks". A clear ending can say whose clear it is (by: you or other): the side that downed or broke most of the
// foes who stood there, a tie being yours, each foe credited to the side that last attacked it. A reach ending can name a
// person or a band: met when that person, or any of that band, stands in the place up and unbroken.
import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState, PlanEnding } from '../../src/types';
import { actor, makeVillage } from '../harness';
import { checkScenarioEnd, foesIn, frameOf } from '../../src/engine/scenarioEnd';
import { validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';

const frame = (s: GameState, endings: PlanEnding[]) => (s.stage.scenario = frameOf(s, { question: 'q', scale: 'situation', endings }, 'success', (_k, r) => r));
const ends = (place: string): PlanEnding[] => [
  { when: { kind: 'clear', place, by: 'other' }, as: 'lost', text: 'the rival cleared it first' },
  { when: { kind: 'clear', place, by: 'you' }, as: 'resolved', text: 'you cleared it' },
];
const hit = (by: string, target: string): GameEvent => ({ id: `e_${by}_${target}`, turn: 1, kind: 'attack', actorId: by, target, zone: 'field_mid', effects: [] } as never);
const down = (s: GameState, id: string) => { actor(s, id).core.condition.hpLostPct = 105; };
const ending = (s: GameState) => s.stage.ending ?? s.stage.ended;

// three foes in the field; the gate guard, of another band than the player's, is the rival
const field = () => {
  const s = makeVillage({ playerZone: 'field_mid' });
  const foes = foesIn(s, 'field').map((a) => a.id);
  while (foes.length < 3) { const a = structuredClone(actor(s, foes[0])); a.id = `${foes[0]}_${foes.length}`; s.actors.push(a); foes.push(a.id); }
  for (const id of foesIn(s, 'field').map((a) => a.id)) if (!foes.slice(0, 3).includes(id)) actor(s, id).mind!.moraleState = 'broken';
  expect(actor(s, 'guard_1').bandId).not.toBe(s.player.bandId);
  return { s, foes: foes.slice(0, 3) };
};

describe('418 BG-1508: whose clear it is', () => {
  it('the rival downs two of three: the rival cleared it, and the scenario is lost', () => {
    const { s, foes } = field();
    frame(s, ends('field'));
    checkScenarioEnd(s, []);
    const ev = [hit('player', foes[0]), hit('guard_1', foes[1]), hit('guard_1', foes[2])];
    foes.forEach((id) => down(s, id));
    checkScenarioEnd(s, ev);
    expect(ending(s)).toMatchObject({ as: 'lost' });
  });

  it('you down most of them, over several turns, even if the rival lands the last one: your clear', () => {
    const { s, foes } = field();
    frame(s, ends('field'));
    checkScenarioEnd(s, []);
    down(s, foes[0]); checkScenarioEnd(s, [hit('player', foes[0])]);
    down(s, foes[1]); checkScenarioEnd(s, [hit('player', foes[1])]);
    expect(ending(s)).toBeUndefined();
    down(s, foes[2]); checkScenarioEnd(s, [hit('guard_1', foes[2])]);
    expect(ending(s)).toMatchObject({ as: 'resolved' });
  });

  it('a tie is yours, and a foe nobody attacked counts for no side', () => {
    const { s, foes } = field();
    frame(s, ends('field'));
    checkScenarioEnd(s, []);
    actor(s, foes[2]).mind!.moraleState = 'broken'; // fled unhurt
    foes.slice(0, 2).forEach((id) => down(s, id));
    checkScenarioEnd(s, [hit('player', foes[0]), hit('guard_1', foes[1])]);
    expect(ending(s)).toMatchObject({ as: 'resolved' });
  });

  it('a clear ending with no by is met whoever cleared it, as before', () => {
    const { s, foes } = field();
    frame(s, [{ when: { kind: 'clear', place: 'field' }, as: 'resolved', text: 'cleared' }]);
    checkScenarioEnd(s, []);
    foes.forEach((id) => down(s, id));
    checkScenarioEnd(s, foes.map((id) => hit('guard_1', id)));
    expect(ending(s)).toMatchObject({ as: 'resolved' });
  });
});

describe('418 BG-1508: a person or a band reaches a place', () => {
  it('any of a band, up and unbroken, in the place meets it; the player standing there does not', () => {
    const { s, foes } = field();
    const band = actor(s, foes[0]).bandId;
    frame(s, [{ when: { kind: 'reach', place: 'tav_cellar', band }, as: 'lost', text: 'they got into the stores' }]);
    Object.assign(s.player, { zone: 'tav_cellar', placeId: 'tavern', pos: undefined });
    checkScenarioEnd(s, []);
    expect(ending(s)).toBeUndefined();
    const a = actor(s, foes[1]);
    Object.assign(a, { zone: 'tav_cellar', placeId: 'tavern' });
    a.mind!.moraleState = 'broken';
    checkScenarioEnd(s, []);
    expect(ending(s)).toBeUndefined(); // broken, it counts for nothing
    delete a.mind!.moraleState;
    checkScenarioEnd(s, []);
    expect(ending(s)).toMatchObject({ as: 'lost' });
  });

  it('a named person reaches it; without actor or band it is still the player', () => {
    const s = makeVillage({ playerZone: 'field_mid' });
    frame(s, [{ when: { kind: 'reach', place: 'tav_cellar', actor: 'guard_1' }, as: 'lost', text: 'the rival got there' }]);
    Object.assign(actor(s, 'guard_1'), { zone: 'tav_cellar', placeId: 'tavern' });
    checkScenarioEnd(s, []);
    expect(ending(s)).toMatchObject({ as: 'lost' });
    const t = makeVillage({ playerZone: 'tav_cellar' });
    frame(t, [{ when: { kind: 'reach', place: 'tav_cellar' }, as: 'resolved', text: 'you got there' }]);
    checkScenarioEnd(t, []);
    expect(ending(t)).toMatchObject({ as: 'resolved' });
  });

  it('the validator refuses an unknown person or band, and a by that is neither you nor other', () => {
    const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
    const plan = (when: unknown) => {
      const p = villageStagePlan();
      p.scenario!.endings = [...p.scenario!.endings, { when: when as never, as: 'lost', text: 'x' }];
      return validateStagePlan(toStoryStart(makeVillage()), p, ctx).filter((e) => e.code === 'scenario_ending').map((e) => e.message);
    };
    expect(plan({ kind: 'reach', place: 'tav_cellar', actor: 'nobody' })).toEqual([expect.stringContaining('actor nobody unknown')]);
    expect(plan({ kind: 'reach', place: 'tav_cellar', band: 'nobody' })).toEqual([expect.stringContaining('band nobody unknown')]);
    expect(plan({ kind: 'clear', place: 'tav_cellar', by: 'them' })).toEqual([expect.stringContaining('by must be you or other')]);
    expect(plan({ kind: 'reach', place: 'tav_cellar', band: 'slimes' })).toEqual([]);
  });
});
