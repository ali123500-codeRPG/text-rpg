// 296 Achievement trim, round 3 answers (D-297): total defeats 10 / 50 / 100 / 250 (TM4, TM25), clean defenses 1 / 10 / 100 /
// 500 (TM8), aimed hits 10 / 50 / 100 (TM7), aimed hits by size 1 / 10 / 50 that ease the aim penalty for that size
// (TM26, TM27), and downing a foe or being rallied restore morale through the composure table (TM28).
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { grantAchievement } from '../../src/engine/xp';
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
const aimMod = (s: GameState, part: string) => ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: `player_${IT.arming_sword}_1`, targetPart: part, aimed: true }, s, forcedRng([50, 50]))
  .attack.modifiers.find((m) => m.type === 'aim')!.value;

describe('296 achievement trim (round 3 answers)', () => {

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
    // XR9: the aimed-hits trunk eases every size by 5% a level, on top of the by-size rows
    grantAchievement(s, ACH.aimed_10, undefined, undefined, true);
    grantAchievement(s, ACH.aimed_50, undefined, undefined, true);
    expect(achievementAimEase(s.player, part.size)).toBeCloseTo(0.3 + 0.1);
    expect(achievementAimEase(s.player, part.size === 'tiny' ? 'big' : 'tiny')).toBeCloseTo(0.1);
    expect(rewardLines(lib()[ACH.aimed_size_50])).toEqual(['30% less aim penalty on parts of that size in all (+10 from Found the {size} Mark, +10 from {size} Target, +10 here)']); // BG-256: one total with its parts
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

});
