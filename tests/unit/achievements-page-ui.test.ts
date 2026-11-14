// The Achievements page lists every earned achievement with its level groups open, and clicking one shows how it is earned
// and every level of its chain; the character card no longer repeats the list.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { wholeTurn, intent } from '../harness/turn';
import { ACH } from '../../src/library/achievementIds';
import { grantAchievement } from '../../src/engine/xp';
import { achievementChain, achievementLevels } from '../../src/ui/pages';

describe('Achievements page', () => {
  it('whole turn: an earned achievement shows how it is earned and every level of its chain, the earned one marked', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    grantAchievement(g.game.state()!, ACH.defeats_10);
    await g.turn(intent(), 'I look around');
    const s = g.game.state()!;
    expect(s.player.progression!.achievements!.some((a) => a.key === ACH.defeats_10)).toBe(true);
    expect(achievementChain(ACH.defeats_100)).toEqual([ACH.defeats_10, ACH.defeats_50, ACH.defeats_100, ACH.defeats_250]);
    const levels = achievementLevels(s, ACH.defeats_10);
    expect(levels.map((l) => [l.name, l.earnedAt, l.level, l.got])).toEqual([
      ['Blooded Fighter', '10 defeats', 'I', true],
      ['Carver of Fifty Graves', '50 defeats', 'II', false],
      ['Calamity of a Hundred Blades', '100 defeats', 'III', false],
      ['Harvester of the Fallen', '250 defeats', 'IV', false],
    ]);
  });

  it('the page opens its level groups, and the character card has no Achievements list', () => {
    expect(readFileSync('src/ui/pages.ts', 'utf8')).toMatch(/startOpen: true,\n\s+cols: \[\{ key: 'name', title: 'Name' \}, \{ key: 'state'/);
    expect(readFileSync('src/ui/charsheet.ts', 'utf8')).not.toMatch(/hs-label' }, 'Achievements'\)/);
  });
});
