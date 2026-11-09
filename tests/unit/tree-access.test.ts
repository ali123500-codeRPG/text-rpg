// Skill tree access (TA1–TA11): per-tree Must / Either of / Blocked by rules, a block always wins, a
// closed tree's skills count as 0 and can't be raised, and NPCs follow the same rules.
import { afterEach, describe, expect, it } from 'vitest';
import { createRng, makeVillage } from '../harness';
import { getLibrary, resetLibrary, setLibrary } from '../../src/library';
import { prototypeLibrary } from '../../src/library/data';
import { createPlayer, recommendedBuild, spawnNpc } from '../../src/library/spawn';
import { skillBlock, skillOpen, treeBlock, treeOpen } from '../../src/ruleset/access';
import { trueSkill } from '../../src/ruleset/perks';
import { markIfClose } from '../../src/ruleset/improve';
import type { Actor } from '../../src/types';

afterEach(() => resetLibrary());
const opts = { id: 'n1', zone: 'z', placeId: 'p', bandId: 'b' };
const open = (a: Actor) => Object.keys(getLibrary().trees).filter((t) => treeOpen(a, t)).sort();

describe('skill tree access', () => {
  it('every rule names a real source, and every skill sits in exactly one tree', () => {
    const lib = getLibrary();
    const raceTags = Object.fromEntries(Object.values(lib.races ?? {}).flatMap((r) => r.tags ?? []).map((t) => [t, true]));
    for (const t of [...Object.values(lib.trees), ...Object.values(lib.skills)]) for (const c of [...t.access?.must ?? [], ...t.access?.either ?? [], ...t.access?.blockedBy ?? []]) {
      const table: Record<string, unknown> = { race: lib.races ?? {}, raceTag: raceTags, body: lib.bodyTypes, class: lib.classes, perk: lib.perks }[c.kind];
      expect(table[c.id], `${t.id}: ${c.kind} ${c.id}`).toBeDefined();
    }
    const placed = Object.values(lib.trees).flatMap((t) => t.skills);
    expect(placed.sort()).toEqual(Object.keys(lib.skills).sort());
  });

  it('a new swordsman gets every general tree and Swordsman; a slime gets its own trees only', () => {
    const p = createPlayer(recommendedBuild(), 's1');
    expect(open(p)).toEqual(['armor', 'defense', 'melee', 'perception', 'ranged', 'speech', 'stealth', 'swordsman', 'tools', 'unarmed']);
    expect(treeBlock(p, 'natural')).toBe('Needs one of: Amorphous, Dragon');
    const slime = spawnNpc(null, 'slime', opts);
    expect(open(slime)).toEqual(['defense', 'natural', 'slime_senses', 'stealth']);
    expect(treeBlock(slime, 'perception')).toBe('Blocked by: Amorphous');
    expect(treeBlock(slime, 'armor')).toBe('Blocked by: Amorphous'); // AR6
  });

  it('SR1: intimidation is open to any race with Speech; persuasion and barter need a speaking race', () => {
    const p = createPlayer(recommendedBuild(), 's1');
    expect(['persuasion', 'intimidation', 'barter'].filter((k) => skillOpen(p, k))).toEqual(['persuasion', 'intimidation', 'barter']);
    const dragon = { ...p, core: { ...p.core, raceId: 'dragon', bodyTypeId: 'winged_quadruped' } };
    expect(['persuasion', 'intimidation', 'barter'].filter((k) => skillOpen(dragon, k))).toEqual(['intimidation']);
    expect(skillBlock(dragon, 'barter')).toBe('Needs: Speaks');
  });

  it('a block beats an opening (TA2), and a class counts only while Current or Previous at its level (TA3)', () => {
    const lib = prototypeLibrary();
    lib.trees.swordsman.access = { must: [{ kind: 'class', id: 'swordsman' }], either: [{ kind: 'race', id: 'human' }, { kind: 'race', id: 'elf' }], blockedBy: [{ kind: 'perk', id: 'leg_bolt' }] };
    setLibrary(lib);
    const p = createPlayer(recommendedBuild(), 's1');
    expect(treeOpen(p, 'swordsman')).toBe(true);
    p.core.perks.push({ perkId: 'leg_bolt', source: 'level', gainedTurn: 0 });
    expect(treeBlock(p, 'swordsman')).toBe(`Blocked by: ${lib.perks.leg_bolt.name}`);
    p.core.perks.pop();
    p.core.classes[0].state = 'unlocked';
    expect(treeBlock(p, 'swordsman')).toBe('Needs: Swordsman');
    p.core.classes[0].state = 'previous';
    expect(treeOpen(p, 'swordsman')).toBe(true);
    lib.trees.swordsman.access.must = [{ kind: 'class', id: 'swordsman', level: 10 }];
    expect(treeBlock(p, 'swordsman')).toBe('Needs: Swordsman 10');
  });

  it('a closed tree counts as 0 and is not raised, and its points come back with access (TA4 a)', () => {
    const s = makeVillage();
    const p = s.player;
    p.core.skills.feint = { raw: 30, state: 'normal' };
    expect(trueSkill(p, 'feint')).toBe(30);
    p.core.classes[0].state = 'unlocked';
    expect(skillOpen(p, 'feint')).toBe(false);
    expect(trueSkill(p, 'feint')).toBe(0);
    markIfClose(s, p, 'feint', 30);
    expect(p.progression!.marks).not.toContain('feint');
    p.core.classes[0].state = 'current';
    expect(trueSkill(p, 'feint')).toBe(30);
  });

  it('every NPC template only has skills its body, race and class can use (TA9)', () => {
    for (const id of Object.keys(getLibrary().templates)) {
      const a = spawnNpc(null, id, opts, createRng(1));
      for (const [k, e] of Object.entries(a.core.skills)) if (e.raw > 0) expect(skillOpen(a, k), `${id}: ${k}`).toBe(true);
    }
  });
});
