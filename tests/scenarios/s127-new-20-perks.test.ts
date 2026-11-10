// 127 20 perks for the skills added after the first 20 round: Soft Tread (Sneaking), Melt Away (Vanishing),
// Slip the Blow (Light Armor), Quiet Mail (Medium Armor), Turn Aside (Heavy Armor).
import { describe, expect, it } from 'vitest';
import { createRng, fit, forcedRng, makeVillage, place } from '../harness';
import { meltAwayHere, ruleset } from '../../src/ruleset';
import { installRoutines } from '../../src/minds';
import { resolveTurn } from '../../src/engine';
import { checkParserLegality } from '../../src/agents/legality';
import { buildPlayerView } from '../../src/views';
import { zoneById } from '../../src/engine/relations';
import type { Actor, GameState } from '../../src/types';
import { intent, play } from './w4-kit';
import { SK } from '../../src/library/skillIds';
import { beliefStatus } from '../../src/perception';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';

const give = (a: Actor, perkId: string) => a.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
const NOISE = ['silent', 'faint', 'hushed', 'quiet', 'normal', 'loud', 'deafening'];
const wear = (a: Actor, itemId: string) => {
  a.core.inventory = a.core.inventory.filter((i) => !i.equippedIn?.includes('armor'));
  a.core.inventory.push({ id: 'worn', itemId, equippedIn: ['armor'] });
  fit(a, itemId);
};
const arm = (s: GameState, id: string) => {
  const a = s.actors.find((x) => x.id === id)!;
  for (const i of a.core.inventory) delete i.equippedIn;
  a.core.inventory.push({ id: `w_${id}`, itemId: IT.dagger, equippedIn: ['hand:right_arm', 'hand:left_arm'] });
  fit(a, IT.dagger);
};

function patrolNoise(armor: string, perk: boolean) {
  const s = makeVillage({ playerZone: 'tav_common' });
  const g = place(s, 'guard_1', 'street_square');
  wear(g, armor);
  if (perk) give(g, PK.quiet_mail);
  installRoutines(g, 'patrol_guard', { route: ['street_door', 'street_square'] }, 'route', s.turn, createRng(1));
  const events = resolveTurn(s, { intent: null, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(s.rngState));
  return NOISE.indexOf(events.find((e) => e.kind === 'move' && e.actorId === g.id)!.noise);
}

/** an attack by patron_1 on the player, scanning the defense die until the raw gap is `gap` */
function attackAtGap(s: GameState, gap: number) {
  for (let d = 1; d <= 100; d++) {
    const r = ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([60, d, 50, 50, 50]));
    if (r.defense && r.gapShifts.length === 0 && r.gap === gap) return d;
  }
  throw new Error(`no defense die gives gap ${gap}`);
}

