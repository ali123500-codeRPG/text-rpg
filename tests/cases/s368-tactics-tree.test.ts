// 368 Tactics tree (D-17, TC1-TC43): a new tree of four skills, Battle Sense, Command, Fieldcraft and Stratagem, in
// its own Tactics group and function; Guile joins Trickery. Unintelligent races can't learn the tree, and only
// intelligent ones can learn Command. Battle Sense is also a Reaction skill.
import { describe, expect, it } from 'vitest';
import { createPlayer, recommendedBuild, spawnNpc } from '../../src/library/spawn';
import { skillOpen, treeOpen } from '../../src/ruleset/access';
import { SK } from '../../src/library/skillIds';
import { TR } from '../../src/library/treeIds';
import { TP } from '../../src/library/templateIds';

const opts = { id: 'n1', zone: 'z', placeId: 'p', bandId: 'b' };

describe('368 Tactics tree', () => {

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
