import { expect, it } from 'vitest';
import { makeVillage, actor, place, createRng } from '../harness';
import { fallbackOrder } from '../../src/minds';
import { buildActorView } from '../../src/views';
import { resolveTurn } from '../../src/engine';
import { SK } from '../../src/library/skillIds';

// BG-258: a code-run guard holding its arming sword struck with its fists whenever the player stood within fist reach (0.7 m),
// because its fallback order named the human body's skill (unarmed strike); the held weapon's skill comes first now
for (const gap of [0.5, 0.7, 1.2]) it(`335 BG-258 fallback blow at ${gap} m: the guard swings the sword it holds`, () => {
  const s = makeVillage({ playerZone: 'gate_inner' });
  const g = place(s, 'guard_1', 'gate_inner');
  g.mind!.overrides = { player: 'hostile' };
  g.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'gate_inner', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  g.pos = { x: s.player.pos!.x + gap, y: s.player.pos!.y };
  const sword = g.core.inventory[0].id;
  expect(fallbackOrder(buildActorView(s, 'guard_1'), createRng(1))).toMatchObject({ type: 'attack', target: 'player', skill: SK.melee_medium, source: 'fallback' });
  const events = resolveTurn(s, { intent: null, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(s.rngState));
  expect(events.find((e) => e.actorId === 'guard_1' && e.kind === 'attack')?.itemId).toBe(sword);
});

it('335 BG-258 with no weapon in hand the guard falls back to its fists', () => {
  const s = makeVillage({ playerZone: 'gate_inner' });
  const g = actor(s, 'guard_1');
  g.core.inventory = g.core.inventory.filter((i) => i.itemId !== g.core.inventory[0].itemId); // the sword gone
  expect(buildActorView(s, 'guard_1').self.attackSkill).toBe(SK.unarmed_strike);
});

