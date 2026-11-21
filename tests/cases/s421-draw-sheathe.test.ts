// 421 Steel drawn or sheathed (DS1–DS7, engine/steel.ts): NPCs spawn sheathed and code draws for them when they are about to
// fight; anyone attacked takes up its steel before it defends; drawing on purpose outside a fight is an event others see, a
// deed against the one it is drawn at and an alarm to guards in a settlement; attacking draws without an event; sheathing
// before a hostile AI-run foe offers it a stand-down.
import { expect, it } from 'vitest';
import { actor, makeVillage, place } from '../harness';
import { intent, play } from './w4-kit';
import { armed } from '../../src/engine/steel';
import { stance } from '../../src/engine/relations';

const sword = (s: ReturnType<typeof makeVillage>) => s.player.core.inventory.find((i) => i.equippedIn?.some((e) => e.startsWith('grip:')))!;

it('DS1/DS4: a sword drawn at a calm patron is seen, turns them a step colder and alarms the guard who sees it', () => {
  const s = makeVillage({ sheathed: true, playerZone: 'tav_common' });
  const sw = sword(s);
  delete sw.equippedIn; // the player starts sheathed
  const g = place(s, 'guard_1', 'tav_common'), wim = actor(s, 'patron_1');
  for (const x of [g, wim]) x.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] }; // they see the player already
  expect(armed(s, g)).toBe(false); // DS2: spawned sheathed
  const before = stance(s, wim, s.player);
  const ev = play(s, { intent: intent({ action: { type: 'talk', target: 'patron_1' }, gear: [{ op: 'draw', item: sw.id }] }) });
  const drew = ev.find((e) => e.kind === 'draw_weapon');
  expect(drew).toMatchObject({ actorId: 'player', target: 'patron_1', itemId: sw.itemId });
  expect(drew!.perception.patron_1?.level).toBe('full');
  expect(stance(s, wim, s.player)).not.toBe(before);
  expect(g.mind!.alarm?.armed).toBe(true);
  const next = play(s); // alarmed, it draws its own at the next turn's start, and that is seen
  expect(armed(s, g)).toBe(true);
  expect(next.find((e) => e.kind === 'draw_weapon' && e.actorId === 'guard_1')).toBeTruthy();
});

it('DS1/DS7: an attack draws at no cost and with no event; the one attacked draws before it defends', () => {
  const s = makeVillage({ sheathed: true, playerZone: 'tav_common' });
  delete sword(s).equippedIn;
  const g = place(s, 'guard_1', 'tav_common');
  g.pos = { x: s.player.pos!.x + 0.8, y: s.player.pos!.y };
  const ev = play(s, { intent: intent({ action: { type: 'attack', target: 'guard_1' } }) });
  expect(ev.some((e) => e.kind === 'draw_weapon')).toBe(false);
  const blow = ev.find((e) => e.kind === 'attack' && e.actorId === 'player');
  expect(blow?.attack?.defenseType).not.toBe('dodge'); // its sword and shield came out before it defended
  expect(armed(s, s.player) && armed(s, g)).toBe(true);
});

it('DS2: a calm NPC puts away what code drew for it, and that is seen', () => {
  const s = makeVillage({ playerZone: 'tav_common' }); // the fixture's NPCs stand drawn, not by choice
  place(s, 'guard_1', 'tav_common');
  const ev = play(s);
  expect(ev.find((e) => e.kind === 'sheathe_weapon' && e.actorId === 'guard_1')).toBeTruthy();
  expect(armed(s, actor(s, 'guard_1'))).toBe(false);
});

it('DS5: sheathing before a hostile AI-run foe offers it a stand-down', () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  const g = place(s, 'guard_1', 'tav_common');
  g.mind!.overrides = { player: 'hostile' };
  g.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'tav_common', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  g.pos = { x: s.player.pos!.x + 6, y: s.player.pos!.y };
  expect(g.mind!.control).toBe('agent');
  play(s, { intent: intent({ action: { type: 'talk', target: 'guard_1' }, gear: [{ op: 'stow', item: sword(s).id }] }) });
  expect(s.offers?.pending).toContainEqual(expect.objectContaining({ from: 'player', to: 'guard_1', sheathed: true }));
});
