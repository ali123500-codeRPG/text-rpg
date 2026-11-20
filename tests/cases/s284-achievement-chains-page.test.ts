// 284 Achievement chains and branches (trim TB1–TB6) and the next level of a started chain (D-284, TB5). A branch counts
// a slice of its trunk's act and names the trunk in `branchOf`; it never switches the trunk off. The Achievements page
// shows one line per chain in tag sections, with "II of ?" (or "III of IV" once the last level is in sight) and its branches, the next row's count, and the side panel unfolds
// the earlier levels and one line per branch.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { grantAchievement, tally } from '../../src/engine/xp';
import { FN } from '../../src/library/functionIds';
import { getLibrary } from '../../src/library';
import { ACH, ACH_HEADS, ACH_HEAD_NAMES } from '../../src/library/achievementIds';
import { chainHead, chainRoot } from '../../src/ruleset/achChains';
import { chainDetail, chainLines } from '../../src/ui/pages';
import { chainViews } from '../../src/ui/achievementThreads';
import type { GameState } from '../../src/types';

const lib = () => getLibrary().achievements!;
const give = (s: GameState, key: string, of?: string) => grantAchievement(s, key, of, undefined, true);
const line = (s: GameState, id: string) => chainLines(s, false).find((l) => l.id === id);

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

  it('TB4/TB5: one line per chain, with its place and branches, the next count; the panel unfolds the branches', () => {
    const s = makeVillage();
    give(s, ACH.defeats_10);
    give(s, ACH.defeats_50);
    give(s, ACH.first_defeat_race, 'human');
    give(s, ACH.first_defeat_body_type, 'humanoid');
    give(s, ACH.defeats_10_body_type, 'humanoid');
    const l = line(s, ACH.defeats_10)!;
    expect(l).toMatchObject({ tag: 'combat', name: 'Carver of Fifty Graves', level: 'II of ? · 2 branches', next: '100 defeats', count: 5 });
    expect(chainLines(s, false)).toHaveLength(1); // the branches fold into their trunk
    const panel = chainDetail(s, ACH.defeats_10, false);
    expect(panel.find((r) => r.k === 'Earlier')?.v).toContain('Blooded Fighter');
    expect(panel.filter((r) => String(r.k).startsWith('Branch'))).toHaveLength(2); // by race, by body type
    expect(String(panel.find((r) => r.k === 'Branch · by body type')!.v)).toContain('II of III');
  });

  it('TB5: unstarted chains stay hidden, a finished chain says so', () => {
    const s = makeVillage();
    expect(chainLines(s, false)).toEqual([]);
    for (const k of [ACH.defeats_10, ACH.defeats_50, ACH.defeats_100, ACH.defeats_250]) give(s, k);
    expect(line(s, ACH.defeats_10)).toMatchObject({ level: 'IV of IV', next: 'every level held' });
    expect(chainLines(s, false).some((x) => x.id.startsWith(ACH.clean_1))).toBe(false);
  });

  it('a by-kind chain with no trunk stands on its own line per kind; a bare head gathers its sources', () => {
    const s = makeVillage();
    give(s, ACH.crits_10, 'swords');
    give(s, ACH.crits_10, 'stealth');
    expect(chainLines(s, false).filter((x) => x.id.startsWith(`${ACH.crits_1}:`))).toHaveLength(2);
    give(s, ACH.healed_rest_100, 'rest_src');
    give(s, ACH.healed_natural_50, 'natural_src');
    expect(line(s, ACH_HEADS.healed)).toMatchObject({ tag: 'survival', name: 'Healed, by source', level: '2 branches' });
  });

  it('scars use the same shape on their own tab', () => {
    const s = makeVillage();
    give(s, ACH.defeated_1);
    give(s, ACH.defeated_5);
    expect(chainLines(s, false)).toEqual([]);
    expect(chainLines(s, true)[0]).toMatchObject({ id: ACH.defeated_1, name: 'Loser' });
    expect(chainLines(s, true)[0].next).toMatch(/^25 fights lost/);
  });

  it('a place shows its last level only once that level is in sight (held or next); before that it reads "of ?"', () => {
    const s = makeVillage();
    give(s, ACH.defeats_10);
    expect(chainViews(s, false).find((x) => x.id === ACH.defeats_10)!.place).toBe('I of ?'); // next is 50; 100 and 250 hidden
    give(s, ACH.defeats_50);
    give(s, ACH.defeats_100);
    expect(chainViews(s, false).find((x) => x.id === ACH.defeats_10)!.place).toBe('III of IV'); // 250 is next: the end is in sight
  });

  it('a chain started only through a branch shows its trunk bare, its first count next', () => {
    const s = makeVillage();
    tally(s, 'spotted');
    tally(s, 'spotted', { by: 'function', of: FN.sight });
    const v = chainViews(s, false).find((x) => x.id === ACH.spotted_10)!;
    expect(v.trunk!.knots[0]).toMatchObject({ state: 'next', label: '10' });
    expect(v.trunk).toMatchObject({ have: 1, need: 10 });
    expect(v.place).toBe('');
  });
});

