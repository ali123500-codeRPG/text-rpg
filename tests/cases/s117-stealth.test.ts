// 117 Stealth tree (ST1–ST10; spec tests 3, 18 and 42): a sneak is a stealth contest per observer.
// Sneaking is used outside an engagement and Combat Stealth inside one or for a shot; melee reveals, a shot does not.
import { TP } from '../../src/library/templateIds';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beside, createRng, makeVillage, place } from '../harness';
import { CONFIG } from '../../src/config';
import { resolveTurn } from '../../src/engine';
import { ruleset } from '../../src/ruleset';
import { stealthyArrival } from '../../src/scenario/apply';
import { spawnNpc } from '../../src/library/spawn';
import type { ContestResult, GameState, Intent, RollRequest } from '../../src/types';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';
import { FU } from '../../src/library/tableIds';
import { zoneById } from '../../src/engine/relations';
import { coverMod, coverShown } from '../../src/ruleset/gear';

const intent = (move: Intent['move'], action: Partial<NonNullable<Intent['action']>> | null = null, spoken: Intent['spoken'] = null): Intent => ({
  move, gear: null, spoken, addressees: null, deferred: [], clarify: null,
  action: action ? { type: 'sneak', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal', ...action } : null,
});
const turn = (s: GameState, i: Intent) => { s.turn += 1; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, createRng(1)); };
const status = (s: GameState, id: string) => s.actors.find((a) => a.id === id)!.mind!.knowledge.player?.status ?? 'unaware';
/** forces each stealth contest's gap by observer id (others: the player wins); records the requests */
function rig(gaps: Record<string, number | number[]> = {}) {
  const calls: [RollRequest, RollRequest][] = [];
  const real = ruleset.contested;
  vi.spyOn(ruleset, 'contested').mockImplementation((a, b, st, rng) => {
    if (a.rollKind !== 'stealth') return real(a, b, st, rng);
    calls.push([a, b]);
    const r = real(a, b, st, rng);
    const g = gaps[b.actorId] ?? -1;
    const gap = Array.isArray(g) ? g.shift() ?? -1 : g;
    return { ...r, gap, winner: gap < 0 ? 'a' : gap > 0 ? 'b' : 'tie' } as ContestResult;
  });
  return calls;
}
const aware = (s: GameState, id: string, zone: string) => {
  s.actors.find((a) => a.id === id)!.mind!.knowledge.player = { status: 'aware', source: 'seen', lastKnownZone: zone, lastSeenTurn: s.turn, revealed: [] };
};

afterEach(() => vi.restoreAllMocks());

