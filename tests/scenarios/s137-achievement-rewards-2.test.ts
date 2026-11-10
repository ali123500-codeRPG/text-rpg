// 137 achievement rewards, round 2 (reward variations page T13, T15, T16, T17, T19): Master of the Moment widens
// stand-ins in its group, Adept of {tree} lowers that tree's equip requirements (only the check), Silver Tongue takes
// 5% off buying, Hold the Line steadies allies fighting beside you (a new chain), Seasoned adds 10% to each rest;
// T18 a worn title reaches only people who have seen you.
import { HL } from '../../src/library/tableIds';
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { actor } from '../harness/village';
import { grantAchievement, wearable, wornTitle } from '../../src/engine/xp';
import { buildActorView, buildNarrationView } from '../../src/views';
import { getLibrary } from '../../src/library';
import { ACH } from '../../src/library/achievementIds';
import { SK } from '../../src/library/skillIds';
import { TR } from '../../src/library/treeIds';
import { IT } from '../../src/library/itemIds';
import { SV } from '../../src/library/serviceIds';
import { groupsOf } from '../../src/library/functionNames';
import { standInTable, kitBonus, situationMods } from '../../src/ruleset/gear';
import { requirement, shortBy } from '../../src/ruleset/requirements';
import { rallyMods } from '../../src/ruleset/achRewards';
import { warePrice } from '../../src/engine/trade';
import { applyHealing } from '../../src/engine/heal';
import { besidePlayer } from '../../src/engine/engagement';
import { fightEnded } from '../../src/engine/feats';
import { actorById } from '../../src/engine/relations';
import type { Actor } from '../../src/types';

const know = (a: Actor, b: Actor) => { a.mind!.knowledge[b.id] = { status: 'aware', lastKnownZone: b.zone, source: 'seen', revealed: [] }; };
const has = (s: ReturnType<typeof makeVillage>, key: string) => !!s.player.progression?.achievements?.some((x) => x.key === key);

