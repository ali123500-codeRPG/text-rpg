// 383 B3 Ready the shield (Battle Sense 50): shot at, with no shield in hand, a code-run NPC draws a shield it carries
// stowed into a free hand, beside whatever its fight list chose, so it can block the missiles.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { buildActorView } from '../../src/views';
import { withTactics } from '../../src/views/tactics';
import { fallbackOrder } from '../../src/minds';
import { canBlock } from '../../src/ruleset/gear';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import type { Actor, GameEvent, GameState } from '../../src/types';

const skill = (a: Actor, id: string, raw: number) => { a.core.skills[id] = { raw, state: 'normal' }; };
/** the guard fights the player, who holds a shortbow in the field; the guard carries a round shield stowed */
function shotGuard() {
  const s = makeVillage();
  const g = s.actors.find((a) => a.id === 'guard_1')!;
  g.pos = { x: 31, y: -14 };
  place(s, 'player', 'field_edge');
  s.player.pos = { x: 70, y: -14 };
  for (const i of s.player.core.inventory) delete i.equippedIn;
  s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
  g.mind!.overrides = { player: 'hostile' };
  g.mind!.control = 'code';
  g.mind!.knowledge.player = { status: 'engaged', source: 'seen', revealed: [], lastKnownZone: s.player.zone, lastSeenTurn: s.turn };
  for (const k of [SK.battle_sense, SK.command, SK.fieldcraft, SK.stratagem]) skill(g, k, 0);
  skill(g, SK.battle_sense, 50);
  const shield = g.core.inventory.find((i) => i.itemId === IT.round_shield)!;
  delete shield.equippedIn; // its own round shield, slung on its back
  shield.id = 'shield';
  return { s, g };
}
const tacticsOf = (s: GameState, a: Actor) => withTactics(s, a, buildActorView(s, a.id)).tactics;
const orderOf = (s: GameState, a: Actor) => fallbackOrder(withTactics(s, a, buildActorView(s, a.id)), createRng(1));
const shoot = (s: GameState, g: Actor) => s.events.push({ id: 'shot', turn: s.turn, actorId: 'player', kind: 'attack', zone: s.player.zone, target: g.id, ranged: true,
  effects: [], noise: 'normal', visibility: 'high', perception: { [g.id]: { level: 'full', cue: 'sight' } } } as unknown as GameEvent);

describe('383 B3 Ready the shield', () => {

  it('shot at, it draws its stowed shield beside the order its list chose; not shot, or below 50, it does not', () => {
    const { s, g } = shotGuard();
    expect(tacticsOf(s, g)?.readyShield).toBeUndefined(); // not shot at
    shoot(s, g);
    expect(tacticsOf(s, g)?.readyShield).toBe('shield');
    const o = orderOf(s, g);
    expect(o.gear).toEqual([{ op: 'draw', item: 'shield' }]);
    expect(o.type).not.toBe('hold'); // beside, never instead: the list's own order stands
    skill(g, SK.battle_sense, 49);
    expect(tacticsOf(s, g)?.readyShield).toBeUndefined();
  });

  it('nothing to do with a shield already in hand, or no free hand for it', () => {
    const { s, g } = shotGuard();
    shoot(s, g);
    const shield = g.core.inventory.find((i) => i.id === 'shield')!;
    shield.equippedIn = ['grip:left_arm'];
    expect(canBlock(s, g)).toBe(true);
    expect(tacticsOf(s, g)?.readyShield).toBeUndefined();
    delete shield.equippedIn;
    for (const i of g.core.inventory) delete i.equippedIn;
    g.core.inventory.push({ id: 'bow2', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] }); // both hands full
    expect(tacticsOf(s, g)?.readyShield).toBeUndefined();
  });

  it('in play the shield ends up in hand, so it can block', async () => {
    const { play } = await import('./w4-kit');
    const { s, g } = shotGuard();
    s.turn = s.pending.turn;
    shoot(s, g);
    (s.recentEvents ??= []).push(...s.events); // the shot came last turn: play starts the turn with no events of its own
    play(s, {});
    expect(canBlock(s, g)).toBe(true);
  });
});
