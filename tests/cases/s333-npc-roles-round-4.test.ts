// 333 NPC roles, fourth round (NR21, NR37, NR38). Beast prefixes: Dire (PF1) is one rank up and half again the health,
// shown in the label; any beast may carry one; groups roll it on 1 in 10 beasts (never on safe or quiet roads).
// NR21 a: rank weights by kind of hook are the answered numbers. NR39 a: an NPC's level is the rank table read backwards on
// its High-band skills (levels up to Paragon from the training simulation); NR40 a: times its grandeur.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { composeError, composeTemplate, levelAtSkill, npcGrandeur, spawnNpc, templateLevel } from '../../src/library/spawn';
import { actorLevel } from '../../src/engine/xp';
import { siteRoster } from '../../src/land/roster';
import { getLibrary } from '../../src/library';
import { groupMembers } from '../../src/land/roster';
import { totalHp } from '../../src/ruleset/body';
import { GP, PF, RO, TH } from '../../src/library/npcLayerIds';
import { RC } from '../../src/library/raceIds';
import { CONFIG } from '../../src/config';

const wolf = { race: RC.wolf, role: RO.beast, theme: TH.wild_beasts, rank: 'rank_2' };
const soldier = { race: RC.human, role: RO.soldier, theme: TH.travellers, rank: 'rank_2' };