describe('137 achievement rewards, round 2', () => {
  it('T13 Master of the Moment: stand-ins on rolls of a skill in its group count +0.2', () => {
    const s = makeVillage();
    const before = standInTable(SK.melee_medium, s.player);
    const group = groupsOf(getLibrary().skills[SK.melee_medium])[0];
    grantAchievement(s, ACH.crits_1000, group);
    const after = standInTable(SK.melee_medium, s.player);
    after.forEach((t, i) => expect(t.k).toBeCloseTo(Math.min(1, before[i].k + 0.2)));
    expect(standInTable(SK.earshot, s.player)).toEqual(standInTable(SK.earshot)); // another group: unchanged
  });

  it('T15 Adept of {tree}: that tree\'s equip requirements ask 5 less, the gear\'s numbers stay', () => {
    const s = makeVillage();
    const def = Object.values(getLibrary().items).find((d) => {
      const r = requirement(d);
      return r && getLibrary().trees[TR.melee].skills.includes(r.skill as never) && r.need >= 20;
    })!;
    const r = requirement(def)!;
    s.player.core.skills[r.skill] = { ...s.player.core.skills[r.skill], raw: 0 };
    const before = shortBy(s.player, def);
    expect(before).toBeGreaterThan(5);
    const kit = def.effects?.map((e) => kitBonus(def, e));
    grantAchievement(s, ACH.mastery_50, TR.melee);
    expect(shortBy(s.player, def)).toBe(before - 5);
    expect(requirement(def)).toEqual(r);
    expect(def.effects?.map((e) => kitBonus(def, e))).toEqual(kit);
  });

  it('T16 Silver Tongue: 5% off what you pay traders', () => {
    const s = makeVillage({ playerZone: 'tav_counter' });
    const mags = actorById(s, 'trader')!;
    mags.wares = { items: [IT.healing_draught], services: [SV.clinic] };
    mags.core.inventory.push({ id: 'stock', itemId: IT.healing_draught, qty: 3 });
    const before = warePrice(s, s.player, mags, `service:${SV.clinic}`)!;
    grantAchievement(s, ACH.deals_100);
    expect(warePrice(s, s.player, mags, `service:${SV.clinic}`)).toBe(Math.ceil(before * 0.95));
  });

  it('T19 Seasoned: +10% healing on each rest, carried up to Old Blood', () => {
    const s = makeVillage();
    s.player.core.condition.hpLostPct = 60;
    applyHealing(s, s.player, HL.rest);
    const plain = 60 - s.player.core.condition.hpLostPct;
    s.player.core.condition.hpLostPct = 60;
    grantAchievement(s, ACH.days_30);
    applyHealing(s, s.player, HL.rest);
    expect(60 - s.player.core.condition.hpLostPct).toBe(plain + 10);
    s.player.core.condition.hpLostPct = 60;
    grantAchievement(s, ACH.days_100);
    applyHealing(s, s.player, HL.rest);
    expect(60 - s.player.core.condition.hpLostPct).toBe(plain + 10);
  });

  it('T17 Hold the Line: allies are whoever fights your foes without being hostile to you', () => {
    const s = makeVillage();
    const slime = actor(s, 'slime_1'), wim = actor(s, 'patron_1');
    s.bands.find((b) => b.id === 'tavern_folk')!.relations.slimes = 'hostile';
    slime.zone = wim.zone = s.player.zone;
    know(slime, s.player); know(slime, wim); know(wim, slime);
    expect(besidePlayer(s, wim)).toBe(true);
    expect(besidePlayer(s, slime)).toBe(false);
    expect(rallyMods(s, wim, true)).toEqual([]);
    grantAchievement(s, ACH.held_line_10);
    expect(rallyMods(s, wim, true)).toEqual([{ source: 'rally: Hold the Line', type: 'achievement', value: 10 }]);
    expect(rallyMods(s, wim, false)).toEqual([]);
  });

  it('T17 Few Against Many: a won fight beside an ally against more foes than your side counts', () => {
    const s = makeVillage();
    fightEnded(s, { hp: 0, foes: [], most: 3, helped: true });
    expect(has(s, ACH.held_line_1)).toBe(false);
    fightEnded(s, { hp: 0, foes: [], most: 3, helped: true, heldLine: true });
    expect(has(s, ACH.held_line_1)).toBe(true);
  });

  it('T18 a worn title: current non-scar achievements only, and only people who have seen you know it', () => {
    const s = makeVillage();
    const wim = actor(s, 'patron_1');
    grantAchievement(s, ACH.yielded_1);
    grantAchievement(s, ACH.yielded_10);
    expect(wearable(s).map((x) => x.key)).toEqual([ACH.yielded_10]); // Yield or Fall was replaced
    s.player.progression!.title = wearable(s)[0].id;
    expect(wornTitle(s)).toBe('Breaker of Wills');
    expect(buildNarrationView(s, []).player.title).toBe('Breaker of Wills');
    const about = () => buildActorView(s, wim.id).beliefs.find((b) => b.about === s.player.id);
    wim.mind!.knowledge[s.player.id] = { status: 'aware', source: 'heard', revealed: [] };
    expect(about()?.title).toBeUndefined(); // heard, not seen
    wim.mind!.knowledge[s.player.id] = { status: 'suspicious', source: 'seen', revealed: [] };
    expect(about()?.title).toBeUndefined(); // a glimpse is not enough
    wim.mind!.knowledge[s.player.id] = { status: 'aware', source: 'seen', revealed: [] };
    expect(about()?.title).toBe('Breaker of Wills');
    grantAchievement(s, ACH.yielded_50); // the worn level is replaced: the title moves up its chain
    expect(wornTitle(s)).toBe('The Name That Ends Fights');
  });

  it('Old Blood: +10 on situation rolls (Seasoned gives none)', () => {
    const s = makeVillage();
    const ach = () => situationMods(s, s.player).filter((m) => m.type === 'achievement');
    grantAchievement(s, ACH.days_30);
    expect(ach()).toEqual([]);
    grantAchievement(s, ACH.days_100);
    expect(ach()).toEqual([{ source: 'Old Blood', type: 'achievement', value: 10 }]);
  });
});
