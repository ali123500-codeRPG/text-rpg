// 269 Search redesign round 3. SE25 a: an item search learns against the stasher's stealth skill (kept on the item), or,
// when no one did the hiding, against its hidden-at tier on one table; a stash learns against the best sight skill
// watching it, and nothing when unwatched. SE17: a search aimed at someone reveals their check_passed secrets of a sight
// or hearing skill when the roll reaches the secret's minTier.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeVillage, beside } from '../harness';
import { intent, play } from './w4-kit';
import { intent as turnIntent, wholeTurn } from '../harness/turn';
import { ruleset } from '../../src/ruleset';
import { tierSkill } from '../../src/minds/state';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import type { GameState, RollResult, Tier } from '../../src/types';

/** forces every sight or stealth function roll to `tier` */
function rigRolls(tier: Tier) {
  const real = ruleset.roll;
  vi.spyOn(ruleset, 'roll').mockImplementation((req, st, rng) => {
    const { beyond: _, ...r } = real(req, st, rng);
    return req.rollKind === 'perception' || req.rollKind === 'stealth' ? ({ ...r, tier } as RollResult) : { ...r, ...(_ ? { beyond: _ } : {}) };
  });
}
const marks = (s: GameState, sk: string) => s.player.progression?.markCounts?.[sk] ?? 0;
const hideHere = (s: GameState, over: object) => {
  const z = s.zones.find((x) => x.id === s.player.zone)!;
  z.groundItems.push({ id: 'ring_1', itemId: IT.dagger, at: { ...s.player.pos! }, hiddenAt: { tier: 'critical_success' }, knownTo: [], ...over });
};
const search = (target: string | null = null) => ({ intent: intent({ action: { type: 'search', target } }) });

afterEach(() => vi.restoreAllMocks());

describe('269 search learning and secrets', () => {
  it('SE25 table: Success 50, 25 a step either way, never under 0, beyond the top counts too', () => {
    expect(tierSkill('success')).toBe(50);
    expect(tierSkill('great_success')).toBe(75);
    expect(tierSkill('critical_success')).toBe(100);
    expect(tierSkill({ tier: 'critical_success', beyond: 2 })).toBe(150);
    expect(tierSkill('near_miss')).toBe(25);
    expect(tierSkill('critical_failure')).toBe(0);
  });

  it('SE25 a: a search learns against the stasher\'s stealth skill: inside the window it marks, far above it does not', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    rigRolls('success');
    hideHere(s, { hiderSkill: 25 }); // the player's Eyesight is 25
    play(s, search());
    expect(marks(s, SK.eyesight)).toBe(1);
    const t = makeVillage({ playerZone: 'street_square' });
    hideHere(t, { hiderSkill: 200 });
    play(t, search());
    expect(marks(t, SK.eyesight)).toBe(0);
  });

  it('SE25 a: a stash keeps the stasher\'s stealth skill on the item; unwatched it learns nothing', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    s.player.core.skills[SK.sneaking] = { raw: 30, state: 'normal' };
    s.player.core.inventory.push({ id: 'purse_1', itemId: IT.dagger });
    rigRolls('success');
    play(s, { intent: intent({ action: { type: 'stash', item: 'purse_1' } }) });
    const it = s.zones.find((z) => z.id === 'street_square')!.groundItems.find((i) => i.id === 'purse_1')!;
    expect(it.hiderSkill).toBe(30);
    expect(it.knownTo).toEqual(['player']);
    expect(marks(s, SK.sneaking)).toBe(0);
  });

  it('SE17: a search aimed at someone reveals a sight secret its roll reaches, and says so in the turn', async () => {
    const g = wholeTurn({ without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    beside(s, 'patron_1', 'player', 1);
    s.hidden.secrets.push({ id: 'sec_ring', holderId: 'patron_1', fact: 'Old Wim wears the missing ring under his glove', leakTerms: ['ring'],
      revealWhen: { type: 'check_passed', skill: SK.eyesight, minTier: 'great_success', againstActorId: 'patron_1' } });
    rigRolls('success'); // short of Great Success: nothing
    let out = await g.turn(turnIntent({ action: { type: 'search', skill: null, target: 'patron_1', targetPart: null, item: null, mode: null, approach: 'quietly', stance: 'normal' } }));
    expect(g.game.state()!.player.journal!.secretsKnown).not.toContain('sec_ring');
    vi.restoreAllMocks();
    rigRolls('great_success');
    out = await g.turn(turnIntent({ action: { type: 'search', skill: null, target: 'patron_1', targetPart: null, item: null, mode: null, approach: 'quietly', stance: 'normal' } }));
    expect(g.game.state()!.player.journal!.secretsKnown).toContain('sec_ring');
    const ev = out.events.find((e) => e.kind === 'search')!;
    expect(ev.effects).toContainEqual({ kind: 'found_secret', actorId: 'patron_1', data: { by: 'player', secrets: ['sec_ring'] } });
    expect(ev.roll?.tier).toBe('great_success');
  });
});
