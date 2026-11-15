// 329 NPC roles, first round (NR4, NR6, NR16, NR24): the Hunter and the Healer roles, four new themes, and the bandits'
// camp and roadside ambush. Peasant roles are civilians in the Commoner class line (NR2); no trade skills.
import { describe, expect, it } from 'vitest';
import { getLibrary, routine, routineSet } from '../../src/library';
import { composeTemplate, templateLoadout, templateSkills } from '../../src/library/spawn';
import { RO, TH } from '../../src/library/npcLayerIds';
import { RC } from '../../src/library/raceIds';
import { SK } from '../../src/library/skillIds';
import { GC } from '../../src/library/tableIds';

describe('329 NPC roles, first round', () => {
  it('NR4: a Hunter is a civilian bowman who sneaks; at Trained it carries a bow', () => {
    const r = getLibrary().npcRoles![RO.hunter];
    expect(r.kind).toBe('civilian');
    expect(r.bands.high).toEqual([SK.ranged_medium, SK.sneaking]);
    const t = composeTemplate({ race: RC.human, role: RO.hunter, theme: TH.village_folk, rank: 'Trained' }, 'a hunter');
    const sk = templateSkills(t, 'x');
    expect(sk[SK.ranged_medium].raw).toBeGreaterThan(sk[SK.melee_light].raw);
    const gear = templateLoadout(t, sk).map((id) => getLibrary().items[id]);
    expect(gear.map((d) => d.gearClass)).toContain(GC.ranged_medium);
  });

  it('NR6: a Healer is a civilian who reads and calms people, with no gear of its own', () => {
    const r = getLibrary().npcRoles![RO.healer];
    expect(r.kind).toBe('civilian');
    expect(r.bands.high).toEqual([SK.healing, SK.insight, SK.persuasion]); // NR33: Healing joins its High band
    expect(r.gear).toBeUndefined();
  });

  it('NR16: Town folk, Travellers, Lord\'s household and Monsters, with their wealth', () => {
    const th = getLibrary().themes!;
    expect([TH.town_folk, TH.travellers, TH.lords_household, TH.monsters].map((id) => th[id].name)).toEqual(['Town folk', 'Travellers', "Lord's household", 'Monsters']);
    expect(th[TH.town_folk].wealth).toBe('fine');
    expect(th[TH.travellers].wealth).toBe('common');
    expect(th[TH.lords_household].wealth).toBe('superior');
    expect(th[TH.monsters].wealth).toBeUndefined(); // monsters carry no gear
  });

  it('NR24: bandits keep a camp and lie hidden by a road, rushing out on alert', () => {
    const camp = routineSet('bandit_camp')!, amb = routineSet('bandit_ambush')!;
    expect(camp.tags.role).toEqual(['bandit']);
    expect(camp.routines[0]).toBe('keep_camp');
    expect(routine('keep_camp')!.alert).toBe('defend_camp_alert');
    expect(Object.keys(amb.slots)).toEqual(expect.arrayContaining(['hide', 'road']));
    const lie = routine('ambush_road')!;
    expect(lie.posture).toBe('stealthy');
    expect(lie.steps[0].activity).toBe('lie_in_wait');
    expect(getLibrary().activities!['lie_in_wait'].visibility).toBe('close');
    expect(routine('spring_ambush_alert')!.steps[0].slot).toBe('road');
  });
});