describe('333 NPC roles, fourth round', () => {
  it('NR37: a Dire wolf is one rank up with half again the health, and its own blueprint', () => {
    const s = makeVillage();
    const plain = composeTemplate(wolf, 'a wolf'), dire = composeTemplate({ ...wolf, prefix: PF.dire }, 'a dire wolf');
    expect(dire.rank).toBe('rank_3');
    expect(dire.prefix).toBe(PF.dire);
    expect(dire.id).not.toBe(plain.id);
    s.blueprints.push({ storyId: s.storyId, kind: 'npcTemplate', id: dire.id, data: dire as never });
    const a = spawnNpc(s, dire.id, { id: 'w1', zone: s.player.zone, placeId: s.player.placeId, bandId: 'b' });
    expect(a.core.prefix).toBe(PF.dire);
  });

  it('NR37: health is multiplied by the prefix', () => {
    const s = makeVillage();
    const a = s.actors[0];
    const before = totalHp(s, a);
    a.core.prefix = PF.dire;
    expect(totalHp(s, a)).toBeCloseTo(before * getLibrary().prefixes![PF.dire].hpMult);
  });

  it('NR38: only beasts carry a prefix; an unknown prefix is refused', () => {
    expect(composeError({ ...wolf, prefix: PF.dire })).toBeUndefined();
    expect(composeError({ race: RC.human, role: RO.soldier, theme: TH.town_watch, rank: 'rank_2', prefix: PF.dire })).toMatch(/only beasts/);
    expect(composeError({ ...wolf, prefix: 'PF99' })).toMatch(/unknown/);
  });

  it('NR38: a group rolls Dire per beast at its chance, never at 0, and the label says so', () => {
    const g = getLibrary().groups![GP.wolf_pack];
    const all = groupMembers(g, 'rank_2', 'x', 100);
    expect(all.every((m) => m.compose!.prefix === PF.dire)).toBe(true);
    expect(all[0].label).toBe('the dire pack leader');
    expect(all[1].label).toBe('a dire wolf');
    expect(groupMembers(g, 'rank_2', 'x', 0).some((m) => m.compose!.prefix)).toBe(false);
    const caravan = groupMembers(getLibrary().groups![GP.caravan], 'rank_2', 'y', 100); // people never roll one
    expect(caravan.some((m) => m.compose?.prefix)).toBe(false);
    let n = 0, dire = 0;
    for (let i = 0; i < 300; i++) for (const m of groupMembers(g, 'rank_2', `s${i}`, CONFIG.DIRE_PCT)) { n++; if (m.compose!.prefix) dire++; }
    expect(dire / n).toBeGreaterThan(0.05); expect(dire / n).toBeLessThan(0.16);
  });

  it('NR21 a: crowd, faces, leaders, threats and seats use the answered weights', () => {
    const R = CONFIG.ROSTER_RANKS;
    expect(R.crowd).toEqual({ rank_1: 70, rank_2: 30 });
    expect(R.face).toEqual({ rank_2: 50, rank_3: 40, rank_4: 10 });
    expect(R.lead).toEqual({ rank_3: 50, rank_4: 40, rank_5: 10 });
    expect(Object.keys(R.threat.village).at(-1)).toBe('rank_4');
    expect(Object.keys(R.threat.town).at(-1)).toBe('rank_5');
    expect(R.seat.town).toEqual({ rank_5: 100 });
    expect(CONFIG.SEAT_STEP_UP_PCT).toBe(20);
  });

  it('NR39: the rank table read backwards: anchors give their levels, between them the level moves evenly', () => {
    expect(CONFIG.RANK_ROWS.rank_2.level).toBe(8);
    expect(CONFIG.RANK_ROWS.rank_3.level).toBe(12);
    expect(CONFIG.RANK_ROWS.rank_4.level).toBe(15);
    expect(CONFIG.RANK_ROWS.rank_5.level).toBe(20);
    expect(levelAtSkill(50)).toBe(8);
    expect(levelAtSkill(87.5)).toBe(17.5); // halfway from Elite (75, L15) to Paragon (100, L20)
    expect(levelAtSkill(500)).toBe(CONFIG.RANK_ROWS.rank_8.level + CONFIG.RANK_BEYOND_STEP.level); // one step past Divine
  });

  it('NR39: a live NPC levels with its own skills', () => {
    const s = makeVillage();
    s.blueprints.push({ storyId: s.storyId, kind: 'npcTemplate', id: composeTemplate(soldier, 'a soldier').id, data: composeTemplate(soldier, 'a soldier') as never });
    const a = spawnNpc(s, composeTemplate(soldier, 'a soldier').id, { id: 'x1', zone: s.player.zone, placeId: s.player.placeId, bandId: 'b' });
    s.actors.push(a);
    const before = actorLevel(a, s);
    expect(before).toBeGreaterThanOrEqual(6);
    expect(before).toBeLessThanOrEqual(10);
    for (const id of Object.keys(a.core.skills)) if (a.core.skills[id].state === 'tagged') a.core.skills[id].raw = 100;
    expect(actorLevel(a, s)).toBeGreaterThanOrEqual(20); // true skill: its perks may add a little
    expect(actorLevel(a, s)).toBeLessThanOrEqual(23);
    expect(actorLevel(a)).toBe(0); // without the story its blueprint can't be found
  });

  it('NR40: grandeur is the higher of role and theme; a seat is grand; it multiplies the level', () => {
    expect(npcGrandeur(composeTemplate({ ...soldier, role: RO.worker, theme: TH.village_folk }, 'a farmhand'))).toBe('mundane');
    expect(npcGrandeur(composeTemplate({ ...soldier, role: RO.worker, theme: TH.town_watch }, 'x'))).toBe('ordinary');
    expect(npcGrandeur(composeTemplate({ ...soldier, role: RO.knight }, 'a knight'))).toBe('grand');
    const paragon = { ...soldier, rank: 'rank_5' };
    expect(templateLevel(composeTemplate(paragon, 'a soldier'))).toBe(20);
    expect(templateLevel(composeTemplate({ ...paragon, grandeur: 'grand' }, 'the lord'))).toBe(25);
    expect(templateLevel(composeTemplate({ ...paragon, role: RO.worker, theme: TH.village_folk }, 'a farmhand'))).toBe(15);
  });

  it('NR40: a settlement\'s seat of the Great is cast grand', () => {
    const s = makeVillage();
    const sites = (s.regions ?? []).flatMap((r) => r.sites);
    const seats = sites.flatMap(siteRoster).filter((e) => e.goals);
    for (const e of seats) expect(e.compose?.grandeur).toBe('grand');
  });
});