describe('127 20 perks for the new skills', () => {
  it('Quiet Mail: worn armor adds one noise step less, never below none', () => {
    expect(patrolNoise(IT.mail_hauberk, true)).toBe(patrolNoise(IT.gambeson, false));
    expect(patrolNoise(IT.plate_harness, true)).toBe(patrolNoise(IT.mail_hauberk, false));
    expect(patrolNoise(IT.gambeson, true)).toBe(patrolNoise(IT.gambeson, false));
  });

  it('Soft Tread: a Stealthy move is one noise step quieter; an open move is not', () => {
    const run = (perk: boolean, stealthy: boolean) => {
      const s = makeVillage({ playerZone: 'tav_common' });
      s.player.core.inventory = s.player.core.inventory.filter((i) => !i.equippedIn?.includes('armor'));
      if (perk) give(s.player, PK.soft_tread);
      const ev = play(s, { intent: intent({ move: { toZone: 'tav_counter' }, ...(stealthy ? { action: { type: 'sneak' } } : {}) }) });
      return NOISE.indexOf(ev.find((e) => e.kind === 'move' && e.actorId === 'player')!.noise);
    };
    expect(run(true, true)).toBe(run(false, true) - 1);
    expect(run(true, false)).toBe(run(false, false));
  });

  it('Melt Away: a Vanish with nowhere to go vanishes in place where there is cover or shade', () => {
    expect(meltAwayHere('none', 'bright')).toBe(false);
    expect(meltAwayHere('some', 'bright')).toBe(true);
    expect(meltAwayHere('none', 'dim')).toBe(true);
    const run = (perk: boolean) => {
      const s = makeVillage({ playerZone: 'tav_counter' });
      zoneById(s, 'tav_counter')!.cover = 'some';
      if (perk) give(s.player, PK.melt_away);
      const i = intent({ action: { type: 'vanish' } });
      const legal = checkParserLegality(i, buildPlayerView(s)).illegal;
      const ev = play(s, { intent: i });
      return { legal, vanished: ev.some((e) => e.actorId === 'player' && e.kind === 'hide' && e.vanish), zone: s.player.zone };
    };
    expect(run(false).legal).toContain('action.vanish');
    expect(run(false).vanished).toBe(false);
    const r = run(true);
    expect(r.legal).not.toContain('action.vanish');
    expect(r.vanished).toBe(true);
    expect(r.zone).toBe('tav_counter');
  });

  it('Slip the Blow: in light armor, a Dodge that ties counts as a graze', () => {
    const setup = (armor: string, perk: boolean) => {
      const s = makeVillage();
      place(s, 'patron_1', s.player.zone);
      arm(s, 'patron_1');
      s.player.core.standingDefense = 'dodge';
      wear(s.player, armor);
      if (perk) give(s.player, PK.slip_the_blow);
      return s;
    };
    const d = attackAtGap(setup(IT.gambeson, false), 0);
    const hit = (s: GameState) => ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([60, d, 50, 50, 50]));
    const r = hit(setup(IT.gambeson, true));
    expect(r.gapShifts).toEqual([{ source: 'Slip the Blow', value: 1 }]);
    expect(r.outcome).toBe('grazed');
    expect(r.multiplier).toBeCloseTo(0.8);
    expect(hit(setup(IT.mail_hauberk, true)).gapShifts).toEqual([]);
  });

  it('Turn Aside: a heavy or crushing hit on a part heavy armor covers lands as a full hit', () => {
    const setup = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'patron_1', s.player.zone);
      arm(s, 'patron_1');
      s.player.core.standingDefense = 'dodge';
      wear(s.player, IT.plate_harness);
      s.player.core.skills[SK.dodge] = { raw: 0, state: 'normal' };
      if (perk) give(s.player, PK.turn_aside);
      return s;
    };
    // a critical attack against a failed dodge: gap −4 or worse
    const hit = (s: GameState) => ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false }, s, forcedRng([100, 1, 50, 50, 50]));
    const plain = hit(setup(false));
    expect(['heavy_hit', 'crushing_hit']).toContain(plain.outcome);
    const covered = hit(setup(true));
    expect(covered.location).toBe(plain.location);
    expect(covered.outcome).toBe('full_hit');
    expect(covered.multiplier).toBe(1);
    expect(covered.damage).toBeLessThan(plain.damage);
  });
  it('In and Out: a melee attack from hiding keeps the owner Stealthy; only the target becomes aware', () => {
    const run = (perk: boolean) => {
      const s = makeVillage();
      place(s, 'patron_1', s.player.zone);
      s.player.core.inventory.push({ id: 'w_player', itemId: IT.dagger, equippedIn: ['hand:right_arm'] });
      fit(s.player, IT.dagger);
      if (perk) give(s.player, PK.in_and_out);
      s.player.posture = 'stealthy';
      play(s, { intent: intent({ action: { type: 'attack', target: 'patron_1', item: 'w_player' } }) });
      return { posture: s.player.posture, target: beliefStatus(s, s.actors.find((x) => x.id === 'patron_1')!, s.player) };
    };
    expect(run(false).posture).toBe('open');
    const r = run(true);
    expect(r.posture).toBe('stealthy');
    expect(r.target).toBe('aware');
  });

  it('the 60s against crowds: Blade Wall (Parry, medium weapon), Shield Wall (Block) and Slip the Crowd (Dodge) drop the outnumbered penalty', () => {
    const mods = (itemId: string | null, perk: string | null, stance: 'dodge' | 'block' | 'parry') => {
      const s = makeVillage();
      place(s, 'patron_1', s.player.zone);
      arm(s, 'patron_1');
      for (const i of s.player.core.inventory) delete i.equippedIn;
      if (itemId) { s.player.core.inventory.push({ id: 'guard', itemId, equippedIn: ['hand:right_arm'] }); fit(s.player, itemId); }
      s.player.core.standingDefense = stance;
      if (perk) give(s.player, perk);
      const r = ruleset.attack({ attackerId: 'patron_1', targetId: 'player', weaponId: 'w_patron_1', targetPart: null, aimed: false, context: { defensesThisTurn: 1 } }, s, forcedRng([60, 50, 50, 50, 50]));
      expect(r.defenseType).toBe(stance);
      return r.defense!.modifiers.some((m) => m.source === 'outnumbered');
    };
    expect(mods(IT.arming_sword, null, 'parry')).toBe(true);
    expect(mods(IT.arming_sword, PK.blade_wall, 'parry')).toBe(false);
    expect(mods(IT.dagger, PK.blade_wall, 'parry')).toBe(true);
    expect(mods(IT.round_shield, null, 'block')).toBe(true);
    expect(mods(IT.round_shield, PK.blade_wall, 'block')).toBe(true);
    expect(mods(IT.round_shield, PK.shield_wall, 'block')).toBe(false);
    expect(mods(null, null, 'dodge')).toBe(true);
    expect(mods(null, PK.slip_the_crowd, 'dodge')).toBe(false);
  });
});
