// Typed IDs (ID review): every converted library table is keyed by its type prefix plus a number, each row's id is
// its key, the constants table lists exactly the library's rows, and every reference to a row points at a real one.
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { SK } from '../../src/library/skillIds';
import { FN, GR } from '../../src/library/functionIds';
import { CL } from '../../src/library/classIds';
import { ACH } from '../../src/library/achievementIds';
import { SV } from '../../src/library/serviceIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';
import { TR } from '../../src/library/treeIds';
import { BT, RC } from '../../src/library/raceIds';
import { TP } from '../../src/library/templateIds';
import { AM, DU, HL, RL, ZK } from '../../src/library/tableIds';
import { modeIdOf } from '../../src/ruleset/gear';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { ALL_BUNDLES } from '../../src/library/allPerks';
import { MARK_SOURCE } from '../../src/engine/perkMarks';
import { PERK_MOVES } from '../../src/ruleset/perks';

const lib = () => getLibrary() as unknown as Record<string, Record<string, { id?: string }>>;

/** a table: its library key, its prefix and its constants */
const TABLES: [string, string, Record<string, string>][] = [
  ['skills', 'SK', SK], ['classes', 'CL', CL], ['achievements', 'AC', ACH], ['services', 'SV', SV], ['perks', 'PK', PK], ['items', 'IT', IT], ['trees', 'TR', TR],
  ['races', 'RC', RC], ['bodyTypes', 'BT', BT], ['templates', 'TP', TP],
  ['roles', 'RL', RL], ['healing', 'HL', HL], ['durations', 'DU', DU], ['zoneKinds', 'ZK', ZK], ['attackModes', 'AM', AM],
];

describe('typed IDs', () => {
  for (const [table, prefix, ids] of TABLES) {
    it(`${table}: keyed ${prefix} + a number, ids match keys, and ${prefix} constants list exactly the rows`, () => {
      const rows = lib()[table];
      for (const [k, d] of Object.entries(rows)) {
        expect(k, table).toMatch(new RegExp(`^${prefix}\\d+$`));
        if (d && typeof d === 'object' && 'id' in d) expect(d.id, k).toBe(k);
      }
      expect(new Set(Object.values(ids)).size, 'no ID listed twice').toBe(Object.values(ids).length);
      expect(Object.keys(rows).sort()).toEqual([...Object.values(ids)].sort());
    });
  }

  it('functions and groups use FN and GR', () => {
    for (const id of Object.values(FN)) expect(id).toMatch(/^FN\d+$/);
    for (const id of Object.values(GR)) expect(id).toMatch(/^GR\d+$/);
  });

  it('every perk reference names a library perk', () => {
    const L = getLibrary(), known = (id: string, where: string) => expect(L.perks[id], `${where}: ${id}`).toBeDefined();
    for (const c of Object.values(L.classes)) {
      for (const id of Object.values(c.levelPerks ?? {}).flat()) known(id, `${c.id} levelPerks`);
      for (const id of c.capstone ?? []) known(id, `${c.id} capstone`);
      for (const x of c.capstones ?? []) known(x.perk, `${c.id} capstones`);
      if (c.unlockPerk) known(c.unlockPerk, `${c.id} unlockPerk`);
    }
    for (const r of Object.values(L.races ?? {})) for (const id of [...(r.innatePerks ?? []), ...(r.innateQuirks ?? [])]) known(id, `race ${r.id}`);
    for (const t of Object.values(L.templates)) for (const id of t.perks ?? []) known(id, `template ${t.id}`);
    for (const b of ALL_BUNDLES) for (const id of b.parts) known(id, `bundle ${b.name}`);
    for (const id of BUILT_PERKS) known(id, 'BUILT_PERKS');
    for (const id of Object.keys(MARK_SOURCE)) known(id, 'MARK_SOURCE');
    for (const id of Object.keys(PERK_MOVES)) known(id, 'PERK_MOVES');
  });

  it('every item reference names a library item', () => {
    const L = getLibrary();
    for (const t of Object.values(L.templates)) for (const id of t.loadout ?? []) expect(L.items[id], `template ${t.id}: ${id}`).toBeDefined();
  });

  it('healing sources, attack modes and agent-written mode names resolve to real rows', () => {
    const L = getLibrary();
    for (const i of Object.values(L.items)) if (i.heal) expect(L.healing?.[i.heal], `item ${i.id} heal`).toBeDefined();
    for (const v of Object.values(L.services ?? {})) if (v.heals) expect(L.healing?.[v.heals], `service ${v.id} heals`).toBeDefined();
    const modes = [...Object.values(L.items).flatMap((i) => i.weapon?.modes ?? []), ...Object.values(L.bodyTypes).flatMap((b) => b.naturalAttacks)];
    for (const m of modes) expect(L.attackModes?.[m.id], `mode ${m.id}`).toBeDefined();
    expect(modeIdOf('Thrust')).toBe(AM.thrust);
    expect(modeIdOf(AM.thrust)).toBe(AM.thrust);
  });

  it('templates name real races, races real body types, and skills real trees', () => {
    const L = getLibrary();
    for (const t of Object.values(L.templates)) expect(L.races?.[t.raceId], `template ${t.id}`).toBeDefined();
    for (const r of Object.values(L.races ?? {})) expect(L.bodyTypes[r.bodyTypeId], `race ${r.id}`).toBeDefined();
    for (const s of Object.values(L.skills)) expect(L.trees[s.treeId], `skill ${s.id}`).toBeDefined();
  });
});
