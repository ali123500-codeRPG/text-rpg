// OD2 a, OD3 a, OD4 a, OD11 a, OD12 a, OD13 a (questions page "Obstacle difficulty"): use, interact, observe and other
// roll against the grade of what they act on (a piece of furniture, a container, a way's barrier), else the Parser's grade,
// which is then kept on the thing; never the scenario's number. Breaking a box open follows the same sure / out of reach
// rule, and a sure break still rolls for what breaks inside.
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../src/types';
import { makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { zoneById } from '../../src/engine/relations';
import { makeFurniture } from '../../src/engine/furniture';
import { buildNarrationView, buildPlayerView } from '../../src/views';
import { effectiveSkill, gradeMod } from '../../src/ruleset';
import { checkSecrets } from '../../src/engine/secrets';
import { lineExtras } from '../../src/agents/game';
import { checkParserLegality } from '../../src/agents/legality';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { IT } from '../../src/library/itemIds';
import { layAll, furnish } from '../harness';
import { groundIn } from '../../src/engine/ground';

const village = (): GameState => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'patron_1', 'trader'] });
  s.player.core.skills[SK.endurance] = { raw: 50, state: 'normal' };
  furnish(s, 'tav_common', [{ kind: 'other', name: 'winch', at: 'n' }]);
  return s;
};
const winch = (s: GameState) => s.furniture.find((f) => f.zone === 'tav_common')!;
const turnWinch = (s: GameState, grade?: 'none' | 'minor' | 'moderate' | 'major' | 'extreme', seed?: number) =>
  play(s, { intent: intent({ action: { type: 'interact', skill: SK.endurance, target: winch(s).id, ...(grade ? { grade } : {}) } }) }, seed).find((e) => e.actorId === 'player' && e.kind === 'interact')!;
const eff = (s: GameState) => effectiveSkill(s, s.player, SK.endurance).value;

describe('333 graded acts (OD2, OD3, OD4, OD11, OD12)', () => {
  it('the thing\'s own grade decides, never the scenario\'s: far below the actor is sure, with no roll', () => {
    const s = village();
    s.hidden.stage.challenge = 'extreme'; // OD4 a: only steers the Weaver now
    winch(s).grade = 'none';
    expect(eff(s) - CONFIG.DIFFICULTY.none).toBeGreaterThanOrEqual(CONFIG.OBSTACLE_SURE_GAP);
    const ev = turnWinch(s, 'extreme');
    expect(ev.obstacle).toEqual({ skill: SK.endurance, grade: 'none', gate: 'sure' });
    expect(ev.roll).toBeUndefined();
    expect(ev.tier).toBe('success');
  });
  it('far above the actor is out of reach: no roll, no tier, and the story is told it was beyond them', () => {
    const s = village();
    winch(s).grade = 'extreme';
    const evs = play(s, { intent: intent({ action: { type: 'interact', skill: SK.endurance, target: winch(s).id } }) });
    const ev = evs.find((e) => e.kind === 'interact')!;
    expect(ev.obstacle?.gate).toBe('out');
    expect(ev.roll).toBeUndefined();
    expect(ev.tier).toBeUndefined();
    expect(buildNarrationView(s, evs).events.find((e) => e.kind === 'interact')).toMatchObject({ beyond: true });
  });
  it('in between, one roll with the grade modifier; the roll line says done, not yet or not done', () => {
    const s = village();
    winch(s).grade = 'major';
    const evs = play(s, { intent: intent({ action: { type: 'interact', skill: SK.endurance, target: winch(s).id } }) });
    const ev = evs.find((e) => e.kind === 'interact')!;
    expect(ev.obstacle?.gate).toBe('roll');
    expect(ev.roll!.modifiers.find((m) => m.source === 'grade')!.value).toBe(gradeMod(CONFIG.DIFFICULTY.major));
    const said = lineExtras(s, evs, buildNarrationView(s, evs), '').check!;
    expect(['done', 'not yet', 'not done']).toContain(said.result);
  });
  it('OD3: with no grade on the thing, the Parser\'s grade is used and kept, so asking again can\'t regrade it', () => {
    const s = village();
    expect(turnWinch(s, 'none').obstacle?.grade).toBe('none');
    expect(winch(s).grade).toBe('none');
    expect(turnWinch(s, 'extreme').obstacle?.grade).toBe('none');
  });
  it('with no grade anywhere (an NPC\'s act, OD14 open), it is Moderate', () => {
    const s = village();
    expect(turnWinch(s).obstacle?.grade).toBe('moderate');
    expect(winch(s).grade).toBeUndefined();
  });
  it('a piece of furniture the player sees is a legal target for these acts, and only these', () => {
    const s = village(), v = buildPlayerView(s), id = winch(s).id;
    expect(checkParserLegality(intent({ action: { type: 'interact', skill: SK.endurance, target: id, grade: 'minor' } }), v).illegal).toEqual([]);
    expect(checkParserLegality(intent({ action: { type: 'attack', skill: SK.melee_medium, target: id } }), v).illegal).toEqual([`action.target ${id}`]);
  });
  it('the Weaver can grade a piece; an unknown grade is dropped', () => {
    const s = village(), z = zoneById(s, 'tav_common')!;
    expect(makeFurniture(s, z, [{ kind: 'other', name: 'hatch', grade: 'major' }])[0].grade).toBe('major');
    expect(makeFurniture(s, z, [{ kind: 'other', name: 'hatch', grade: 'divine' as never }])[0]).not.toHaveProperty('grade');
  });
  it('OD11 a: a check_passed secret is met by a roll (or a sure act) with its skill at its tier, aimed at its person', () => {
    const s = village();
    s.hidden.secrets.push({ id: 'sec', text: 'x', revealWhen: { type: 'check_passed', skill: SK.insight, minTier: 'great_success', againstActorId: 'barkeep' } } as never);
    const ev = (tier: string) => ({ actorId: 'player', target: 'barkeep', obstacle: { skill: SK.insight, grade: 'minor', gate: 'roll' }, tier, perception: {} }) as never;
    checkSecrets(s, [ev('success')]);
    expect(s.player.journal?.secretsKnown ?? []).not.toContain('sec');
    checkSecrets(s, [ev('great_success')]);
    expect(s.player.journal?.secretsKnown).toContain('sec');
  });
});

describe('333 breaking a box open on the gate (OD13 a)', () => {
  const box = (s: GameState, grade: 'none' | 'extreme') => {
    layAll(s, 'tav_common', { id: 'box', itemId: IT.chest, contents: [{ id: 'vial', itemId: IT.healing_draught, qty: 3 }], lock: { locked: true }, grade });
    return groundIn(s, 'tav_common').find((i) => i.id === 'box')!;
  };
  const bare = (s: GameState, raw: number) => {
    s.player.core.skills[SK.unarmed_improvised] = { raw, state: 'normal' };
    for (const i of s.player.core.inventory) if (i.equippedIn?.some((g) => g.startsWith('grip:'))) i.equippedIn = [];
  };
  const brk = (s: GameState, seed?: number) => play(s, { intent: intent({ action: { type: 'break', target: 'box' } }) }, seed).find((e) => e.kind === 'break_open')!;
  it('out of reach: no roll, it stays shut and nothing inside breaks', () => {
    const s = village(), c = box(s, 'extreme');
    bare(s, 0);
    const ev = brk(s);
    expect(ev.roll).toBeUndefined();
    expect(ev.breakOpen).toEqual({ opened: false, beyond: true });
    expect(c.lock!.locked).toBe(true);
    expect(c.graded).toContain('player');
  });
});
