// D-21 c: naming something by its real position. Seen: the act goes ahead, closing in first when out of reach. Not seen: the
// Parser's search looks around and finds it only if it is there and the search wins, for use next turn. Own pack: what isn't
// carried just says so, at no time. A person not in view is asked about, with the same words whether someone hides there or
// no one does, so a Parser slip gives nothing away.
import { describe, expect, it } from 'vitest';
import { actor, lay, place } from '../harness';
import { intent, setupGame, wholeTurn } from '../harness/turn';
import { IT } from '../../src/library/itemIds';
import type { Intent } from '../../src/types';

const act = (over: Partial<NonNullable<Intent['action']>>): Intent['action'] =>
  ({ type: 'search', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', ...over });
const opts = { playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'patron_1'] };

describe('411 naming what is or is not there (D-21 c)', () => {
  it('seen: a coin 3 m off is picked up, the move closing in first', async () => {
    const g = wholeTurn(opts);
    const p = g.state.player.pos!;
    lay(g.state, 'tav_common', { id: 'coin_seen', itemId: IT.coin, qty: 1 }, { x: p.x + 3, y: p.y });
    const { events } = await g.turn(intent({ action: null, gear: [{ op: 'pick_up', item: 'coin_seen' }] }), 'take the coin');
    expect(events.some((e) => e.actorId === 'player' && e.kind === 'move')).toBe(true);
    expect(g.state.player.core.inventory.some((i) => i.id === 'coin_seen')).toBe(true);
  });

  it('not seen: the act is a search that finds it when it is there, and it is used next turn', async () => {
    const g = wholeTurn(opts);
    lay(g.state, 'tav_common', { id: 'ring_hid', itemId: IT.dagger, hiddenAt: { tier: 'critical_failure' }, knownTo: [] }, g.state.player.pos);
    // the Parser names the sought thing in item: code drops it rather than asking which item
    const { events } = await g.turn(intent({ action: act({ item: 'the ring' }) }), 'take the ring behind the crate');
    const search = events.find((e) => e.actorId === 'player' && e.kind === 'search')!;
    expect(search.effects.find((f) => f.kind === 'found_items')?.data).toMatchObject({ items: ['ring_hid'] });
    await g.turn(intent({ action: null, gear: [{ op: 'pick_up', item: 'ring_hid' }] }), 'take the ring');
    expect(g.state.player.core.inventory.some((i) => i.id === 'ring_hid')).toBe(true);
  });

  it('absent: the search finds nothing and shows no dice for it', async () => {
    const g = wholeTurn(opts);
    const { events } = await g.turn(intent({ action: act({}) }), 'take the ring behind the crate');
    const search = events.find((e) => e.actorId === 'player' && e.kind === 'search')!;
    expect(search.effects.some((f) => f.kind === 'found_items')).toBe(false);
    expect(search.contest).toBeUndefined();
  });

  it('own pack: drinking a potion not carried just says there is none, at no time', async () => {
    const g = wholeTurn(opts);
    const { events } = await g.turn(intent({ action: act({ type: 'use_item', skill: '' }) }), 'drink my potion');
    expect(events.find((e) => e.actorId === 'player' && e.kind === 'wasted')?.reason).toBe('no_item');
    expect(events.some((e) => e.kind === 'use_item')).toBe(false);
  });

  it('a person not in view is asked about, in the same words whether someone hides there or no one exists', async () => {
    const ask = async (target: string) => {
      const g = setupGame({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'patron_1'] });
      place(g.state, 'guard_1', 'street_square');
      actor(g.state, 'guard_1').posture = 'stealthy';
      g.start();
      const t = g.game.state()!.turn;
      g.claude.push('parser', intent({ action: act({ type: 'attack', target }) }));
      await g.game.submit('attack the guard', { aimed: false });
      await g.game.settle();
      expect(g.game.state()!.turn).toBe(t);
      const last = g.game.lines().at(-1)!;
      expect(last.kind).toBe('clarify');
      return last.text;
    };
    const hidden = await ask('guard_1');
    expect(hidden).toMatch(/^Who do you mean\?/);
    expect(await ask('guard_77')).toBe(hidden);
  });
});
