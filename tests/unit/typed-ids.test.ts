// Typed IDs (ID review): every converted library table is keyed by its type prefix plus a number, each row's id is
// its key, the constants table lists exactly the library's rows, and every reference to a row points at a real one.
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { SK } from '../../src/library/skillIds';
import { FN, GR } from '../../src/library/functionIds';
import { CL } from '../../src/library/classIds';
import { ACH } from '../../src/library/achievementIds';
import { SV } from '../../src/library/serviceIds';
import { GD } from '../../src/library/godIds';
import { PK } from '../../src/library/perkIds';
import { PERK_WRITEUPS } from '../../src/library/perks';
import { IT } from '../../src/library/itemIds';
import { TR } from '../../src/library/treeIds';
import { BT, RC } from '../../src/library/raceIds';
import { TP } from '../../src/library/templateIds';
import { RO, TH } from '../../src/library/npcLayerIds';
import { AM, DU, GC, HL, PA, PY, RL, TN, VL, ZK } from '../../src/library/tableIds';
import { modeSkill } from '../../src/ruleset/gear';
import { ARMOR_SKILL } from '../../src/library/skillIds';
import { modeIdOf } from '../../src/ruleset/gear';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { ALL_BUNDLES, SKILL_PARTS } from '../../src/library/allPerks';
import { MARK_SOURCE } from '../../src/engine/perkMarks';
import { PERK_MOVES } from '../../src/ruleset/perks';

/** banked perk write-ups have PK IDs but are not library perks until they get a milestone */
const BANKED = new Set(PERK_WRITEUPS.filter((d) => !d.ladder && !d.allStep && !d.linked).map((d) => d.id));
const lib = () => getLibrary() as unknown as Record<string, Record<string, { id?: string }>>;

/** a table: its library key, its prefix and its constants */
const TABLES: [string, string, Record<string, string>][] = [
  ['skills', 'SK', SK], ['classes', 'CL', CL], ['achievements', 'AC', ACH], ['services', 'SV', SV], ['gods', 'GD', GD], ['perks', 'PK', PK], ['items', 'IT', IT], ['trees', 'TR', TR], ['npcRoles', 'RO', RO], ['themes', 'TH', TH],
  ['races', 'RC', RC], ['bodyTypes', 'BT', BT], ['templates', 'TP', TP],
  ['roles', 'RL', RL], ['healing', 'HL', HL], ['durations', 'DU', DU], ['zoneKinds', 'ZK', ZK], ['attackModes', 'AM', AM], ['gearClasses', 'GC', GC],
  ['personalityAxes', 'PA', PA], ['values', 'VL', VL], ['personalityTypes', 'PY', PY], ['tensions', 'TN', TN],
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
      expect(Object.keys(rows).sort()).toEqual([...Object.values(ids)].filter((id) => !(table === 'perks' && BANKED.has(id))).sort());
    });
  }

  it('functions and groups use FN and GR', () => {
    for (const id of Object.values(FN)) expect(id).toMatch(/^FN\d+$/);
    for (const id of Object.values(GR)) expect(id).toMatch(/^GR\d+$/);
  });

  it('every blessing names a library god', () => {
    for (const p of Object.values(getLibrary().perks)) if (p.blessing) expect(getLibrary().gods?.[p.blessing.god], p.id).toBeDefined();
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
    for (const b of ALL_BUNDLES) if (b.passive) known(b.passive, `bundle ${b.name}`);
    for (const [sk, id] of Object.entries(SKILL_PARTS)) { known(id, `skill part ${sk}`); expect(L.skills[sk], `skill part ${sk}`).toBeDefined(); }
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

  it('every weapon, armor and shield has a gear class whose skill fits how it is used', () => {
    const L = getLibrary();
    for (const i of Object.values(L.items)) {
      if (!i.weapon && !i.armor && !i.shield) continue;
      const use = i.weapon ? modeSkill(i.weapon.modes[0]) : i.armor ? ARMOR_SKILL[i.armor.weight] : SK.block;
      expect(L.gearClasses?.[i.gearClass ?? '']?.skill, `${i.id} ${i.name}`).toBe(use);
    }
  });

  it('templates name real races, races real body types, and skills real trees', () => {
    const L = getLibrary();
    for (const t of Object.values(L.templates)) expect(L.races?.[t.raceId], `template ${t.id}`).toBeDefined();
    for (const r of Object.values(L.races ?? {})) expect(L.bodyTypes[r.bodyTypeId], `race ${r.id}`).toBeDefined();
    for (const s of Object.values(L.skills)) expect(L.trees[s.treeId], `skill ${s.id}`).toBeDefined();
  });
});
