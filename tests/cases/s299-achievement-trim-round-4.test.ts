// 299 Achievement trim, round 4 answers (D-303): first rows for every chain that counts an act (TM9, TM13, TM20, TM24,
// TM29), areas entered counted per kind of area under one head (TM14), achievements earned scale past their top row
// (TM16), the first time health reaches each wound level (TM23), and nothing cut where the answers kept it (TM15, TM23).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { turnFeats } from '../../src/engine/feats';
import { achievementName, tally } from '../../src/engine/xp';
import { getLibrary } from '../../src/library';
import { ACH, ACH_HEADS } from '../../src/library/achievementIds';
import { chainLines } from '../../src/ui/pages';
import { CONFIG } from '../../src/config';
import type { GameState } from '../../src/types';

const lib = () => getLibrary().achievements!;
const counts = (rule: string, by?: string) => Object.values(lib()).filter((d) => d.rule === rule && d.by === by && !d.every).map((d) => d.count).sort((a, b) => a! - b!);
const ids = (s: GameState) => (s.player.progression!.achievements ?? []).map((a) => a.id);
const setup = () => { const s = makeVillage({ playerZone: 'tav_common' }); CONFIG.GROWTH_AT_SCENARIO_END = false; return s; };

describe('299 achievement trim, round 4', () => {
  it('the decided counts', () => {
    expect(counts('crits', 'group')).toEqual([1, 10, 50, 100]);
    expect(counts('spar_wins')).toEqual([1, 10, 25, 50]);
    expect(counts('defeated')).toEqual([1, 5, 25]);
    expect(counts('speech_won', 'skill')).toEqual([1, 10, 100, 250]);
    expect(counts('holds')).toEqual([1, 10, 100]);
    expect(counts('unseen_moves')).toEqual([1, 10, 50, 250]);
    expect(counts('vanished')).toEqual([1, 5, 25]);
    expect(counts('quests_abandoned')).toEqual([1, 5]);
    expect(counts('zones')).toEqual([1, 25, 50, 150, 300]);
    expect(counts('places', 'place_kind')).toEqual([1, 5, 10, 25, 50]);
    expect(counts('class_max')).toEqual([1, 3, 5, 10]); // TM15: nothing cut, more classes are coming
    expect(counts('class_max_tiers')).toEqual([2, 3, 4, 5, 6]);
    expect(counts('healed', 'heal_source')).toContain(10000); // TM23: kept
    expect(lib()[ACH.zones_1].level).toBe('minus_1');
    for (const id of ['AC122', 'AC135']) expect(Object.values(lib()).some((d) => d.id === id)).toBe(false); // retired
  });

  it('TM14: places are counted per kind, each place once, with the place that holds it', () => {
    const s = setup();
    turnFeats(s, []);
    expect(ids(s)).toEqual(expect.arrayContaining([ACH.zones_1, `${ACH.places_1}:place`, `${ACH.places_1}:settlement`]));
    expect(s.player.progression!.tally!['places:place_kind:settlement']).toBe(1);
    turnFeats(s, []);
    expect(s.player.progression!.tally!['places:place_kind:place']).toBe(1); // the same place again counts nothing
    const line = chainLines(s, false).find((l) => l.id === ACH_HEADS.areas)!;
    expect(line).toMatchObject({ name: 'Areas entered', tag: 'exploration', count: 3 });
  });

  it('TM23: the first time health reaches each wound level, the milder ones on the way too, once', () => {
    const s = setup();
    s.player.core.condition.hpLostPct = 40; // a few levels down
    turnFeats(s, []);
    const got = ids(s).filter((x) => x.startsWith(`${ACH.health_first}:`));
    expect(got).toContain(`${ACH.health_first}:bruised`);
    expect(got.length).toBeGreaterThan(1);
    turnFeats(s, []);
    expect(ids(s).filter((x) => x.startsWith(`${ACH.health_first}:`))).toEqual(got);
    const a = s.player.progression!.achievements!.find((x) => x.id === `${ACH.health_first}:bruised`)!;
    expect(achievementName(s, a)).toBe('First Bruise');
  });

  it('TM16: past 250 the achievements-earned chain goes on every 250, a reward level higher each time', () => {
    const s = setup();
    tally(s, 'achievements', { to: 499 });
    expect(ids(s)).not.toContain(`${ACH.total_every}:500`);
    tally(s, 'achievements', { to: 1000 });
    expect(ids(s)).toEqual(expect.arrayContaining([`${ACH.total_every}:500`, `${ACH.total_every}:750`, `${ACH.total_every}:1000`]));
  });
});
