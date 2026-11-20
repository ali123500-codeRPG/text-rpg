// 299 Achievement trim, round 4 answers (D-303): first rows for every chain that counts an act (TM9, TM13, TM20, TM24,
// TM29), areas entered counted per kind of area under one head (TM14), achievements earned scale past their top row
// (TM16), the first time health reaches each wound level (TM23), and nothing cut where the answers kept it (TM15, TM23).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { turnFeats } from '../../src/engine/feats';
import { achievementName, tally } from '../../src/engine/xp';
import { ACH, ACH_HEADS } from '../../src/library/achievementIds';
import { chainLines } from '../../src/ui/pages';
import { CONFIG } from '../../src/config';
import type { GameState } from '../../src/types';

const ids = (s: GameState) => (s.player.progression!.achievements ?? []).map((a) => a.id);
const setup = () => { const s = makeVillage({ playerZone: 'tav_common' }); CONFIG.GROWTH_AT_SCENARIO_END = false; return s; };

describe('299 achievement trim, round 4', () => {
  it('TM14: places are counted per kind, each place once, with the place that holds it', () => {
    const s = setup();
    turnFeats(s, []);
    expect(ids(s)).toEqual(expect.arrayContaining([ACH.zones_1, `${ACH.places_1}:place`, `${ACH.places_1}:settlement`]));
    expect(s.player.progression!.tally!['places:place_kind:settlement']).toBe(1);
    turnFeats(s, []);
    expect(s.player.progression!.tally!['places:place_kind:place']).toBe(1); // the same place again counts nothing
    const line = chainLines(s, false).find((l) => l.id === ACH_HEADS.areas)!;
    expect(line).toMatchObject({ name: 'Areas entered', tag: 'exploration', count: 4 }); // areas, places, settlements and new ground (PZ17)
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
