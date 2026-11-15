// 332 Rosters and groups (NR17 to NR20, NR27, NR31). Code rolls, seeded by the land's ids, the hooks each settlement
// holds (by size), the groups on each road (by danger) and at each landmark, and shows the wild table by land cover; the
// World builder fills each entry once by naming its key. A group is one cast entry: code adds the followers.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import type { StagePlan } from '../../src/types';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { drawRegion, type RegionBrief } from '../../src/land/generate';
import { groupMembers, landmarkRoster, roadRoster, siteRoster, wildTable } from '../../src/land/roster';
import { buildWorldView } from '../../src/views';
import { getLibrary } from '../../src/library';
import { RK, LM, LC } from '../../src/library/tableIds';
import { GP, HK, RO } from '../../src/library/npcLayerIds';
import { RC } from '../../src/library/raceIds';
import { RANKS } from '../../src/scales';
import { CONFIG } from '../../src/config';

const brief: RegionBrief = {
  kind: RK.river_valley, name: 'Vale', look: 'a broad vale', river: { name: 'the Wend', from: 'w', to: 'e' },
  settlements: [{ size: 'town', name: 'Marbury', look: '', where: 'crossing' }, { size: 'village', name: 'Thornbury', look: '' }, { size: 'hamlet', name: 'Hob End', look: '' }],
  features: [{ kind: LM.tower, name: 'the watchtower', look: '' }, { kind: LM.quarry, name: 'the old quarry', look: '' }],
  beyond: {},
};
const region = drawRegion('rg1', 0, 0, 4242, brief);
const site = (size: string) => region.sites.find((s) => s.size === size)!;
const pos = (k: string) => RANKS.pos(k as never);
const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const withLand = () => { const s = toStoryStart(makeVillage()); s.regions = [structuredClone(region)]; return s; };
const castRoster = (roster: string, extra: Partial<StagePlan['cast'][number]> = {}): StagePlan => {
  const p = villageStagePlan();
  p.cast.push({ roster, key: 'hook', label: 'the headman', name: 'Orla', appearance: 'a grey cloak', band: 'village_watch', routineSetId: 'gate_guard',
    slots: { post: 'street_door' }, awarenessOfPlayer: 'unaware', motive: 'keeps the village', ...extra } as never);
  return p;
};

