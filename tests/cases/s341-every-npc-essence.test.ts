// 341 Every NPC has an essence (NE1-NE5): every template and every person or beast the composer can build carries at least
// one essence row. Beasts get shared rows by natural weapon (NE1 a), people rows come from the humanoid body so elves carry
// them (NE2 a), Lookout's Eyes is for watchers and hunters (NE3 a). An NPC the player kills or bests with no row is flagged
// as a bug report, essence_gap (NE4).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { composeError, composeTemplate, spawnNpc } from '../../src/library/spawn';
import { getLibrary } from '../../src/library';
import { TP } from '../../src/library/templateIds';
import { ES } from '../../src/library/essenceIds';
import { RC, BT } from '../../src/library/raceIds';
import { RO, TH } from '../../src/library/npcLayerIds';
import { offersFromDefeats, templateEssences } from '../../src/engine/essence';
import { isBugCode } from '../../src/save/bugs';
import type { Rng } from '../../src/types';

const ids = (c: { race: string; role: string; theme: string; rank: string }) => templateEssences(composeTemplate(c, 'x')).map((x) => x.row.id);

describe('every NPC has an essence', () => {
  it('NE1-NE3: every template, and every person or beast mix the composer accepts, carries a row at every rank', () => {
    makeVillage();
    const lib = getLibrary();
    for (const t of Object.values(lib.templates)) expect(templateEssences(t).length, t.id).toBeGreaterThan(0);
    for (const role of Object.values(lib.npcRoles!)) for (const theme of Object.values(lib.themes!)) for (const race of Object.values(lib.races ?? {})) {
      if ((role.kind !== 'beast') !== (race.bodyTypeId === BT.humanoid)) continue; // people are humanoid, beasts are not
      // D-362: an Untrained (rank_0) beast's Resolve 50 outweighs its weapons, so it carries none; the game flags it (NE4)
      for (const rank of role.kind === 'beast' ? ['rank_1', 'rank_3', 'rank_6', 'rank_8'] : ['rank_0', 'rank_3', 'rank_6', 'rank_8']) {
        const c = { race: race.id, role: role.id, theme: theme.id, rank };
        if (!composeError(c)) expect(ids(c).length, `${role.name} ${theme.name} ${race.name} ${rank}`).toBeGreaterThan(0);
      }
    }
  });

  it('NE1 a: a beast carries the rows of the natural weapons it has; a person never does', () => {
    makeVillage();
    const beast = (race: string) => ids({ race, role: RO.beast, theme: TH.wild_beasts, rank: 'rank_3' });
    expect(beast(RC.wolf)).toEqual([ES.fang_nose]);
    expect(beast(RC.boar)).toEqual([ES.horn_hide]);
    expect(beast(RC.tiger)).toEqual([ES.fang_nose, ES.claw_pounce]);
    expect(beast(RC.crocodile)).toEqual([ES.fang_nose, ES.lashing_tail]);
    expect(beast(RC.slime)).toEqual([ES.gel_patience]);
    for (const id of [ES.fang_nose, ES.horn_hide, ES.claw_pounce, ES.lashing_tail]) expect(ids({ race: RC.human, role: RO.brute, theme: TH.road_bandits, rank: 'rank_6' })).not.toContain(id);
  });

  it('NE2 a: an elf carries what a human of the same role and theme carries', () => {
    makeVillage();
    for (const role of [RO.soldier, RO.talker, RO.sneak, RO.worker]) {
      const c = { role, theme: TH.village_folk, rank: 'rank_3' };
      if (composeError({ ...c, race: RC.human })) continue;
      expect(ids({ ...c, race: RC.elf })).toEqual(ids({ ...c, race: RC.human }));
    }
  });

  it('NE3 a: Lookout\'s Eyes is on watchers and hunters only; the five templates keep their rows', () => {
    makeVillage();
    expect(ids({ race: RC.human, role: RO.watcher, theme: TH.town_watch, rank: 'rank_3' })).toEqual([ES.lookout_eyes]);
    expect(ids({ race: RC.human, role: RO.hunter, theme: TH.village_folk, rank: 'rank_3' })).toEqual([ES.lookout_eyes]);
    expect(ids({ race: RC.human, role: RO.soldier, theme: TH.town_watch, rank: 'rank_3' })).not.toContain(ES.lookout_eyes);
    for (const t of Object.values(getLibrary().templates)) expect(templateEssences(t).map((x) => x.row.id), t.id).not.toContain(ES.lookout_eyes);
  });

  it('NE4: an NPC the player killed with no row on its list is flagged as a bug report', () => {
    const s = makeVillage();
    const lib = getLibrary(), saved = lib.essences!;
    const thief = spawnNpc(s, TP.thief, { id: 'thief_x', zone: s.player.zone, placeId: s.player.placeId, bandId: 'tavern_folk' });
    s.actors.push(thief);
    thief.core.condition.hpLostPct = 200; thief.mind!.hitByPlayer = true;
    lib.essences = Object.fromEntries(Object.entries(saved).filter(([id]) => id !== ES.street_instinct)); // the thief's only row gone
    const dice: Rng = { state: 1, next: () => 0, int: (lo) => lo, d100: () => 1 };
    offersFromDefeats(s, [thief], dice);
    lib.essences = saved;
    expect(s.log.filter((e) => e.code === 'essence_gap').map((e) => (e.detail as { npc: string }).npc)).toEqual(['thief_x']);
    expect(isBugCode('essence_gap')).toBe(true);
    expect(s.player.progression?.essenceOffers ?? []).toEqual([]);
  });
});
