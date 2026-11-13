// Dreaded on Sight (study OE3): a quirk. Whoever outside the owner's band first sees the owner pays a rolled fear, in a
// fight or out of one, and from then on reads its band's stance toward the owner one step colder, until play gives it a
// stance of its own. Once per owner, for good. The player holds no stances, so it only pays the fear.
import { describe, expect, it } from 'vitest';
import { forcedRng, makeVillage } from '../harness';
import { getLibrary } from '../../src/library';
import { BUILT_PERKS } from '../../src/library/builtPerks';
import { PK } from '../../src/library/perkIds';
import { FR } from '../../src/library/tableIds';
import { sightDread } from '../../src/engine/auras';
import { payFear } from '../../src/engine/morale';
import { stance } from '../../src/engine/relations';
import { moraleLost } from '../../src/ruleset/morale';
import type { Actor, GameState } from '../../src/types';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const run = (s: GameState) => sightDread(s, (a, id) => payFear(s, forcedRng([50]), a, id));

describe('Dreaded on Sight', () => {
  it('is a built quirk with its own fear row, attached to nothing', () => {
    const lib = getLibrary();
    expect(lib.perks![PK.dreaded_on_sight]).toMatchObject({ quirk: true, onSight: { colder: 1, fear: FR.dreaded_sight } });
    expect(BUILT_PERKS.has(PK.dreaded_on_sight)).toBe(true);
    expect(lib.fears![FR.dreaded_sight]).toMatchObject({ rolled: true, unengaged: true });
    expect(Object.values(lib.races ?? {}).some((r) => JSON.stringify(r).includes(PK.dreaded_on_sight))).toBe(false);
    expect(Object.values(lib.templates).some((t) => t.perks?.includes(PK.dreaded_on_sight))).toBe(false);
  });

  it('someone who sees the owner pays the fear once and turns one step colder', () => {
    const s = makeVillage();
    const owner = npc(s, 'patron_1'), t = npc(s, 'guard_1');
    owner.zone = t.zone = s.player.zone;
    give(owner, PK.dreaded_on_sight);
    const before = stance(s, t, owner);
    const met = run(s);
    expect(met.some((m) => m.target === t && m.owner === owner)).toBe(true);
    expect(moraleLost(t)).toBeGreaterThan(0);
    expect(stance(s, t, owner)).not.toBe(before);
    const lost = moraleLost(t);
    expect(run(s).some((m) => m.target === t)).toBe(false); // once, for good
    expect(moraleLost(t)).toBe(lost);
  });

  it('a stance of its own stands as set, and bandmates are never affected', () => {
    const s = makeVillage();
    const owner = npc(s, 'patron_1'), t = npc(s, 'guard_1');
    owner.zone = t.zone = s.player.zone;
    give(owner, PK.dreaded_on_sight);
    run(s);
    t.mind!.overrides = { ...t.mind!.overrides, [owner.id]: 'friendly' };
    expect(stance(s, t, owner)).toBe('friendly');
    const mate = s.actors.find((a) => a !== owner && a.bandId === owner.bandId);
    if (mate) expect(mate.sightChecks ?? []).toEqual([]);
  });

  it('the player only pays the fear', () => {
    const s = makeVillage();
    const owner = npc(s, 'patron_1');
    owner.zone = s.player.zone;
    give(owner, PK.dreaded_on_sight);
    const before = stance(s, s.player, owner);
    expect(run(s).some((m) => m.target === s.player)).toBe(true);
    expect(moraleLost(s.player)).toBeGreaterThan(0);
    expect(stance(s, s.player, owner)).toBe(before);
  });

  it('someone who cannot see the owner is untouched', () => {
    const s = makeVillage();
    const owner = npc(s, 'patron_1'), t = npc(s, 'guard_1');
    give(owner, PK.dreaded_on_sight);
    t.asleep = { since: 0 };
    owner.zone = t.zone;
    expect(run(s).some((m) => m.target === t)).toBe(false);
  });
});
