// 114 Hold (A8; rules in src/library/perks.ts). Anyone can grapple (a humanoid natural attack on
// unarmed_grapple). With Hold, a grapple that lands with a Great Success or better holds the target: it can't leave the
// zone or use a two-handed mode, and trying to leave is a break-free contest it wins on a tie or better.
import { describe, expect, it } from 'vitest';
import { makeVillage, forcedRng } from '../harness';
import { ruleset, usableModes } from '../../src/ruleset';
import { applyHold, breakFree } from '../../src/engine/held';
import { heldBy } from '../../src/engine/relations';
import { buildPlayerView } from '../../src/views';
import type { Actor, AttackResult, GameState } from '../../src/types';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const grab = { attackerId: 'player', targetId: 'patron_1', weaponId: 'natural:grapple', modeId: 'grapple', targetPart: null, aimed: false };

describe('114 Hold', () => {
  it('a grapple is a natural attack on unarmed_grapple; with Hold a Great Success that hits holds the target', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    const r = ruleset.attack(grab, s, forcedRng([95, 5, 50]));
    expect(r.attack.tier === 'great_success' || r.attack.tier === 'critical_success').toBe(true);
    expect(['missed', 'dodged']).not.toContain(r.outcome);
    expect(applyHold(s.player, wim, r, SK.unarmed_grapple)).toBeNull(); // no perk
    give(s.player, 'hold');
    expect(applyHold(s.player, wim, r, SK.unarmed_strike)).toBeNull(); // a punch never holds
    expect(applyHold(s.player, wim, { ...r, outcome: 'dodged' } as AttackResult, SK.unarmed_grapple)).toBeNull();
    expect(applyHold(s.player, wim, { ...r, attack: { ...r.attack, tier: 'success' } } as AttackResult, SK.unarmed_grapple)).toBeNull();
    expect(applyHold(s.player, wim, r, SK.unarmed_grapple)).toEqual({ kind: 'held', actorId: 'patron_1', data: { by: 'player' } });
    expect(heldBy(s, wim)?.id).toBe('player');
  });
  it('a held actor can’t use a two-handed mode', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    for (const i of s.player.core.inventory) delete i.equippedIn;
    s.player.core.inventory.push({ id: 'axe', itemId: 'greataxe', equippedIn: ['hand:right_arm', 'hand:left_arm'] });
    expect(usableModes(s, s.player).some((m) => m.itemId === 'axe')).toBe(true);
    s.player.heldBy = wim.id;
    wim.zone = s.player.zone;
    expect(usableModes(s, s.player).some((m) => m.itemId === 'axe')).toBe(false);
    expect(buildPlayerView(s).player.heldBy).toBeDefined();
  });
  it('the hold ends when the holder is downed or not in the zone', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    s.player.heldBy = wim.id;
    wim.zone = s.player.zone;
    expect(heldBy(s, s.player)).toBe(wim);
    wim.zone = 'tav_cellar';
    expect(heldBy(s, s.player)).toBeUndefined();
    wim.zone = s.player.zone;
    wim.core.condition.hpLostPct = 100;
    expect(heldBy(s, s.player)).toBeUndefined();
  });
  it('break free: a tie or better frees the target; a loss keeps it held', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    wim.zone = s.player.zone;
    s.player.heldBy = wim.id;
    const lose = breakFree(s, s.player, forcedRng([1, 99]))!;
    expect(lose.free).toBe(false);
    expect(lose.effect.kind).toBe('still_held');
    expect(s.player.heldBy).toBe(wim.id);
    const win = breakFree(s, s.player, forcedRng([99, 1]))!;
    expect(win.free).toBe(true);
    expect(win.effect.kind).toBe('broke_free');
    expect(s.player.heldBy).toBeUndefined();
  });
  it('a held player who walks away tries to break free instead, and stays in the zone', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    wim.zone = s.player.zone;
    s.player.heldBy = wim.id;
    const from = s.player.zone;
    const ev = play(s, { intent: intent({ move: { toZone: 'tav_counter' } }) });
    expect(s.player.zone).toBe(from);
    expect(ev.some((e) => e.kind === 'break_free' && e.actorId === 'player')).toBe(true);
  });
  it('“I grab him” picks the grapple, not the sword in hand', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    wim.zone = s.player.zone;
    const ev = play(s, { intent: intent({ action: { type: 'attack', skill: SK.unarmed_grapple, target: 'patron_1' } }) });
    const atk = ev.find((e) => e.kind === 'attack' && e.actorId === 'player');
    expect(atk?.itemId).toBe('natural:grapple');
  });
});
