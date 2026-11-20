// 329 NPC roles, first round (NR4, NR6, NR16, NR24): the Hunter and the Healer roles, four new themes, and the bandits'
// camp and roadside ambush. Peasant roles are civilians in the Commoner class line (NR2); no trade skills.
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { composeTemplate, templateLoadout, templateSkills } from '../../src/library/spawn';
import { RO, TH } from '../../src/library/npcLayerIds';
import { RC } from '../../src/library/raceIds';
import { SK } from '../../src/library/skillIds';
import { GC } from '../../src/library/tableIds';

describe('329 NPC roles, first round', () => {
  it('NR4: a Hunter at Trained shoots better than it fights and carries a bow', () => {
    const t = composeTemplate({ race: RC.human, role: RO.hunter, theme: TH.village_folk, rank: 'Trained' }, 'a hunter');
    const sk = templateSkills(t, 'x');
    expect(sk[SK.ranged_medium].raw).toBeGreaterThan(sk[SK.melee_light].raw);
    const gear = templateLoadout(t, sk).map((id) => getLibrary().items[id]);
    expect(gear.map((d) => d.gearClass)).toContain(GC.ranged_medium);
  });
});
