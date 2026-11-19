// 368 Tactics tree (D-17, TC1-TC43): a new tree of four skills, Battle Sense, Command, Fieldcraft and Stratagem, in
// its own Tactics group and function; Guile joins Trickery. Unintelligent races can't learn the tree, and only
// intelligent ones can learn Command. Battle Sense is also a Reaction skill.
import { describe, expect, it } from 'vitest';
import { getLibrary } from '../../src/library';
import { createPlayer, recommendedBuild, spawnNpc } from '../../src/library/spawn';
import { skillOpen, treeOpen } from '../../src/ruleset/access';
import { groupsOf } from '../../src/library/functionNames';
import { CONFIG } from '../../src/config';
import { FN, GR } from '../../src/library/functionIds';
import { SK } from '../../src/library/skillIds';
import { TR } from '../../src/library/treeIds';
import { TP } from '../../src/library/templateIds';

const opts = { id: 'n1', zone: 'z', placeId: 'p', bandId: 'b' };

describe('368 Tactics tree', () => {
  it('holds the four Tactics skills, and Guile sits in Trickery', () => {
    const lib = getLibrary();
    expect(lib.trees[TR.tactics].skills).toEqual([SK.battle_sense, SK.command, SK.fieldcraft, SK.stratagem]);
    expect(lib.trees[TR.trickery].skills).toContain(SK.guile);
  });

  it('every Tactics skill counts in the Tactics group, at half XP; Battle Sense is also Reaction', () => {
    const lib = getLibrary();
    for (const id of lib.trees[TR.tactics].skills) expect(groupsOf(lib.skills[id])[0], id).toBe(GR.tactics);
    expect(lib.skills[SK.battle_sense].functions).toEqual([FN.tactics, FN.initiative]);
    expect(CONFIG.XP_GROUP_FACTOR[GR.tactics]).toBe('half');
  });

  it('a human gets the tree and Command; a wolf the tree but not Command; a slime neither', () => {
    const p = createPlayer(recommendedBuild(), 's1');
    expect(treeOpen(p, TR.tactics)).toBe(true);
    expect(skillOpen(p, SK.command)).toBe(true);
    const wolf = spawnNpc(null, TP.wolf, opts);
    expect(treeOpen(wolf, TR.tactics)).toBe(true);
    expect(skillOpen(wolf, SK.battle_sense)).toBe(true);
    expect(skillOpen(wolf, SK.command)).toBe(false);
    const slime = spawnNpc(null, TP.slime, opts);
    expect(treeOpen(slime, TR.tactics)).toBe(false);
  });
});
