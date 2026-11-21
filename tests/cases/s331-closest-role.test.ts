// 331 Closest role and Roles wanted (NR28). When no role fits, the World builder or Weaver names who it wants and the
// 2 to 4 skills that matter most; code picks the role whose bands cover them best (High 3, Moderate 2, Low 1). Wanted
// skills that role lacks from its High and Moderate bands are logged for the GM view, grouped with a count.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import type { StagePlan } from '../../src/types';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { closestRole, roleMissing } from '../../src/library/spawn';
import { RC } from '../../src/library/raceIds';
import { RO, TH } from '../../src/library/npcLayerIds';
import { SK } from '../../src/library/skillIds';
import { roleWantGroups } from '../../src/ui/gm';
import { getLibrary } from '../../src/library';

const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const byWants = (label: string, skills: string[], theme: string = TH.town_watch): StagePlan => {
  const p = villageStagePlan();
  p.cast.push({ compose: { race: RC.human, theme, rank: 'Veteran', wants: { label, skills } } as never, key: 'wanted', label, name: 'Orla',
    appearance: 'a grey cloak', band: 'village_watch', routineSetId: 'gate_guard', slots: { post: 'street_door' }, awarenessOfPlayer: 'unaware', motive: 'keeps the gate' });
  return p;
};

describe('331 closest role and Roles wanted', () => {
  it('NR28: the role covering the wanted skills best is picked; ties keep table order; missing = not in High or Moderate', () => {
    expect(closestRole([SK.healing, SK.insight])).toEqual({ role: RO.healer, missing: [] });
    expect(closestRole([SK.melee_medium, SK.heavy_armor, SK.handiwork])).toEqual({ role: RO.knight, missing: [SK.handiwork] });
    expect(closestRole([SK.melee_medium, SK.block]).role).toBe(RO.soldier); // Soldier (High, High) beats Knight (High, Moderate)
    expect(roleMissing(RO.soldier, [SK.parry, SK.block])).toEqual([SK.parry]); // a Low band skill still counts as missing
    expect(getLibrary().npcRoles![closestRole([SK.healing, SK.insight], TH.road_bandits).role].kind).toBe('combat'); // only roles the theme takes
  });

  it('NR28: a composition by wants validates, takes the closest role, and a gap is logged for the GM grouped by who was wanted', () => {
    const s = toStoryStart(makeVillage());
    const p = byWants('a sapper', [SK.melee_medium, SK.heavy_armor, SK.handiwork]);
    expect(validateStagePlan(s, p, ctx)).toEqual([]);
    expect(p.cast.at(-1)!.compose!.role).toBe(RO.knight);
    applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
    const orla = s.actors.find((a) => a.names.current === 'Orla')!;
    expect(s.hidden.roleWants).toEqual([expect.objectContaining({ actorId: orla.id, label: 'a sapper', role: RO.knight, missing: [SK.handiwork] })]);
    const twice = [...s.hidden.roleWants!, { ...s.hidden.roleWants![0], label: 'A Sapper', turn: 9 }];
    expect(roleWantGroups(twice)).toEqual([expect.objectContaining({ label: 'a sapper', role: RO.knight, count: 2 })]);
  });

  it('NR28: a fully covered want logs nothing; bad wants and a composition with neither role nor wants are refused', () => {
    const s = toStoryStart(makeVillage());
    const ok = byWants('a herbwife', [SK.healing, SK.insight], TH.village_folk);
    expect(validateStagePlan(s, ok, ctx)).toEqual([]);
    applyStagePlan(s, ok, ctx, { entry: 'open' }, createRng(1));
    expect(s.hidden.roleWants ?? []).toEqual([]);
    const s2 = s; // validation reads the state, never changes it
    expect(validateStagePlan(s2, byWants('x', [SK.healing]), ctx).map((e) => e.code)).toContain('bad_compose');
    expect(validateStagePlan(s2, byWants('x', [SK.healing, 'SK999']), ctx).map((e) => e.code)).toContain('bad_compose');
    expect(validateStagePlan(s2, byWants('x', []), ctx).map((e) => e.code)).toContain('bad_compose');
  });
});
