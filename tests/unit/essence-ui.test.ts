// Essences on screen: the offer pop-up and the Character page section show what an essence gives as "+1 Dodge" chips,
// keep the same key for an offer from turn to turn (so the pop-up shows once), and Take it runs the real /essence take.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { wholeTurn, intent } from '../harness/turn';
import { ES } from '../../src/library/essenceIds';
import { SK } from '../../src/library/skillIds';
import { essenceStats, offerKey } from '../../src/ui/essences';
import type { EssenceOffer } from '../../src/types';

describe('essences on screen', () => {
  it('whole turn: an offer keeps its key across a turn, shows its stats, and /essence take 1 fills a slot', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    const o: EssenceOffer = { essence: ES.street_instinct, grade: 'common', points: { [SK.dodge]: 1, [SK.insight]: 1 }, turn: s.turn, source: 'foe', untilMin: 1e9 };
    s.player.progression!.essenceOffers = [o];
    const key = offerKey(o);
    await g.turn(intent(), 'I look around');
    const still = g.game.state()!.player.progression!.essenceOffers!;
    expect(still.map(offerKey)).toEqual([key]);
    expect(essenceStats(still[0])).toEqual(['+1 Dodge', '+1 Insight']);
    await g.game.submit('/essence take 1', { aimed: false });
    const pr = g.game.state()!.player.progression!;
    expect(pr.essenceOffers ?? []).toEqual([]);
    expect(pr.essences?.map((e) => e.essence)).toEqual([ES.street_instinct]);
  });

  it('essences show once on the Character page: in the Essences section, not again on the character card', () => {
    const card = readFileSync('src/ui/charsheet.ts', 'utf8');
    expect(card).not.toMatch(/Essences · \$\{held\.length\} of/);
    expect(readFileSync('src/ui/pages.ts', 'utf8')).toMatch(/essencesSection\(api, s, update\)/);
  });
});
