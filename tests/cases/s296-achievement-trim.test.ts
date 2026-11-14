// 296 Achievement trim, round 3 answers (D-297): total defeats 10 / 50 / 100 / 250 (TM4, TM25), clean defenses 1 / 10 / 100 /
// 500 (TM8), aimed hits 10 / 50 / 100 (TM7), aimed hits by size 1 / 10 / 50 that ease the aim penalty for that size
// (TM26, TM27), and downing a foe or being rallied restore morale through the composure table (TM28).
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { bannedLines } from '../harness/guard';
import { grantAchievement, tally } from '../../src/engine/xp';
import { calm } from '../../src/engine/heal';
import { getLibrary, actorBody } from '../../src/library';
import { ruleset } from '../../src/ruleset';
import { achievementAimEase, rewardLines } from '../../src/ruleset/achRewards';
import { maxMorale, moraleLost, setMoraleLost } from '../../src/ruleset/morale';
import { ACH } from '../../src/library/achievementIds';
import { CP } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import { CONFIG } from '../../src/config';
import type { GameState } from '../../src/types';

const lib = () => getLibrary().achievements!;
const counts = (rule: string, by?: string) => Object.values(lib()).filter((d) => d.rule === rule && d.by === by).map((d) => d.count).sort((a, b) => a! - b!);
const earned = (s: GameState) => (s.player.progression!.achievements ?? []).map((a) => a.id);
const aimMod = (s: GameState, part: string) => ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: part, aimed: true }, s, forcedRng([50, 50]))
  .attack.modifiers.find((m) => m.type === 'aim')!.value;

describe('296 achievement trim (round 3 answers)', () => {
  it('the decided counts', () => {
    expect(counts('defeats')).toEqual([10, 50, 100, 250]);
    expect(lib()[ACH.defeats_50].name).toBe('Carver of Fifty Graves');
    expect(Object.values(lib()).some((d) => d.id === 'AC9')).toBe(false); // retired
    expect(counts('clean_defense')).toEqual([1, 10, 100, 500]);
    expect(counts('aimed_hits')).toEqual([10, 50, 100]);
    expect(counts('aimed_hits', 'size')).toEqual([1, 10, 50]);
  });

  it('the first clean defense and the first aimed hit on a part size are achievements', () => {
    const s = makeVillage();
    CONFIG.GROWTH_AT_SCENARIO_END = false;
    tally(s, 'clean_defense');
    tally(s, 'aimed_hits', { by: 'size', of: 'small' });
    expect(earned(s)).toEqual(expect.arrayContaining([ACH.clean_1, `${ACH.aimed_size_1}:small`]));
  });

  it('each aimed-hits-by-size row eases the aim penalty for its own size, carried up the chain', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    const part = actorBody(s, s.actors.find((a) => a.id === 'patron_1')!).parts.find((p) => p.id === 'head')!;
    const base = CONFIG.AIM_PENALTY[part.size];
    expect(aimMod(s, 'head')).toBe(base);
    grantAchievement(s, ACH.aimed_size_1, part.size, undefined, true);
    expect(achievementAimEase(s.player, part.size)).toBeCloseTo(0.1);
    expect(achievementAimEase(s.player, part.size === 'tiny' ? 'big' : 'tiny')).toBe(0); // another size gets nothing
    expect(aimMod(s, 'head')).toBeCloseTo(base * 0.9);
    grantAchievement(s, ACH.aimed_size_10, part.size, undefined, true);
    grantAchievement(s, ACH.aimed_size_50, part.size, undefined, true);
    expect(aimMod(s, 'head')).toBeCloseTo(base * 0.7);
    expect(rewardLines(lib()[ACH.aimed_size_50])).toHaveLength(3);
  });

  it('downing a foe and being rallied are composure rows: flat points back, counted as calmed', () => {
    const s = makeVillage(), p = s.player;
    for (const id of [CP.foe_downed, CP.rallied]) {
      setMoraleLost(p, maxMorale(p));
      expect(calm(s, p, id)).toBeCloseTo(10, 5);
      expect(moraleLost(p)).toBeCloseTo(maxMorale(p) - 10, 5);
      expect(s.player.progression!.tally![`calmed:morale_source:${id}`]).toBeCloseTo(10, 5);
    }
  });

  it('guard: morale comes back only through the composure table, never a fear with a negative cost', () => {
    expect(Object.values(getLibrary().fears ?? {}).filter((f) => f.cost < 0)).toEqual([]);
    expect(bannedLines(/cost: -\d+, rolled:/, {}, ['src/library'])).toEqual([]);
  });
});
