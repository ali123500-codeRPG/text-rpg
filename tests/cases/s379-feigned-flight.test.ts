// 379 S3 Feigned flight (TC19 a, TC24 a, TC50-TC52 a; Stratagem 70): outnumbered and not Wounded, a code-run NPC runs as
// if broken once a fight; foes that lose Insight against its Guile believe it; a believer that follows alone within one
// move is turned on, and that blow lands as on an unaware foe; with no such follower the feint ends after FEINT_S.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { buildActorView, buildOppositionView } from '../../src/views';
import { withTactics } from '../../src/views/tactics';
import { fallbackOrder } from '../../src/minds';
import { FX } from '../../src/library/tableIds';
import { SK } from '../../src/library/skillIds';
import { CONFIG } from '../../src/config';
import { feinting, startFeint } from '../../src/engine/feint';
import { now } from '../../src/time';
import type { Actor, GameState } from '../../src/types';

const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const skill = (a: Actor, id: string, raw: number) => { a.core.skills[id] = { raw, state: 'normal' }; };
const tactics = (s: GameState, a: Actor) => withTactics(s, a, buildActorView(s, a.id)).tactics;
const orderOf = (s: GameState, a: Actor) => fallbackOrder(withTactics(s, a, buildActorView(s, a.id)), createRng(1));
const engage = (s: GameState, a: Actor, b: Actor) => {
  a.mind!.knowledge[b.id] = { status: 'engaged', source: 'seen', revealed: [], lastKnownZone: b.zone, lastSeenTurn: s.turn };
};
/** the patron (Stratagem 70, a sure liar) fights the player and the guard together in the common room */
function outnumbered() {
  const s = makeVillage();
  const patron = npc(s, 'patron_1'), guard = npc(s, 'guard_1');
  patron.mind!.overrides = { player: 'hostile', guard_1: 'hostile' };
  patron.mind!.control = 'code';
  guard.mind!.overrides = { patron_1: 'hostile' };
  place(s, guard.id, patron.zone);
  guard.pos = patron.pos && { x: patron.pos.x + 1, y: patron.pos.y };
  delete patron.asleep; delete guard.asleep;
  engage(s, patron, s.player); engage(s, patron, guard); engage(s, guard, patron);
  for (const k of [SK.battle_sense, SK.command, SK.fieldcraft, SK.stratagem]) skill(patron, k, 0);
  skill(patron, SK.stratagem, 70);
  skill(patron, SK.guile, 1000);
  for (const x of [s.player, guard]) skill(x, SK.insight, 0);
  patron.engagement = { start: s.turn, last: s.turn, kinds: ['fight'] };
  return { s, patron, guard };
}

describe('379 S3 Feigned flight', () => {
  it('outnumbered and not Wounded, it starts a feigned flight once a fight (Stratagem 70); below 70 it does not', () => {
    const { s, patron } = outnumbered();
    expect(tactics(s, patron)?.feint).toBe('start');
    expect(orderOf(s, patron).rule).toBe(FX.feigned_flight);
    skill(patron, SK.stratagem, 69);
    expect(tactics(s, patron)?.feint).toBeUndefined();
    skill(patron, SK.stratagem, 70);
    patron.mind!.rowsUsed = { [FX.feigned_flight]: s.turn }; // used this fight already
    expect(tactics(s, patron)?.feint).toBeUndefined();
  });

  it('foes that lose the roll believe it and see it broken (TC52 a); a lone believer within one move is turned on (TC50 a)', () => {
    const { s, patron, guard } = outnumbered();
    const fx = startFeint(s, patron, createRng(1));
    expect(fx.filter((f) => f.kind === 'feint_fooled').map((f) => f.actorId).sort()).toEqual([guard.id, s.player.id].sort());
    expect(buildOppositionView(s, guard.id).seen.find((x) => x.id === patron.id)?.morale).toBe('Broken');
    // the player and the guard both stand close: no one is alone, so it keeps running
    s.player.zone = patron.zone;
    s.player.pos = patron.pos && { x: patron.pos.x - 1, y: patron.pos.y };
    expect(tactics(s, patron)?.feint).toBe('run');
    expect(orderOf(s, patron).rule).toBe(FX.feigned_flight);
    // the player falls far behind: the guard follows alone
    s.player.pos = patron.pos && { x: patron.pos.x - 200, y: patron.pos.y };
    s.player.zone = 'street_square';
    expect(tactics(s, patron)?.turnOn).toBe(guard.id);
    expect(orderOf(s, patron)).toMatchObject({ type: 'attack', target: guard.id, rule: FX.feigned_flight });
  });

  it('with no lone follower the feint ends after FEINT_S of game time', () => {
    const { s, patron } = outnumbered();
    startFeint(s, patron, createRng(1));
    expect(feinting(s, patron)).toBe(true);
    patron.feint!.at = now(s) - CONFIG.FEINT_S / 60;
    expect(feinting(s, patron)).toBe(false);
  });

  it('the turn-around blow on a believer lands as on an unaware foe (TC51 a) and ends the feint', async () => {
    const { play } = await import('./w4-kit');
    const { s, patron, guard } = outnumbered();
    startFeint(s, patron, createRng(1));
    place(s, 'player', 'street_square'); // left behind: the guard follows alone
    const ev = play(s, {});
    const blow = ev.find((e) => e.kind === 'attack' && e.actorId === patron.id && e.target === guard.id);
    expect(blow?.attack?.unaware).toBe(true);
    expect(patron.feint).toBeUndefined();
  });
});
