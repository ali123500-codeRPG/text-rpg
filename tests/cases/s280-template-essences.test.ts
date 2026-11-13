// 280 Template essences (EN1–EN7): every NPC template carries its own essence list, worked out in code from its race and
// the sheet its copies spawn with: a row is on it when the template's weighted average in the row's skills reaches
// ESSENCE_FIT_SHARE of its best skill. Deed and echo rows never are; an echo carries only its own essence (hand-set).
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { spawnNpc } from '../../src/library/spawn';
import { getLibrary } from '../../src/library';
import { TP } from '../../src/library/templateIds';
import { ES } from '../../src/library/essenceIds';
import { SK } from '../../src/library/skillIds';
import { essenceFit, fittingEssences, offersFromDefeats, templateEssences } from '../../src/engine/essence';
import { CONFIG } from '../../src/config';
import type { Rng } from '../../src/types';

const ids = (t: string) => templateEssences(getLibrary().templates[t]).map((x) => x.row.id);

describe('template essences', () => {
  it('EN1, EN5, EN6: each of the five templates carries the rows its stats fit', () => {
    makeVillage();
    expect(ids(TP.slime)).toEqual([ES.gel_patience]);
    expect(ids(TP.guard)).toEqual([ES.gate_habit]); // a shield and Block
    expect(ids(TP.trader)).toEqual([ES.haggler_ear]);
    expect(ids(TP.thief)).toEqual([ES.street_instinct]);
    expect(ids(TP.patron)).toEqual([ES.tavern_brawler]);
    for (const t of Object.values(getLibrary().templates)) for (const x of templateEssences(t)) expect(x.fit ?? 1).toBeGreaterThanOrEqual(CONFIG.ESSENCE_FIT_SHARE);
  });

  it('EN1 a: the fit is a share of the best skill, so it is the same at every scale', () => {
    makeVillage();
    const row = getLibrary().essences![ES.haggler_ear]; // barter 2, earshot 1
    for (const top of [50, 75, 100, 150, 200, 300]) {
      const v = (id: string) => (id === row.skills[1].skill ? 0.6 * top : 0); // a soldier: Earshot at 0.6 of its best, no Barter
      expect(essenceFit(row, v, top)).toBeCloseTo(0.2);
    }
  });

  it('EN2 a: race is a hard filter; deed rows never go on a list', () => {
    makeVillage();
    const lib = getLibrary();
    const human = lib.templates[TP.trader];
    const slimeLike = { [SK.unarmed_natural]: { raw: 50, state: 'normal' as const }, [SK.tremor]: { raw: 50, state: 'normal' as const } };
    expect(fittingEssences(human.raceId, slimeLike).map((x) => x.row.id)).not.toContain(ES.gel_patience);
    for (const t of Object.values(lib.templates)) expect(ids(t.id)).not.toContain(ES.hard_won_habit);
  });

  it('EN3 b: every echo (unique template) carries exactly its own essence, an echo row', () => {
    makeVillage();
    const lib = getLibrary();
    for (const t of Object.values(lib.templates).filter((x) => x.generation === 'unique')) {
      expect(t.essences, t.id).toHaveLength(1);
      expect(lib.essences![t.essences![0]].from.echo, t.id).toBe(true);
    }
    for (const t of Object.values(lib.templates)) for (const id of ids(t.id)) if (lib.essences![id].from.echo) expect(t.essences).toContain(id);
  });

  it('EN4: a beaten notable foe rolls on its own template\'s list', () => {
    const s = makeVillage();
    const thief = spawnNpc(s, TP.thief, { id: 'thief_x', zone: s.player.zone, placeId: s.player.placeId, bandId: 'tavern_folk' });
    s.actors.push(thief);
    const t = getLibrary().templates[thief.core.templateId!];
    getLibrary().templates[t.id] = { ...t, notable: true };
    let i = 0; const dice: Rng = { state: 1, next: () => 0, int: (lo) => lo, d100: () => [1, 100][Math.min(i++, 1)] }; // appears on 1, quality 100
    offersFromDefeats(s, [thief], dice);
    getLibrary().templates[t.id] = t;
    expect(s.player.progression!.essenceOffers?.map((o) => o.essence)).toEqual([ES.street_instinct]);
  });
});
