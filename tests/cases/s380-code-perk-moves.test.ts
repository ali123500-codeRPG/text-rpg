// 380 Code-run NPCs and perk moves (TC53-TC59 a): when an NPC run by code uses each perk move it owns, and how it gets up
// from Play Dead.
import { describe, expect, it } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { buildActorView } from '../../src/views';
import { withTactics } from '../../src/views/tactics';
import { brokenHolds, fallbackOrder } from '../../src/minds';
import { codePerkMove } from '../../src/engine/npcPerkMoves';
import { countPerkMove } from '../../src/engine/perkMoves';
import { openPlayDead } from '../../src/engine/playDead';
import { maxMorale } from '../../src/ruleset/morale';
import { PK } from '../../src/library/perkIds';
import { SK } from '../../src/library/skillIds';
import { CONFIG } from '../../src/config';
import type { Actor, GameState, Order } from '../../src/types';

const give = (a: Actor, ...perks: string[]) => { for (const perkId of perks) a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 }); };
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const skill = (a: Actor, id: string, raw: number) => { a.core.skills[id] = { raw, state: 'normal' }; };
const moraleAt = (a: Actor, level: string) => { a.core.condition.moraleLost = maxMorale(a) * (CONFIG.MORALE_TRACK.find(([l]) => l === level)![1] / 100); };
const view = (s: GameState, a: Actor) => withTactics(s, a, buildActorView(s, a.id));
/** the order the code-run list gives, with its perk moves weighed (as mergeOrders does) */
const decide = (s: GameState, a: Actor): Order => codePerkMove(s, a, buildActorView(s, a.id), fallbackOrder(view(s, a), createRng(1)));

/** a code-run patron hostile to the player in the street, `m` metres from it */
function fight(m: number) {
  const s = makeVillage();
  const p = place(s, 'patron_1', 'street_square');
  place(s, 'player', 'street_square');
  s.player.pos = { x: 14, y: -14 }; // inside the square (a 20 m square around x 20, y -14)
  p.pos = { x: 14 + m, y: -14 };
  p.mind!.overrides = { player: 'hostile' };
  p.mind!.control = 'code';
  p.mind!.knowledge.player = { status: 'engaged', source: 'seen', revealed: [], lastKnownZone: s.player.zone, lastSeenTurn: s.turn };
  delete p.asleep;
  for (const k of [SK.battle_sense, SK.command, SK.fieldcraft, SK.stratagem]) skill(p, k, 0); // no fight rows: plain attack and close in
  return { s, p };
}

