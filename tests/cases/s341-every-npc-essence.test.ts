// 341 Every NPC has an essence (NE1-NE5): every template and every person or beast the composer can build carries at least
// one essence row. Beasts get shared rows by natural weapon (NE1 a), people rows come from the humanoid body so elves carry
// them (NE2 a), Lookout's Eyes is for watchers and hunters (NE3 a). An NPC the player kills or bests with no row is flagged
// as a bug report, essence_gap (NE4). A row may also set min / max skills its owner must meet, so a row can be kept to Divine owners. Every row's pick weight lives in one table, CONFIG.ESSENCE_PICK_WEIGHT.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { composeError, composeTemplate } from '../../src/library/spawn';
import { getLibrary } from '../../src/library';
import { ES } from '../../src/library/essenceIds';
import { RC, BT } from '../../src/library/raceIds';
import { RO, TH } from '../../src/library/npcLayerIds';
import { templateEssences } from '../../src/engine/essence';
import { CONFIG } from '../../src/config';

const ids = (c: { race: string; role: string; theme: string; rank: string }) => templateEssences(composeTemplate(c, 'x')).map((x) => x.row.id);

describe('every NPC has an essence', () => {
  it('NE1-NE3: every template, and every person or beast mix the composer accepts, carries a row at every rank; every row has its pick weight', () => {
    makeVillage();
    const lib = getLibrary();
    for (const t of Object.values(lib.templates)) expect(templateEssences(t).length, t.id).toBeGreaterThan(0);
    for (const role of Object.values(lib.npcRoles!)) for (const theme of Object.values(lib.themes!)) for (const race of Object.values(lib.races ?? {})) {
      if ((role.kind !== 'beast') !== (race.bodyTypeId === BT.humanoid)) continue; // people are humanoid, beasts are not
      for (const rank of ['rank_0', 'rank_1', 'rank_3', 'rank_6', 'rank_8']) {
        const c = { race: race.id, role: role.id, theme: theme.id, rank };
        if (!composeError(c)) expect(ids(c).length, `${role.name} ${theme.name} ${race.name} ${rank}`).toBeGreaterThan(0);
      }
    }
    // every essence row has its pick weight in the one table, CONFIG.ESSENCE_PICK_WEIGHT
    for (const id of Object.keys(lib.essences!)) expect(CONFIG.ESSENCE_PICK_WEIGHT[id], id).toBeGreaterThan(0);
  });

  it('NE1 a: a beast carries the rows of the natural weapons it has, and Cornered Nerve only while its Resolve leads (D-362); a person never does', () => {
    makeVillage();
    const beast = (race: string) => ids({ race, role: RO.beast, theme: TH.wild_beasts, rank: 'rank_3' });
    expect(beast(RC.wolf)).toEqual([ES.fang_nose]);
    expect(beast(RC.boar)).toEqual([ES.horn_hide]);
    expect(beast(RC.tiger)).toEqual([ES.fang_nose, ES.claw_pounce]);
    expect(beast(RC.crocodile)).toEqual([ES.fang_nose, ES.lashing_tail]);
    expect(beast(RC.slime)).toEqual([ES.gel_patience]);
    for (const id of [ES.fang_nose, ES.horn_hide, ES.claw_pounce, ES.lashing_tail]) expect(ids({ race: RC.human, role: RO.brute, theme: TH.road_bandits, rank: 'rank_6' })).not.toContain(id);
    // D-362: a beast whose Resolve is above every weapon skill carries Cornered Nerve; one whose weapons outgrow it does not
    const beastAt = (race: string, rank: string) => ids({ race, role: RO.beast, theme: TH.wild_beasts, rank });
    for (const race of [RC.wolf, RC.boar, RC.tiger, RC.dragon, RC.python]) {
      expect(beastAt(race, 'rank_0'), race).toEqual([ES.cornered_nerve]); // Resolve 50, weapons about 15
      expect(beastAt(race, 'rank_3'), race).not.toContain(ES.cornered_nerve); // weapons 65 over Resolve 50
    }
    expect(ids({ race: RC.human, role: RO.leader, theme: TH.village_folk, rank: 'rank_0' })).not.toContain(ES.cornered_nerve); // beasts only
  });

  it('NE2 a: an elf carries what a human of the same role and theme carries', () => {
    makeVillage();
    for (const role of [RO.soldier, RO.talker, RO.sneak, RO.worker]) {
      const c = { role, theme: TH.village_folk, rank: 'rank_3' };
      if (composeError({ ...c, race: RC.human })) continue;
      expect(ids({ ...c, race: RC.elf })).toEqual(ids({ ...c, race: RC.human }));
    }
  });
});
