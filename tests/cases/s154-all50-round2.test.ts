// 154 All-50 parts round 2 (PT1, PT2, PT6): Junk Arsenal (Improvisation), Know the Step (Earshot), Last to Fall
// (the Fortitude passive).
import { describe, expect, it } from 'vitest';
import { fit, forcedRng, makeVillage, place } from '../harness';
import { ruleset } from '../../src/ruleset';
import { payFear } from '../../src/engine/morale';
import { moraleLost } from '../../src/ruleset/morale';
import { earlierLine } from '../../src/views';
import { CONFIG } from '../../src/config';
import type { Actor, GameEvent } from '../../src/types';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';
import { FR } from '../../src/library/tableIds';
import { SK } from '../../src/library/skillIds';
import { ALL_BUNDLES, SKILL_PARTS } from '../../src/library/allPerks';
import { TR } from '../../src/library/treeIds';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'mastery', gainedTurn: 0 });

describe('154 All-50 parts round 2', () => {
  it('the parts belong to their skills, and Last to Fall is the Fortitude passive', () => {
    expect(SKILL_PARTS[SK.unarmed_improvised]).toBe(PK.junk_arsenal);
    expect(SKILL_PARTS[SK.earshot]).toBe(PK.know_the_step);
    expect(ALL_BUNDLES.find((b) => b.treeId === TR.fortitude)?.passive).toBe(PK.last_to_fall);
  });

  it('Junk Arsenal: improvised hits deal ×1.2 before armor; other weapons do not', () => {
    const hit = (item: string, perk: boolean) => {
      const s = makeVillage();
      place(s, 'patron_1', s.player.zone);
      for (const i of s.player.core.inventory) delete i.equippedIn;
      s.player.core.inventory.push({ id: 'w', itemId: item, equippedIn: ['grip:right_arm'] });
      fit(s.player, item);
      if (perk) give(s.player, PK.junk_arsenal);
      return ruleset.attack({ attackerId: 'player', targetId: 'patron_1', weaponId: 'w', targetPart: null, aimed: false }, s, forcedRng([90, 6, 80, 50])).damage;
    };
    expect(hit(IT.improvised_medium, false)).toBeGreaterThan(0);
    expect(hit(IT.improvised_medium, true)).toBeCloseTo(hit(IT.improvised_medium, false) * CONFIG.JUNK_ARSENAL_MULT);
    expect(hit(IT.arming_sword, true)).toBeCloseTo(hit(IT.arming_sword, false));
  });

  it('Last to Fall: at Wounded or worse, morale losses are ×0.75', () => {
    const lost = (perk: boolean, hpLost: number) => {
      const s = makeVillage();
      const p = s.player;
      if (perk) give(p, PK.last_to_fall);
      p.core.condition.hpLostPct = hpLost;
      payFear(s, forcedRng([50, 50]), p, FR.dread_presence, { gap: 1 });
      return moraleLost(p);
    };
    const wounded = CONFIG.HEALTH_TRACK.find(([l]) => l === 'wounded')![1] as number;
    expect(lost(true, 0)).toBeCloseTo(lost(false, 0)); // unhurt: no change
    expect(lost(false, wounded + 1)).toBeGreaterThan(0);
    expect(lost(true, wounded + 1)).toBeCloseTo(lost(false, wounded + 1) * CONFIG.LAST_TO_FALL_MULT);
  });

  it('Know the Step: someone the player knows by name is named when only heard', () => {
    const s = makeVillage();
    const ev = { id: 'e1', turn: 1, kind: 'speak', actorId: 'trader', zone: 'tav_counter', effects: [], perception: { player: { level: 'partial', cue: 'sound' } },
      line: { text: 'Who goes there?', volume: 'normal' } } as unknown as GameEvent;
    expect(earlierLine(s, s.player, ev)).toMatch(/^heard something/);
    give(s.player, PK.know_the_step);
    expect(earlierLine(s, s.player, ev)).toMatch(/^heard something/); // the name isn't known yet
    s.player.journal!.namesKnown.push('trader');
    expect(earlierLine(s, s.player, ev)).toMatch(new RegExp(`^heard ${s.actors.find((a) => a.id === 'trader')!.names.current}`));
  });
});
