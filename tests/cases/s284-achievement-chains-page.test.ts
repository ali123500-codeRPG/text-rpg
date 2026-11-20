// 284 Achievement chains and branches (trim TB1–TB6) and the next level of a started chain (D-284, TB5). A branch counts
// a slice of its trunk's act and names the trunk in `branchOf`; it never switches the trunk off. The Achievements page
// shows one line per chain in tag sections, with "II of ?" (or "III of IV" once the last level is in sight) and its branches, the next row's count, and the side panel unfolds
// the earlier levels and one line per branch.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { grantAchievement } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { ACH, ACH_HEAD_NAMES } from '../../src/library/achievementIds';
import { chainHead, chainRoot } from '../../src/ruleset/achChains';
import type { GameState } from '../../src/types';

const lib = () => getLibrary().achievements!;
const give = (s: GameState, key: string, of?: string) => grantAchievement(s, key, of, undefined, true);

describe('284 achievement chains, branches and the next level', () => {
  it('TB6: every branch names a trunk root or a head, and starts its own chain', () => {
    for (const [k, d] of Object.entries(lib()).filter(([, d]) => d.branchOf)) {
      expect(d.after, k).toBeUndefined(); // only a chain's lowest row names its trunk
      expect(!!ACH_HEAD_NAMES[d.branchOf!] || (lib()[d.branchOf!] && !lib()[d.branchOf!].after && !lib()[d.branchOf!].branchOf), k).toBe(true);
    }
    expect(chainHead(ACH.defeats_100_race)).toBe(ACH.defeats_10);
    expect(chainRoot(ACH.defeats_250)).toBe(ACH.defeats_10);
  });

  it('TB2: a branch row never switches its trunk off', () => {
    const s = makeVillage();
    give(s, ACH.defeats_10);
    give(s, ACH.first_defeat_race, 'human');
    give(s, ACH.defeats_10_race, 'human');
    const mine = s.player.progression!.achievements!;
    expect(mine.find((m) => m.key === ACH.defeats_10)!.replacedBy).toBeUndefined();
    expect(mine.find((m) => m.key === ACH.first_defeat_race)!.replacedBy).toBeDefined(); // its own lower level is
  });

});

