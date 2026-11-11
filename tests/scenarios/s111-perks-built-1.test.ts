// 111 Coded 20-milestone perks, batch 1 (rules in src/library/perks.ts): Hidden Strike, Shield
// Breaker, Point Blank, Iron Frame, Read Wounds, Keen Ear. Each is checked with and without the perk.
import { describe, expect, it } from 'vitest';
import { makeVillage, place, forcedRng, fit } from '../harness';
import { ruleset, woundsMods } from '../../src/ruleset';
import { perceptionOf } from '../../src/perception';
import { buildPlayerView } from '../../src/views';
import type { Actor, GameEvent, GameState } from '../../src/types';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const npc = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!;
const sword = `player_${IT.arming_sword}_1`;

describe('111 coded perks, batch 1', () => {
  it('Hidden Strike: an attack on an unaware target lands one tier better', () => {
    const s = makeVillage();
    const req = { attackerId: 'player', targetId: 'patron_1', weaponId: sword, targetPart: null, aimed: false, context: { defenderUnaware: true } };
    const plain = ruleset.attack(req, s, forcedRng([50, 30, 20]));
    give(s.player, PK.hidden_strike);
    const hs = ruleset.attack(req, s, forcedRng([50, 30, 20]));
    expect(hs.attack.tierShifts).toEqual([{ source: 'Hidden Strike', value: 1 }]);
    expect(hs.gap).toBe(plain.gap! - 1);
    const aware = ruleset.attack({ ...req, context: {} }, s, forcedRng([50, 30, 20]));
    expect(aware.attack.tierShifts).toEqual([]);
  });
  it('Point Blank: no "hostile in zone" penalty on a ranged attack', () => {
    const s = makeVillage();
    place(s, 'player', 'field_mid');
    for (const i of s.player.core.inventory) delete i.equippedIn;
    s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['hand:right_arm', 'hand:left_arm'] });
    const req = { attackerId: 'player', targetId: 'slime_1', weaponId: 'bow', targetPart: null, aimed: false };
    const has = (r: ReturnType<typeof ruleset.attack>) => r.attack.modifiers.some((m) => m.source === 'hostile in zone');
    expect(has(ruleset.attack(req, s, forcedRng([50, 50, 50])))).toBe(true);
    give(s.player, PK.point_blank);
    expect(has(ruleset.attack(req, s, forcedRng([50, 50, 50])))).toBe(false);
  });
  it('Shield Breaker: a heavy melee hit on a shield does double damage to the shield', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    fit(wim, IT.round_shield).core.inventory.push({ id: 'wim_shield', itemId: IT.round_shield, equippedIn: ['hand:left_arm'] });
    wim.core.standingDefense = 'block';
    for (const i of s.player.core.inventory) delete i.equippedIn;
    s.player.core.inventory.push({ id: 'axe', itemId: IT.greataxe, equippedIn: ['hand:right_arm', 'hand:left_arm'] });
    fit(s.player, IT.greataxe);
    const req = { attackerId: 'player', targetId: 'patron_1', weaponId: 'axe', targetPart: null, aimed: false };
    const lost = (r: ReturnType<typeof ruleset.attack>) => {
      const sh = wim.core.inventory.find((i) => i.id === 'wim_shield')!;
      sh.pools = { shield: 100 };
      ruleset.applyEffects(r, s);
      return 100 - sh.pools!.shield;
    };
    const plain = ruleset.attack(req, s, forcedRng([35, 99])); // a Success hit into a Critical block
    expect(plain.location).toBe('shield');
    const base = lost(plain);
    expect(base).toBeGreaterThan(0);
    give(s.player, PK.shield_breaker);
    const sb = ruleset.attack(req, s, forcedRng([35, 99]));
    expect(sb.shieldMult).toBe(2);
    expect(lost(sb)).toBeCloseTo(base * 2);
  });
  it('Iron Frame: a Damaged arm gives no grip penalty; a Crippled one still does', () => {
    const s = makeVillage();
    s.player.core.condition.parts.right_arm = 30; // Damaged
    const grip = () => woundsMods(s, s.player, SK.melee_medium, { itemId: sword }).find((m) => m.source === 'grip wounds')?.value ?? 0;
    expect(grip()).toBeLessThan(0);
    give(s.player, PK.iron_frame);
    expect(grip()).toBe(0);
    s.player.core.condition.parts.right_arm = -10; // Crippled
    expect(grip()).toBeLessThan(0);
    give(s.player, PK.tough_it_out); // Crippled counts as Damaged
    expect(grip()).toBe(0);
  });
  it('Read Wounds: a foe’s Damaged parts and its health one level earlier', () => {
    const s = makeVillage();
    const wim = npc(s, 'patron_1');
    s.bands.find((b) => b.id === 'tavern_folk')!.relations.player_band = 'opposed';
    wim.core.condition.hpLostPct = 40; // Injured
    wim.core.condition.parts.left_arm = 30; // Damaged
    const seen = () => buildPlayerView(s).actors.find((a) => a.id === 'patron_1')!;
    expect(seen().health).toBeUndefined();
    expect(seen().damaged).toBeUndefined();
    give(s.player, PK.read_wounds);
    expect(seen()).toMatchObject({ health: 'Injured', damaged: ['left_arm'] });
    wim.core.condition.hpLostPct = 20; // Hurt: still hidden
    expect(seen().health).toBeUndefined();
  });
  it('Keen Ear: hears 10 dB quieter, about one zone link further; silence stays silent', () => {
    const s = makeVillage();
    place(s, 'player', 'field_edge');
    const far = npc(s, 'slime_2');
    const ev: GameEvent = { id: 'e', turn: 1, actorId: far.id, kind: 'move', zone: far.zone, effects: [], noise: 'quiet', visibility: 'unseen', perception: {} };
    const before = perceptionOf(ev, s, s.player);
    give(s.player, PK.keen_ear);
    const after = perceptionOf(ev, s, s.player);
    expect(before).toBeNull();
    expect(after).toMatchObject({ level: 'partial', cue: 'sound' });
    const here: GameEvent = { ...ev, zone: s.player.zone, noise: 'silent' };
    expect(perceptionOf(here, s, s.player)).toBeNull(); // no sound at all: nothing to hear
  });
});
