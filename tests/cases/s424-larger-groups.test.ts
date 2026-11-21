// 424 NF7 a: the larger rung of groups, each with one notable head. A Bandit company (a captain 2 ranks up, 2 gang chiefs
// 1 rank up, 6 to 10 bandits) and a Watch garrison (a watch captain 2 ranks up, 2 sergeants 1 rank up, 4 to 8 watchmen)
// roll in towns and larger places and on dangerous roads, never in villages. Only the head is notable; today's small
// groups have no notable member.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import type { Site, StagePlan } from '../../src/types';
import { applyStagePlan, validateStagePlan, type PlanContext } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { groupMembers, hookGroups, siteRoster } from '../../src/land/roster';
import { notable } from '../../src/engine/essence';
import { getLibrary } from '../../src/library';
import { GP, HK, RO } from '../../src/library/npcLayerIds';
import { checkStagePlan } from '../../src/agents/schema';

const lib = () => getLibrary();
const ctx: PlanContext = { tier: 'success', kind: 'scenario', placeId: 'tavern' };
const site = (size: string, i: number): Site => ({ id: `rgx_s${i}`, size: size as Site['size'], name: 'X', look: '', at: { x: 0, y: 0 }, why: '' });

describe('424 larger groups with a notable head', () => {
  it('a company is its captain 2 ranks up (notable), 2 gang chiefs 1 rank up and 6 to 10 bandits', () => {
    for (let i = 0; i < 5; i++) {
      const m = groupMembers(lib().groups![GP.bandit_company], 'rank_2', `c${i}`);
      expect(m[0]).toMatchObject({ lead: true, notable: true, label: 'a bandit captain', compose: { role: RO.brute, rank: 'rank_4' } });
      const chiefs = m.filter((x) => x.label === 'a gang chief'), bandits = m.filter((x) => x.label === 'a bandit');
      expect(chiefs.length).toBe(2);
      for (const c of chiefs) expect(c.compose!.rank).toBe('rank_3');
      expect(bandits.length).toBeGreaterThanOrEqual(6); expect(bandits.length).toBeLessThanOrEqual(10);
      expect(m.slice(1).some((x) => x.notable)).toBe(false);
    }
    const g = groupMembers(lib().groups![GP.watch_garrison], 'rank_2', 'g');
    expect(g[0]).toMatchObject({ notable: true, label: 'a watch captain', compose: { rank: 'rank_4' } });
    expect(g.filter((x) => x.label === 'a watch sergeant').length).toBe(2);
    const men = g.filter((x) => x.label === 'a watchman').length;
    expect(men).toBeGreaterThanOrEqual(4); expect(men).toBeLessThanOrEqual(8);
    // today's small groups keep no notable member (NF3)
    for (const id of [GP.bandit_gang, GP.watch_patrol, GP.wolf_pack]) expect(groupMembers(lib().groups![id], 'rank_3', id).some((m) => m.notable), id).toBe(false);
  });

  it('towns and larger roll them; hamlets and villages never do', () => {
    const threat = lib().hookKinds![HK.threat], watch = lib().hookKinds![HK.watch];
    for (const size of ['hamlet', 'village'] as const) {
      expect(hookGroups(threat, size)).not.toContain(GP.bandit_company);
      expect(hookGroups(watch, size)).not.toContain(GP.watch_garrison);
    }
    for (const size of ['town', 'city', 'court'] as const) {
      expect(hookGroups(threat, size)).toContain(GP.bandit_company);
      expect(hookGroups(watch, size)).toContain(GP.watch_garrison);
    }
    const rolled = (size: string) => new Set(Array.from({ length: 100 }, (_, i) => siteRoster(site(size, i))).flat().map((e) => e.group?.id).filter(Boolean));
    const v = rolled('village');
    expect(v.has(GP.bandit_company) || v.has(GP.watch_garrison)).toBe(false);
  });

  it('cast as one entry, the captain is a notable foe; the chiefs and bandits are not', () => {
    const s = toStoryStart(makeVillage());
    const p = villageStagePlan();
    p.cast.push({ key: 'co', group: { id: GP.bandit_company, rank: 'Trained' }, label: 'the bandit captain', name: 'Varn', appearance: 'a scarred man',
      band: 'village_watch', routineSetId: 'gate_guard', slots: { post: 'street_door' }, awarenessOfPlayer: 'unaware', motive: 'takes the road' } as never);
    expect(validateStagePlan(s, p, ctx)).toEqual([]);
    expect(p.cast.filter((c) => c.groupOf === 'co').length).toBeGreaterThanOrEqual(8);
    applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
    const captain = s.actors.find((a) => a.names.current === 'Varn')!;
    expect(notable(s, captain)).toBe(true);
    const rest = s.actors.filter((a) => a.bandId === captain.bandId && (a.label === 'a gang chief' || a.label === 'a bandit'));
    expect(rest.length).toBeGreaterThanOrEqual(8);
    for (const a of rest) expect(notable(s, a)).toBe(false);
    // the field is code-only: the Weaver's own output loses it
    const w = villageStagePlan();
    (w.cast[0] as { notable?: true }).notable = true;
    expect((checkStagePlan(structuredClone(w)).value.cast[0] as { notable?: true }).notable).toBeUndefined();
  });


});
