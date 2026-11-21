// 333 NPC roles, fourth round (NR21, NR37, NR38). Beast prefixes: Dire (PF1) is one rank up and half again the health,
// shown in the label; any beast may carry one; groups roll it on 1 in 10 beasts (never on safe or quiet roads).
// NR21 a: rank weights by kind of hook are the answered numbers. NR39 a: an NPC's level is the rank table read backwards on
// its High-band skills (levels up to Paragon from the training simulation); NR40 a: times its grandeur.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { composeError, composeTemplate, levelAtSkill, npcGrandeur, presetSkills, spawnNpc, templateLevel } from '../../src/library/spawn';
import { SK } from '../../src/library/skillIds';
import { actorLevel } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { groupMembers } from '../../src/land/roster';
import { totalHp } from '../../src/ruleset/body';
import { GP, PF, RO, TH } from '../../src/library/npcLayerIds';
import { RC } from '../../src/library/raceIds';
import { CONFIG } from '../../src/config';

const wolf = { race: RC.wolf, role: RO.beast, theme: TH.wild_beasts, rank: 'rank_2' };
const soldier = { race: RC.human, role: RO.soldier, theme: TH.travellers, rank: 'rank_2' };

describe('333 NPC roles, fourth round', () => {
  it('NR37: a Dire wolf is one rank up with half again the health (the prefix multiplies it), and its own blueprint', () => {
    const s = makeVillage();
    const plain = composeTemplate(wolf, 'a wolf'), dire = composeTemplate({ ...wolf, prefix: PF.dire }, 'a dire wolf');
    expect(dire.rank).toBe('rank_3');
    expect(dire.prefix).toBe(PF.dire);
    expect(dire.id).not.toBe(plain.id);
    s.blueprints.push({ storyId: s.storyId, kind: 'npcTemplate', id: dire.id, data: dire as never });
    const a = spawnNpc(s, dire.id, { id: 'w1', zone: s.player.zone, placeId: s.player.placeId, bandId: 'b' });
    expect(a.core.prefix).toBe(PF.dire);
    const b = s.actors[0], before = totalHp(s, b);
    b.core.prefix = PF.dire;
    expect(totalHp(s, b)).toBeCloseTo(before * getLibrary().prefixes![PF.dire].hpMult);
  });

  it('NR46 b: a Dire beast has ×1.2 on every banded skill after the rank step, and its level follows', () => {
    const veteran = composeTemplate({ ...wolf, rank: 'rank_3' }, 'a wolf'), dire = composeTemplate({ ...wolf, prefix: PF.dire }, 'a dire wolf');
    const plain = presetSkills(veteran), fierce = presetSkills(dire);
    const banded = Object.keys(plain).filter((id) => id !== SK.resolve && plain[id].raw > 0 && !(id in (veteran.minimums ?? {})));
    expect(banded.length).toBeGreaterThan(0);
    for (const id of banded) expect(Math.abs(fierce[id].raw - plain[id].raw * 1.2)).toBeLessThanOrEqual(1);
    expect(templateLevel(dire)).toBeGreaterThan(templateLevel(veteran));
  });

  it('NR38: only beasts carry a prefix, an unknown prefix is refused; a group rolls Dire per beast at its chance, never at 0, and the label says so', () => {
    expect(composeError({ ...wolf, prefix: PF.dire })).toBeUndefined();
    expect(composeError({ race: RC.human, role: RO.soldier, theme: TH.town_watch, rank: 'rank_2', prefix: PF.dire })).toMatch(/only beasts/);
    expect(composeError({ ...wolf, prefix: 'PF99' })).toMatch(/unknown/);
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

  it('NR39: the rank table read backwards gives the level, and a live NPC levels with its own skills', () => {
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
    // the rank table read backwards: anchors give their levels, between them the level moves evenly
    expect(levelAtSkill(50)).toBe(8);
    expect(levelAtSkill(87.5)).toBe(17.5); // halfway from Elite (75, L15) to Paragon (100, L20)
    expect(levelAtSkill(500)).toBe(CONFIG.RANK_ROWS.rank_8.level + CONFIG.RANK_BEYOND_STEP.level); // one step past Divine
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

});