describe('380 Code-run NPCs and perk moves', () => {
  it('TC56 a: the same opening draws them in, beside its walk, unless it backs off or flees', () => {
    const { s, p } = fight(12);
    give(p, PK.draw_them_in);
    const o = decide(s, p);
    expect(o.type).toBe('attack');
    expect(o.perkMove).toEqual({ perk: PK.draw_them_in, target: null });
    const flee: Order = { actorId: p.id, type: 'flee', target: 'tav_common', skill: null, intent: 'flee', source: 'fallback' };
    expect(codePerkMove(s, p, buildActorView(s, p.id), flee).perkMove).toBeUndefined();
    // a foe already in melee reach: the opening is gone
    const near = fight(1);
    give(near.p, PK.draw_them_in);
    expect(decide(near.s, near.p).perkMove).toBeUndefined();
  });

  it('TC53 a: Dirt in the Eyes with its first melee attack of the fight, at that foe, with a free hand', () => {
    const { s, p } = fight(1);
    give(p, PK.dirt_in_the_eyes);
    expect(decide(s, p)).toMatchObject({ type: 'attack', target: s.player.id, perkMove: { perk: PK.dirt_in_the_eyes, target: s.player.id } });
    countPerkMove(s, p, PK.dirt_in_the_eyes, s.player.id);
    expect(decide(s, p).perkMove).toBeUndefined();
  });

  it('TC57 a: Bluff at each foe the first time it comes within melee reach, once per foe', () => {
    const { s, p } = fight(12);
    give(p, PK.bluff);
    expect(decide(s, p).perkMove).toBeUndefined(); // not yet in reach
    p.pos = s.player.pos && { x: s.player.pos.x + 1, y: s.player.pos.y };
    expect(decide(s, p).perkMove).toEqual({ perk: PK.bluff, target: s.player.id });
    countPerkMove(s, p, PK.bluff, s.player.id);
    expect(decide(s, p).perkMove).toBeUndefined();
  });

  it('TC55 a: Rally when an ally it would reach is at RALLY_AT or worse', () => {
    const { s, p } = fight(12);
    give(p, PK.rally);
    const ally = place(s, 'guard_1', 'street_square');
    ally.bandId = p.bandId ?? 'band_x';
    p.bandId = ally.bandId;
    ally.pos = p.pos && { x: p.pos.x + 2, y: p.pos.y };
    delete ally.asleep;
    moraleAt(ally, 'rattled');
    expect(decide(s, p).perkMove).toBeUndefined();
    moraleAt(ally, CONFIG.RALLY_AT);
    expect(decide(s, p)).toMatchObject({ type: 'hold', perkMove: { perk: PK.rally, target: null } });
  });

  it('TC58 a: Play Dead with the window open when Afraid or worse, or with two foes within one move; a broken one too', () => {
    const { s, p } = fight(1);
    give(p, PK.play_dead);
    p.core.condition.hpLostPct = CONFIG.HEALTH_TRACK.find(([l]) => l === 'wounded')![1];
    openPlayDead(s, p);
    expect(decide(s, p).perkMove).toBeUndefined(); // calm, one foe: it fights on
    moraleAt(p, CONFIG.PLAY_DEAD_AT);
    const o = decide(s, p);
    expect(o).toMatchObject({ type: 'hold', perkMove: { perk: PK.play_dead, target: null } });
    expect(o.move).toBeUndefined();
    // two foes within one move, calm
    p.core.condition.moraleLost = 0;
    const guard = place(s, 'guard_1', 'street_square');
    guard.pos = p.pos && { x: p.pos.x + 1, y: p.pos.y };
    delete guard.asleep;
    guard.mind!.overrides = { patron_1: 'hostile' };
    p.mind!.overrides = { player: 'hostile', guard_1: 'hostile' };
    p.mind!.knowledge.guard_1 = { status: 'engaged', source: 'seen', revealed: [], lastKnownZone: guard.zone, lastSeenTurn: s.turn };
    expect(decide(s, p).perkMove?.perk).toBe(PK.play_dead);
    // broken: the nerve keeps the drop
    p.core.condition.moraleLost = maxMorale(p);
    p.mind!.moraleState = 'broken';
    const v = buildActorView(s, p.id);
    expect(v.self.broken).toBe(true);
    expect(brokenHolds(v, decide(s, p)).perkMove?.perk).toBe(PK.play_dead);
  });

  it('TC59 a: lying there it stays still while a foe that saw through it is in sight or a believer is within one move, then sneaks away', () => {
    const { s, p } = fight(1);
    p.playingDead = { believers: [], judged: [s.player.id] }; // the player saw through it
    expect(decide(s, p)).toMatchObject({ type: 'hold', target: null });
    expect(decide(s, p).move).toBeUndefined();
    p.playingDead.believers = [s.player.id]; // believed, but close
    expect(decide(s, p).type).toBe('hold');
    expect(brokenHolds({ ...buildActorView(s, p.id), self: { ...buildActorView(s, p.id).self, broken: true } }, decide(s, p)).type).toBe('hold');
    place(s, 'player', 'tav_common'); // the believer walked off
    const up = decide(s, p);
    expect(up.type).toBe('sneak');
    expect(up.target).toBeTruthy();
  });

  it('TC54 a: in play, on the fight\'s first turn with a foe in sight but none in melee reach, a code-run NPC roars while it closes in, once a fight (mergeOrders weighs the perk moves on its fight-list order)', async () => {
    const { play } = await import('./w4-kit');
    const { s, p } = fight(12);
    give(p, PK.battle_cry);
    const from = Math.hypot(p.pos!.x - s.player.pos!.x, p.pos!.y - s.player.pos!.y);
    const ev = play(s, {});
    expect(ev.some((e) => e.kind === 'battle_cry' && e.actorId === p.id)).toBe(true);
    expect(Math.hypot(p.pos!.x - s.player.pos!.x, p.pos!.y - s.player.pos!.y)).toBeLessThan(from); // it closes in while it roars
    expect(decide(s, p).perkMove).toBeUndefined(); // once a fight
  });
});
