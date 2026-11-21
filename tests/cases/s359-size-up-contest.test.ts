// BF97 a (BG-290): sizing someone up with Insight is a contest, the looker's Insight against the other's Guile (BG-320: the face they keep is a lie told with the body), never a
// roll against a grade; a win reads their mood, how they feel about the looker and whether they hide something.
// BF96 a: beats can carry the difficulty of a graded act, and every agent is told which acts take one.
import { describe, expect, it } from 'vitest';
import type { GameEvent, GameState, Intent } from '../../src/types';
import { createRng, forcedRng, makeVillage } from '../harness';
import { resolveTurn } from '../../src/engine';
import { sizeUp } from '../../src/engine/speech';
import { actorById } from '../../src/engine/relations';
import { bindTemplate } from '../../src/minds/routines';
import { buildActorView, buildNarrationView } from '../../src/views';
import { SK } from '../../src/library/skillIds';
import { intent } from './w4-kit';

const village = (): GameState => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  s.player.core.skills[SK.insight] = { raw: 50, state: 'normal' };
  wim(s).core.skills[SK.guile] = { raw: 50, state: 'normal' };
  return s;
};
const wim = (s: GameState) => actorById(s, 'patron_1')!;
const turn = (s: GameState, i: Intent, d: number[]): GameEvent[] => { s.turn += 1; s.log = []; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, forcedRng([50, ...d])); };
const lookAt = (s: GameState) => turn(s, intent({ action: { type: 'observe', skill: SK.insight, target: 'patron_1' } }), [60, 40]);

describe('359 sizing someone up is Insight against Guile (BF97 a, BG-320)', () => {
  it('a look with Insight at a person rolls a contest against their Guile, with no grade and no grade_gap; a win reads their mood, how they feel about the looker and whether they hide something; the Narrator gets it', () => {
    const s = village();
    const r = sizeUp(s, s.player, wim(s), forcedRng([95, 5]))!;
    expect(r.contest.winner).toBe('a');
    expect(r.read).toMatchObject({ mood: 'Calm', hiding: false });
    expect(typeof r.read!.feels).toBe('string');
    const look = lookAt(s).find((e) => e.kind === 'observe')!;
    expect(look.contest).toMatchObject({ a: { actorId: 'player', skill: SK.insight }, b: { actorId: 'patron_1', skill: SK.guile } });
    expect(look.obstacle).toBeUndefined();
    expect(s.log.filter((l) => l.code === 'grade_gap')).toHaveLength(0);
    const ev = { ...look, read: r.read };
    expect(buildNarrationView(s, [ev]).events[0].read).toEqual({ mood: 'Calm', feels: r.read!.feels, hiding: false });
  });
  it('a secret held, or a lie told lately, shows as hiding something (never what)', () => {
    const s = village();
    s.hidden.secrets.push({ id: 'x', holderId: 'patron_1', fact: 'he owes the trader', leakTerms: ['owes'], revealWhen: { type: 'check_passed', skill: SK.persuasion, minTier: 'success', againstActorId: 'patron_1' } });
    expect(sizeUp(s, s.player, wim(s), forcedRng([95, 5]))!.read!.hiding).toBe(true);
    const t = village();
    t.events.push({ id: 'lie', turn: t.turn, actorId: 'patron_1', kind: 'deceive', zone: 'tav_common', effects: [], noise: 'normal', visibility: 'normal', perception: {} } as GameEvent);
    expect(sizeUp(t, t.player, wim(t), forcedRng([95, 5]))!.read!.hiding).toBe(true);
  });
  it('a better Guile is read less often; Falsehood (spoken lies) plays no part (BG-320)', () => {
    const s = village(), w = wim(s);
    const wins = (skill: string, raw: number) => {
      const rng = createRng(7);
      w.core.skills[SK.guile] = { raw: 50, state: 'normal' };
      delete w.core.skills[SK.falsehood];
      w.core.skills[skill] = { raw, state: 'normal' };
      let n = 0;
      for (let i = 0; i < 150; i++) if (sizeUp(s, s.player, wim(s), rng)!.contest.winner === 'a') n++;
      return n;
    };
    expect(wins(SK.guile, 80)).toBeLessThan(wins(SK.guile, 0));
    expect(wins(SK.falsehood, 80)).toBe(wins(SK.falsehood, 0));
  });
  it('an NPC that wins keeps the read on its belief, and its agent sees it', () => {
    const s = village();
    (wim(s).mind!.knowledge.player ??= { status: 'aware', source: 'seen', revealed: [] });
    s.player.core.skills[SK.guile] = { raw: 0, state: 'normal' };
    wim(s).core.skills[SK.insight] = { raw: 50, state: 'normal' };
    sizeUp(s, wim(s), s.player, forcedRng([95, 5]));
    expect(buildActorView(s, 'patron_1').beliefs.find((b) => b.about === 'player')!.read).toMatchObject({ turn: s.turn, mood: 'Calm' });
  });
  it('someone out of clear sight cannot be read: the look comes to nothing, with no roll', () => {
    const s = village();
    wim(s).zone = 'gate_inner';
    wim(s).pos = undefined;
    const evs = lookAt(s);
    expect(evs.find((e) => e.kind === 'observe')).toBeUndefined();
    expect(evs.find((e) => e.kind === 'wasted')).toMatchObject({ target: 'patron_1', reason: 'out_of_sight' });
  });
});

describe('359 every act that takes a difficulty can be given one (BF96 a)', () => {
  it('a beat keeps a grade on the scale and its fall, and drops a word off the scale', () => {
    const s = village(), view = buildActorView(s, 'patron_1');
    const tpl = { type: 'interact', target: null, skill: SK.endurance, intent: 'turn the winch', grade: 'major', fall: 3 } as never;
    expect(bindTemplate(tpl, view, { source: 'trigger' })).toMatchObject({ grade: 'major', fall: 3 });
    const bad = bindTemplate({ ...(tpl as object), grade: 'huge', fall: -1 } as never, view, { source: 'trigger' });
    expect([bad.grade, bad.fall]).toEqual([undefined, undefined]);
  });
});
