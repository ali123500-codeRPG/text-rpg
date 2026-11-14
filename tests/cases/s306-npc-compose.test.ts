// 306 NPC gear, compositions and the cast check (NPC Generation NG10, NG15, NG16 b). Gear comes from the role's gear
// classes, the NPC's skills and its theme's wealth; the Weaver can compose an NPC from catalog IDs, which code builds as a
// story blueprint; who it can't field goes in templateGap, listed for the GM; the hostile cast's power is logged against
// the challenge grade's band.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import type { StagePlan } from '../../src/types';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { composeTemplate, composedId, rankKeyOf, refreshCopies, templateLoadout, templateSkills } from '../../src/library/spawn';
import { getLibrary, hasTemplate, itemDef, npcTemplate } from '../../src/library';
import { TP } from '../../src/library/templateIds';
import { RC } from '../../src/library/raceIds';
import { CL } from '../../src/library/classIds';
import { IT } from '../../src/library/itemIds';
import { RO, TH } from '../../src/library/npcLayerIds';
import { EQUIP_LEVELS } from '../../src/scales';
import { itemLevel } from '../../src/ruleset/requirements';
import { CONFIG } from '../../src/config';
import { buildWeaverView } from '../../src/views';

const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const watchman = { race: RC.human, role: RO.soldier, theme: TH.town_watch, rank: 'Veteran' };
const withCompose = (extra: Partial<StagePlan['cast'][number]> = {}): StagePlan => {
  const p = villageStagePlan();
  p.cast.push({ compose: watchman, key: 'captain', label: 'a watch captain', name: 'Orla', appearance: 'a grey cloak and a hard stare',
    band: 'village_watch', routineSetId: 'gate_guard', slots: { post: 'street_door' }, awarenessOfPlayer: 'unaware', motive: 'keeps the gate', ...extra });
  return p;
};

describe('306 NPC gear, compositions and the cast check', () => {
  it('NG10: gear by role, skill and theme wealth; pins stay; the thief gets the dagger and gambeson it used to pin', () => {
    const thief = npcTemplate(null, TP.thief);
    expect(thief.loadout ?? []).toEqual([]);
    expect(templateLoadout(thief, templateSkills(thief, 'x'))).toEqual([IT.dagger, IT.gambeson]); // village folk: Common at most
    const guard = npcTemplate(null, TP.guard);
    expect(templateLoadout(guard, templateSkills(guard, 'x'))).toEqual(guard.loadout); // its pins fill weapon, armor and shield
    const vet = composeTemplate(watchman, 'a watch captain');
    const gear = templateLoadout(vet, templateSkills(vet, 'x')).map((id) => getLibrary().items[id]);
    expect(gear.map((d) => (d.armor ? 'armor' : d.shield ? 'shield' : d.kind)).sort()).toEqual(['armor', 'shield', 'weapon']);
    for (const d of gear) expect(EQUIP_LEVELS.pos(itemLevel(d) ?? 'crude')).toBeLessThanOrEqual(EQUIP_LEVELS.pos('fine')); // town watch: Fine
    const poor = composeTemplate({ ...watchman, theme: TH.road_bandits }, 'a bandit');
    for (const id of templateLoadout(poor, templateSkills(poor, 'x'))) expect(EQUIP_LEVELS.pos(itemLevel(itemDef(null, id)) ?? 'crude')).toBeLessThanOrEqual(EQUIP_LEVELS.pos('common'));
  });

  it('NG15: a composed cast entry validates, spawns from a story blueprint (one per composition) and survives a reload', () => {
    const s = toStoryStart(makeVillage());
    const p = withCompose();
    p.cast.push({ ...p.cast[p.cast.length - 1], key: 'captain_2', name: 'Bram' });
    expect(validateStagePlan(s, p, ctx)).toEqual([]);
    applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
    const id = composedId(watchman);
    expect(id).toBe(`NC_${RC.human}_${RO.soldier}_${TH.town_watch}_rank_3`);
    expect(s.blueprints.filter((b) => b.kind === 'npcTemplate' && b.id === id)).toHaveLength(1);
    const orla = s.actors.find((a) => a.names.current === 'Orla')!;
    expect(orla.core.templateId).toBe(id);
    expect(orla.core.classes).toEqual([]);
    expect(hasTemplate(s, id)).toBe(true);
    const before = structuredClone(orla.core.skills);
    refreshCopies(s);
    expect(orla.core.skills).toEqual(before);
    expect(rankKeyOf('Divine++')).toBe('rank_10');
    expect(composeTemplate({ ...watchman, class: CL.guard }, 'x').classId).toBe(CL.guard);
  });

  it('NG15: unknown parts are refused; templateGap is kept for the GM view; the Weaver sees the compose catalog', () => {
    const s = toStoryStart(makeVillage());
    const bad = withCompose({ compose: { ...watchman, role: 'RO999' } });
    expect(validateStagePlan(s, bad, ctx).map((e) => e.code)).toContain('bad_compose');
    const both = withCompose({ template: TP.guard });
    expect(validateStagePlan(s, both, ctx).map((e) => e.code)).toContain('bad_cast');
    const p = withCompose({ templateGap: 'a mounted courier with a fast horse' });
    expect(validateStagePlan(s, p, ctx)).toEqual([]);
    applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
    const orla = s.actors.find((a) => a.names.current === 'Orla')!;
    expect(s.hidden.templateWants).toEqual([expect.objectContaining({ actorId: orla.id, label: 'a watch captain', wanted: 'a mounted courier with a fast horse', template: composedId(watchman) })]);
    expect(s.hidden.castNotes![orla.id].templateGap).toBe('a mounted courier with a fast horse');
    const v = buildWeaverView(s, { kind: 'scenario', placeId: 'tavern' });
    expect(v.catalogs.compose.roles.map((r) => r.id)).toContain(RO.soldier);
    expect(v.catalogs.compose.ranks[3]).toEqual({ key: 'rank_3', name: 'Veteran', level: 8 });
  });

  it('NG16 b: the hostile cast\'s power over the player\'s is logged against the grade\'s band, and never refused', () => {
    const s = toStoryStart(makeVillage());
    const p = villageStagePlan();
    expect(validateStagePlan(s, p, ctx)).toEqual([]);
    applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
    const c = s.hidden.castPower!.at(-1)!;
    expect(c.challenge).toBe(p.event.challenge);
    expect(c.ratio).toBeCloseTo(c.hostile / c.player, 1);
    expect(c.band).toEqual(CONFIG.CAST_POWER_BANDS[p.event.challenge]);
    expect(s.log.some((l) => l.code === 'cast_power_off_band')).toBe(c.off);
    expect(c.hostile).toBeGreaterThan(0); // the field's slimes are hostile
  });
});