describe('332 rosters and groups', () => {
  it('every hook, group and table row names real roles, races, templates, themes, groups, covers and landmarks', () => {
    const lib = getLibrary();
    for (const h of Object.values(lib.hookKinds!)) { for (const r of h.roles ?? []) expect(lib.npcRoles![r], h.id).toBeDefined(); for (const g of h.groups ?? []) expect(lib.groups![g], h.id).toBeDefined(); expect(h.roles?.length || h.groups?.length).toBeTruthy(); }
    for (const g of Object.values(lib.groups!)) {
      expect(lib.themes![g.theme], g.id).toBeDefined();
      for (const p of [g.lead, ...(g.follow ? [g.follow] : [])]) {
        for (const r of [p.role, ...(p.roles ?? [])].filter(Boolean)) expect(lib.npcRoles![r!], g.id).toBeDefined();
        if (p.race) expect(lib.races![p.race], g.id).toBeDefined();
        if (p.template) expect(lib.templates[p.template], g.id).toBeDefined();
        expect(p.role || p.roles?.length || p.template, g.id).toBeTruthy();
      }
    }
    const rows = [...Object.values(lib.roadPeople!).flatMap((r) => r.rows), ...Object.values(lib.wildPeople!).flat(), ...Object.values(lib.landmarkPeople!).flat()];
    for (const m of rows) expect(lib.groups![m.group], m.group).toBeDefined();
    for (const lc of Object.keys(lib.wildPeople!)) expect(lib.landCovers![lc]).toBeDefined();
    for (const lm of Object.keys(lib.landmarkPeople!)) expect(lib.landmarkKinds![lm]).toBeDefined();
    for (const size of ['hamlet', 'village', 'town'] as const) for (const id of [...lib.rosters![size].must, ...lib.rosters![size].pool]) expect(lib.hookKinds![id]).toBeDefined();
  });

  it('NR17: hooks by size; the must-haves are always there; the seat holds its minimum; the same site rolls the same', () => {
    const v = siteRoster(site('village')), t = siteRoster(site('town')), h = siteRoster(site('hamlet'));
    expect(siteRoster(site('village'))).toEqual(v);
    expect(v.length).toBeGreaterThanOrEqual(3); expect(v.length).toBeLessThanOrEqual(5);
    expect(t.length).toBeGreaterThanOrEqual(6); expect(t.length).toBeLessThanOrEqual(10);
    expect(h.length).toBeGreaterThanOrEqual(1); expect(h.length).toBeLessThanOrEqual(2);
    const hooks = getLibrary().hookKinds!;
    expect(v.slice(0, 3).map((e) => e.who)).toEqual([hooks[HK.leader].name, hooks[HK.service].name, hooks[HK.seat].name]);
    expect(t.slice(0, 6).map((e) => e.who)).toEqual([HK.leader, HK.service, HK.seat, HK.trader, HK.watch, HK.rival].map((id) => hooks[id].name));
    const seat = (es: typeof v) => es.find((e) => e.goals)!;
    expect(pos(seat(v).compose!.rank)).toBeGreaterThanOrEqual(pos('rank_3'));
    expect(pos(seat(t).compose!.rank)).toBeGreaterThanOrEqual(pos('rank_5'));
    expect(t.find((e) => e.who === hooks[HK.watch].name)!.group!.id).toBe(GP.watch_patrol);
    expect(v[0].compose!.role).toBe(RO.leader);
    for (const e of [...v, ...t, ...h]) if (e.compose) expect([RC.human, RC.elf]).toContain(e.compose.race);
  });

  it('NR31: about 1 in 20 rostered people are elves', () => {
    const races = Array.from({ length: 400 }, (_, i) => siteRoster({ ...site('town'), id: `rgx_s${i}` })).flat().filter((e) => e.compose).map((e) => e.compose!.race);
    const share = races.filter((r) => r === RC.elf).length / races.length;
    expect(share).toBeGreaterThan(CONFIG.ROSTER_ELF_PCT / 100 / 2); expect(share).toBeLessThan((CONFIG.ROSTER_ELF_PCT / 100) * 2);
  });

  it('NR18-NR20: roads by danger, landmarks by kind, the wild by cover and time of day', () => {
    const road = { ...region.roads[0], danger: 'dangerous' as const };
    const groups = roadRoster(road);
    expect(groups.length).toBeGreaterThanOrEqual(1); expect(groups.length).toBeLessThanOrEqual(3);
    for (const g of groups) expect([GP.bandit_gang, GP.wolf_pack, GP.bear]).toContain(g.group!.id);
    expect(roadRoster({ ...road, danger: 'safe' }).length).toBeLessThanOrEqual(1);
    const tower = region.features.find((f) => f.kind === LM.tower)!, quarry = region.features.find((f) => f.kind === LM.quarry)!;
    expect(landmarkRoster(tower).map((e) => e.group!.id)).toEqual([GP.watch_post]);
    expect(landmarkRoster(quarry)).toEqual([]);
    const name = (lc: string) => getLibrary().landCovers![lc].name;
    const day = wildTable(region, false), night = wildTable(region, true);
    const farm = (t: typeof day) => t.find((x) => x.cover === name(LC.farmland))?.meet.map((m) => m.group) ?? [];
    if (region.cover.includes('1')) { expect(farm(day)).toEqual([GP.dog]); expect(farm(night)).toEqual([GP.wolf_pack]); }
  });

  it('NR27: a group is its leader a rank up and its followers; races fixed for beasts, rolled for people', () => {
    const lib = getLibrary();
    const wolves = groupMembers(lib.groups![GP.wolf_pack], 'rank_2', 'x');
    expect(wolves[0]).toMatchObject({ lead: true, compose: { race: RC.wolf, role: RO.beast, rank: 'rank_3' } });
    expect(wolves.length - 1).toBeGreaterThanOrEqual(2); expect(wolves.length - 1).toBeLessThanOrEqual(5);
    for (const w of wolves.slice(1)) expect(w.compose).toMatchObject({ race: RC.wolf, rank: 'rank_2' });
    const slimes = groupMembers(lib.groups![GP.slimes], 'rank_2', 'y');
    expect(slimes.every((m) => m.template && !m.compose)).toBe(true);
  });

  it('NR17: a cast entry naming a roster key takes who and how strong from it, once; the World view drops filled entries', () => {
    const s = withLand();
    const leader = siteRoster(site('village'))[0];
    const p = castRoster(leader.key);
    expect(validateStagePlan(s, p, ctx)).toEqual([]);
    expect(p.cast.at(-1)!.compose).toEqual(leader.compose);
    applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
    expect(s.hidden.rosterFilled).toEqual([leader.key]);
    expect(validateStagePlan(s, castRoster(leader.key), ctx).map((e) => e.code)).toContain('bad_roster');
    expect(validateStagePlan(s, castRoster('rg1_s99.h1'), ctx).map((e) => e.code)).toContain('bad_roster');
    const v = buildWorldView(s, { kind: 'frontier', placeId: 'tavern' } as never);
    const vs = v.land!.sites.find((x) => x.id === site('village').id)!;
    expect(vs.roster!.map((e) => e.key)).not.toContain(leader.key);
    expect(vs.roster!.length).toBe(siteRoster(site('village')).length - 1);
    expect(v.land!.wild).toBeDefined();
    expect(v.catalogs.compose.groups.map((g) => g.id)).toContain(GP.bandit_gang);
  });

  it('NR27: a group entry spawns its leader and followers, counts once against the cast cap, and keeps the band', () => {
    const s = withLand();
    const p = castRoster(undefined as never, { roster: undefined, group: { id: GP.bandit_gang, rank: 'Trained' }, label: 'the bandit chief' });
    delete (p.cast.at(-1) as { roster?: string }).roster;
    while (p.cast.length < CONFIG.PLAN_CAPS.cast) p.cast.push({ ...p.cast[0], key: `extra_${p.cast.length}`, name: `X${p.cast.length}` });
    expect(validateStagePlan(s, p, ctx)).toEqual([]);
    const followers = p.cast.filter((c) => c.groupOf === 'hook');
    expect(followers.length).toBeGreaterThanOrEqual(2);
    expect(p.cast.find((c) => c.key === 'hook')!.compose).toMatchObject({ role: RO.brute, rank: 'rank_3' });
    applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
    const band = s.actors.find((a) => a.names.current === 'Orla')!.bandId;
    expect(s.actors.filter((a) => a.bandId === band && a.label === 'a bandit').length).toBe(followers.length);
  });
});
