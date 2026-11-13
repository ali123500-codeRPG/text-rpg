// 222 Search redesign, items part (SE8, SE9, SE11). A ground item can lie hidden at an outcome tier: a search's sight
// roll must beat it to find it, the same tier only hints. Stashing an item is a stealth roll whose tier becomes its
// hidden-at tier. Searching a person hands-on finds all their gear; looking someone over is a sight roll against each
// concealed item they wear.
import { TP } from '../../src/library/templateIds';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeVillage, beside } from '../harness';
import { intent, play } from './w4-kit';
import { ruleset } from '../../src/ruleset';
import { spawnNpc } from '../../src/library/spawn';
import { buildPlayerView } from '../../src/views';
import { IT } from '../../src/library/itemIds';
import type { GameState, RollResult, Tier } from '../../src/types';

/** forces every sight or stealth function roll to `tier` */
function rigRolls(tier: Tier) {
  const real = ruleset.roll;
  vi.spyOn(ruleset, 'roll').mockImplementation((req, st, rng) => {
    const { beyond: _, ...r } = real(req, st, rng);
    return req.rollKind === 'perception' || req.rollKind === 'stealth' ? ({ ...r, tier } as RollResult) : { ...r, ...(_ ? { beyond: _ } : {}) };
  });
}
const hide = (s: GameState, tier: Tier) => {
  const z = s.zones.find((x) => x.id === s.player.zone)!;
  const it = { id: 'ring_1', itemId: IT.dagger, at: { ...s.player.pos! }, hiddenAt: { tier }, knownTo: [] as string[] };
  z.groundItems.push(it);
  return it;
};
const ground = (s: GameState) => buildPlayerView(s).zone.groundItems.map((i) => i.id);
const search = (target: string | null = null) => ({ intent: intent({ action: { type: 'search', target } }) });

afterEach(() => vi.restoreAllMocks());

describe('222 hidden items', () => {
  it('SE8: a hidden item is out of view until a search beats its tier', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    const it = hide(s, 'success');
    expect(ground(s)).not.toContain('ring_1');
    rigRolls('success');
    let ev = play(s, search()).find((e) => e.kind === 'search')!;
    expect(ev.effects).toContainEqual({ kind: 'disturbed', actorId: 'player', data: {} }); // a tie only hints
    expect(ev.roll).toBeUndefined(); // SE6: no dice without a find
    expect(ground(s)).not.toContain('ring_1');
    vi.restoreAllMocks();
    rigRolls('great_success');
    ev = play(s, search()).find((e) => e.kind === 'search')!;
    expect(it.knownTo).toContain('player');
    expect(ground(s)).toContain('ring_1');
    expect(ev.effects.some((f) => f.kind === 'found_items')).toBe(true);
  });

  it('SE9: stashing an item hides it where you stand at the stealth roll\'s tier; you still know it', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    s.player.core.inventory.push({ id: 'purse_1', itemId: IT.dagger });
    rigRolls('great_success');
    play(s, { intent: intent({ action: { type: 'stash', item: 'purse_1' } }) });
    const z = s.zones.find((x) => x.id === 'street_square')!;
    const it = z.groundItems.find((i) => i.id === 'purse_1')!;
    expect(it.hiddenAt).toEqual({ tier: 'great_success' });
    expect(it.knownTo?.[0]).toBe('player');
    expect(s.player.core.inventory.some((i) => i.id === 'purse_1')).toBe(false);
    expect(ground(s)).toContain('purse_1');
  });

  it('SE11: a look over someone spots a concealed blade only by beating its tier; hands-on finds everything', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    const t = spawnNpc(null, TP.thief, { id: 'thief_1', zone: 'street_square', placeId: 'street', bandId: 'thieves', name: 'Tam', storyId: 'test' });
    s.actors.push(t);
    beside(s, 'thief_1', 'player', 0.5);
    t.core.inventory.push({ id: 'blade_1', itemId: IT.hidden_blade, equippedIn: ['grip:off'] }, { id: 'stow_1', itemId: IT.dagger });
    const gear = () => buildPlayerView(s).actors.find((a) => a.id === 'thief_1')?.gear?.map((g) => g.id) ?? [];
    rigRolls('great_success'); // the blade hides at Great Success: a tie finds nothing
    play(s, search('thief_1'));
    expect(gear()).not.toContain('blade_1');
    vi.restoreAllMocks();
    t.mind!.moraleState = 'surrendered';
    play(s, search('thief_1'));
    expect(gear()).toEqual(expect.arrayContaining(['blade_1', 'stow_1']));
  });
});