describe('117 stealth', () => {
  it('3 slipping away, per observer: a sneak move rolls Vanishing against those who see you; the guard who loses drops to suspicious where it last saw you, the one who wins stays aware (ST15, VS1)', () => {
    const s = makeVillage();
    s.actors.push(spawnNpc(null, TP.guard, { id: 'guard_2', zone: 'gate_inner', placeId: 'gate', bandId: 'village_watch', name: 'Hal', storyId: 'test' }));
    place(s, 'player', 'gate_inner');
    aware(s, 'guard_1', 'gate_inner');
    aware(s, 'guard_2', 'gate_inner');
    const calls = rig({ guard_1: -1, guard_2: 1 });
    turn(s, intent({ toZone: 'street_square' }, { type: 'sneak' }));
    expect(s.player.zone).toBe('street_square');
    expect(s.player.posture).toBe('stealthy');
    expect(calls.filter(([, b]) => b.actorId.startsWith('guard_')).map(([a]) => a.skill)).toEqual([SK.vanishing, SK.vanishing]); // VS1: those who see you roll Vanishing
    expect(calls.filter(([, b]) => !b.actorId.startsWith('guard_')).every(([a]) => a.skill === SK.sneaking)).toBe(true); // the rest, Sneaking
    const b1 = s.actors.find((a) => a.id === 'guard_1')!.mind!.knowledge.player!;
    expect(b1.status).toBe('suspicious');
    expect(b1.lastKnownZone).toBe('gate_inner');
    expect(['aware', 'tracking']).toContain(status(s, 'guard_2'));
  });
  it('a sneak that stays put never rolls against someone who already sees you, without Melt Away (VS2)', () => {
    const s = makeVillage();
    place(s, 'player', 'gate_inner');
    aware(s, 'guard_1', 'gate_inner');
    const calls = rig({ guard_1: -1 });
    turn(s, intent(null, { type: 'sneak' }));
    expect(calls.some(([, b]) => b.actorId === 'guard_1')).toBe(false);
    expect(['aware', 'tracking']).toContain(status(s, 'guard_1'));
  });
  it('a shot target that loses the notice contest still turns suspicious, at the shooter\'s zone (ST19)', () => {
    const s = makeVillage();
    place(s, 'player', 'field_edge');
    for (const i of s.player.core.inventory) delete i.equippedIn;
    s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
    s.player.posture = 'stealthy';
    rig({ slime_1: -1 });
    turn(s, intent(null, { type: 'attack', target: 'slime_1' }));
    const b = s.actors.find((a) => a.id === 'slime_1')!.mind!.knowledge.player;
    expect(b?.status).toBe('suspicious');
    expect(b?.lastKnownZone).toBe('field_edge');
  });
  it('18 sneaking persists over moves; detection on turn 3 is the contest', () => {
    const s = makeVillage();
    place(s, 'player', 'street_door');
    rig({ guard_1: 1 });
    turn(s, intent(null, { type: 'sneak' }));
    turn(s, intent({ toZone: 'street_square' }));
    expect(s.player.posture).toBe('stealthy');
    turn(s, intent({ toZone: 'gate_inner' }));
    expect(s.player.posture).toBe('stealthy');
    expect(s.log.some((l) => l.code === 'stealth_contest' && (l.detail as { observerId?: string }).observerId === 'guard_1')).toBe(true);
    expect(['aware', 'tracking']).toContain(status(s, 'guard_1'));
  });
  it('a sneak keeps its move (ST3), and speaking aloud ends it', () => {
    const s = makeVillage();
    place(s, 'player', 'street_door');
    rig();
    turn(s, intent({ toZone: 'street_square' }, { type: 'sneak' }));
    expect(s.player.zone).toBe('street_square');
    expect(s.player.posture).toBe('stealthy');
    turn(s, intent(null, null, 'Hello!'));
    expect(s.player.posture).toBe('open');
  });
  it('42 a stealthy frontier arrival is tested by each observer in range', () => {
    const s = makeVillage();
    place(s, 'player', 'field_far');
    s.player.posture = 'stealthy';
    const calls = rig({ slime_2: 0 });
    stealthyArrival(s, createRng(1));
    expect(calls.map(([, b]) => b.actorId)).toContain('slime_2');
    expect(status(s, 'slime_2')).toBe('suspicious');
  });
  it('a melee blow from stealth reveals the attacker (ST5)', () => {
    const s = makeVillage();
    place(s, 'player', 'field_mid');
    s.player.posture = 'stealthy';
    rig();
    turn(s, intent(null, { type: 'attack', target: 'slime_1' }));
    expect(s.player.posture).toBe('open');
  });
  it('a shot from stealth keeps the posture and the notice contest uses Combat Stealth (ST5, ST7)', () => {
    const s = makeVillage();
    place(s, 'player', 'field_edge');
    for (const i of s.player.core.inventory) delete i.equippedIn;
    s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
    s.player.posture = 'stealthy';
    const calls = rig();
    turn(s, intent(null, { type: 'attack', target: 'slime_1' }));
    expect(s.player.posture).toBe('stealthy');
    expect(calls.some(([a, b]) => a.skill === SK.combat_stealth && b.actorId === 'slime_1')).toBe(true);
  });
  it('a shot after a step in the same turn still gets its own Combat Stealth contest (BG-263)', () => {
    const s = makeVillage();
    place(s, 'player', 'field_edge');
    s.player.pos = { x: 57, y: -14 }; // 53 m from slime_1, past the shortbow's 50 m (a sneaking step covers half the ground, VS8)
    for (const i of s.player.core.inventory) delete i.equippedIn;
    s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['grip:right_arm', 'grip:left_arm'] });
    s.player.posture = 'stealthy';
    const calls = rig();
    turn(s, intent(null, { type: 'attack', target: 'slime_1' })); // the order steps into range first, then shoots
    expect(s.log.some((l) => l.turn === s.turn && l.code === 'stealth_contest' && (l.detail as { kind: string }).kind === 'move')).toBe(true);
    const vsSlime = calls.filter(([, b]) => b.actorId === 'slime_1').map(([a]) => a.skill);
    expect(vsSlime).toEqual([SK.sneaking, SK.combat_stealth]); // the step, then the shot
  });
  it('darkness and cover help a sneak; it feels leg wounds (ST6, ST10, HA1)', () => {
    const s = makeVillage();
    place(s, 'player', 'tav_cellar');
    const t = place(s, 'trader', 'tav_cellar');
    // PC1, PC2: barrels in the middle of the cellar, the player crouched just past them from the trader
    const z = zoneById(s, 'tav_cellar')!, c = { x: z.rect!.x, y: z.rect!.y };
    z.furniture = [{ id: 'tav_cellar.fu1', kind: FU.barrels, name: 'barrels' }];
    s.player.pos = { x: c.x, y: c.y + 0.7 }; t.pos = { x: c.x, y: c.y - 3 };
    s.player.core.condition.parts.left_leg = -30;
    const cover = coverMod(coverShown(s, s.player, z, t));
    expect(cover).toBe(11); // the line over 1 m barrels from the trader's eye hides 53% of the player
    const calls = rig();
    turn(s, intent(null, { type: 'sneak' }));
    const [a, o] = calls.find(([, b]) => b.actorId === 'trader')!;
    expect(a.skill).toBe(SK.sneaking);
    // P14: darkness gives no help against a listener
    expect(a.modifiers).toEqual([...(o.skill === SK.eyesight ? [{ source: 'light', type: 'situational', value: 22 }] : []), { source: 'cover', type: 'situational', value: cover }]);
    expect(a.tierShifts).toEqual([]);
    expect(a.roles).toBeUndefined();
    const [, b] = calls.find(([, o]) => o.actorId === 'trader')!;
    expect(b.modifiers).toEqual(b.skill === SK.eyesight ? [{ source: 'light', type: 'situational', value: -22 }] : []); // ST21: sight is hurt
  });
  it('tags decide the tables (ST21, HA1): a sneak rolls Sneaking or Vanishing by what the watcher knows', () => {
    const s = makeVillage();
    place(s, 'player', 'tav_counter');
    place(s, 'trader', 'tav_cellar');
    s.player.posture = 'stealthy';
    const calls = rig();
    turn(s, intent({ toZone: 'tav_cellar' }, { type: 'sneak' }));
    expect(calls.find(([, b]) => b.actorId === 'trader')![0]).toMatchObject({ skill: SK.sneaking, tierShifts: [] }); // CV6: cover is a roll modifier now, never a tier shift
    const v = makeVillage();
    place(v, 'player', 'tav_counter');
    place(v, 'trader', 'tav_cellar');
    aware(v, 'trader', 'tav_counter');
    const vc = rig();
    turn(v, intent({ toZone: 'tav_cellar' }, { type: 'sneak' }));
    expect(vc.find(([, b]) => b.actorId === 'trader')![0]).toMatchObject({ skill: SK.vanishing, tierShifts: [] });
  });
  it('VS5: slipping away from a foe fighting you within VANISH_NEAR_M takes a tier shift; one only aware of you, or farther off, does not', () => {
    const shifts = (engaged: boolean, m: number) => {
      const s = makeVillage();
      place(s, 'player', 'gate_inner');
      const g = beside(s, 'guard_1', 'player', m);
      delete g.core.skills[SK.battle_sense]; // its Reaction (Battle Sense) would close in before the slip, so the metres stay as set
      aware(s, 'guard_1', 'gate_inner');
      if (engaged) { g.mind!.knowledge.player!.status = 'engaged'; g.mind!.overrides = { player: 'hostile' }; }
      const calls = rig({ guard_1: -1 });
      turn(s, intent({ toZone: 'street_square' }, { type: 'sneak' }));
      const [a] = calls.find(([, b]) => b.actorId === 'guard_1')!;
      expect(a.skill).toBe(SK.vanishing);
      return a.tierShifts.filter((t) => t.source === 'foe close by');
    };
    expect(shifts(true, 1)).toEqual([{ source: 'foe close by', value: CONFIG.VANISH_NEAR_SHIFT }]);
    expect(shifts(false, 1)).toEqual([]);
    expect(shifts(true, CONFIG.VANISH_NEAR_M + 2)).toEqual([]);
  });
  it('an observer with Unblinking who loses a Vanishing roll must also lose a stealth contest (ST23)', () => {
    const s = makeVillage();
    place(s, 'player', 'gate_inner');
    aware(s, 'guard_1', 'gate_inner');
    s.actors.find((a) => a.id === 'guard_1')!.core.perks.push({ perkId: PK.unblinking } as never);
    const calls = rig({ guard_1: [-1, 0] });
    turn(s, intent({ toZone: 'street_square' }, { type: 'sneak' }));
    expect(calls.filter(([, b]) => b.actorId === 'guard_1').map(([a]) => a.skill)).toEqual([SK.vanishing, SK.sneaking]); // the slimes in the field see it too now
    expect(['aware', 'tracking']).toContain(status(s, 'guard_1'));
  });
});
