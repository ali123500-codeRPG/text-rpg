// BG-183: going behind a counter to act on someone goes behind it; from the near side, the walk ends at the counter so
// they are reached over it. An NPC never claims an item it doesn't carry, nor a key for a way without a lock. The Weaver's
// personality picks count whether given by id or by name.
import { expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { intent, play } from './w4-kit';
import { EK, PY, VL } from '../../src/library/tableIds';
import { personalityFrom } from '../../src/ruleset/personality';
import { PLANNER_INSTRUCTIONS, RESPONDER_INSTRUCTIONS, VOICE_INSTRUCTIONS } from '../../src/agents/prompts';

const tavern = (traderY: number) => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1'] });
  const z = (id: string) => s.zones.find((x) => x.id === id)!;
  z('tav_common').rect = { x: 0, y: 0, w: 8, d: 8 }; z('tav_common').edges = { n: EK.low, e: EK.wall, s: EK.wall, w: EK.wall };
  z('tav_counter').rect = { x: 0, y: 5.5, w: 3, d: 3 }; z('tav_counter').edges = { n: EK.wall, e: EK.wall, s: EK.low, w: EK.wall };
  const t = actor(s, 'trader'); t.zone = 'tav_counter'; t.pos = { x: 0, y: traderY }; // the counter's edge is at y 4
  s.player.pos = { x: 0, y: -2 };
  s.player.core.inventory.push({ id: 'coin_x', itemId: s.player.core.inventory[0]?.itemId, qty: 1 } as never);
  return s;
};
const act = (type: string, behind: boolean) => intent({ action: { type, target: 'trader', item: type === 'give' ? 'coin_x' : null } as never,
  move: { toZone: 'tav_counter', ...(behind ? { behind: true } : {}), spot: { near: 'trader' } } as never });
const outOfReach = (ev: ReturnType<typeof play>) => ev.some((e) => e.actorId === 'player' && e.kind === 'wasted' && e.reason === 'out_of_reach');

it('BG-183: a filch behind the counter walks behind it to them, never reaches over from the near side', () => {
  const s = tavern(6);
  const ev = play(s, { intent: act('filch', true) });
  expect(s.player.zone).toBe('tav_counter');
  expect(outOfReach(ev)).toBe(false);
});

it('BG-183: handing something over the counter from the near side walks up to the counter, not a step short of it', () => {
  const s = tavern(4.6);
  const ev = play(s, { intent: act('give', false) });
  expect(s.player.zone).toBe('tav_common');
  expect(outOfReach(ev)).toBe(false);
  expect(actor(s, 'trader').core.inventory.some((i) => i.id === 'coin_x')).toBe(true);
});

it('BG-183: an NPC speaks of an item as its own only if it carries it, and of a key only for a lock', () => {
  for (const p of [PLANNER_INSTRUCTIONS, RESPONDER_INSTRUCTIONS, VOICE_INSTRUCTIONS]) expect(p).toContain('only if self.gear lists it');
  for (const p of [PLANNER_INSTRUCTIONS, RESPONDER_INSTRUCTIONS]) expect(p).toContain('it needs a key\n   only if it has a lock');
});

it('BG-183: personality types and values from the Weaver count by id or by name', () => {
  const base = { nerve: 0, traits: {}, values: [VL.wealth] };
  expect(personalityFrom(base, { types: ['Mature'], values: ['kindness', 'Family'] })).toMatchObject({ values: [VL.kindness, VL.family] });
  expect(personalityFrom(base, { types: [PY.mature] }).traits).toEqual(personalityFrom(base, { types: ['mature'] }).traits);
  expect(personalityFrom(base, { values: ['nonsense'] }).values).toEqual([VL.wealth]);
});
