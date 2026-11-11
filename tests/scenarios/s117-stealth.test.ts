// 117 Stealth tree (ST1–ST10; spec tests 3, 18 and 42): hide and sneak are stealth contests per observer.
// Sneaking is used outside an engagement and Combat Stealth inside one or for a shot; melee reveals, a shot does not.
import { TP } from '../../src/library/templateIds';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRng, makeVillage, place } from '../harness';
import { resolveTurn } from '../../src/engine';
import { ruleset } from '../../src/ruleset';
import { stealthyArrival } from '../../src/scene/apply';
import { spawnNpc } from '../../src/library/spawn';
import type { ContestResult, GameState, Intent, RollRequest } from '../../src/types';
import { SK } from '../../src/library/skillIds';
import { PK } from '../../src/library/perkIds';
import { IT } from '../../src/library/itemIds';

const intent = (move: Intent['move'], action: Partial<NonNullable<Intent['action']>> | null = null, spoken: Intent['spoken'] = null): Intent => ({
  move, gear: null, spoken, addressees: null, deferred: [], clarify: null,
  action: action ? { type: 'hide', skill: '', target: null, targetPart: null, item: null, mode: null, approach: '', stance: 'normal', ...action } : null,
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
  it('3 vanish, per observer: the guard who loses it drops to suspicious where it last saw you, the one who wins stays aware (ST15)', () => {
    const s = makeVillage();
    s.actors.push(spawnNpc(null, TP.guard, { id: 'guard_2', zone: 'gate_inner', placeId: 'gate', bandId: 'village_watch', name: 'Hal', storyId: 'test' }));
    place(s, 'player', 'gate_inner');
    aware(s, 'guard_1', 'gate_inner');
    aware(s, 'guard_2', 'gate_inner');
    const calls = rig({ guard_1: -1, guard_2: 1 });
    turn(s, intent({ toZone: 'street_square' }, { type: 'vanish' }));
    expect(s.player.zone).toBe('street_square');
    expect(s.player.posture).toBe('stealthy');
    expect(calls.every(([a]) => a.skill === SK.vanishing)).toBe(true);
    const b1 = s.actors.find((a) => a.id === 'guard_1')!.mind!.knowledge.player!;
    expect(b1.status).toBe('suspicious');
    expect(b1.lastKnownZone).toBe('gate_inner');
    expect(['aware', 'tracking']).toContain(status(s, 'guard_2'));
  });
  it('a hide never rolls against someone who already sees you (ST12)', () => {
    const s = makeVillage();
    place(s, 'player', 'gate_inner');
    aware(s, 'guard_1', 'gate_inner');
    const calls = rig({ guard_1: -1 });
    turn(s, intent(null, { type: 'hide' }));
    expect(calls.some(([, b]) => b.actorId === 'guard_1')).toBe(false);
    expect(['aware', 'tracking']).toContain(status(s, 'guard_1'));
  });
  it('a shot target that loses the notice contest still turns suspicious, at the shooter\'s zone (ST19)', () => {
    const s = makeVillage();
    place(s, 'player', 'field_edge');
    for (const i of s.player.core.inventory) delete i.equippedIn;
    s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['hand:right_arm', 'hand:left_arm'] });
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
    s.player.core.inventory.push({ id: 'bow', itemId: IT.shortbow, equippedIn: ['hand:right_arm', 'hand:left_arm'] });
    s.player.posture = 'stealthy';
    const calls = rig();
    turn(s, intent(null, { type: 'attack', target: 'slime_1' }));
    expect(s.player.posture).toBe('stealthy');
    expect(calls.some(([a, b]) => a.skill === SK.combat_stealth && b.actorId === 'slime_1')).toBe(true);
  });
  it('darkness helps both rolls and cover helps a hide; a hide ignores leg wounds (ST6, ST10)', () => {
    const s = makeVillage();
    place(s, 'player', 'tav_cellar');
    place(s, 'trader', 'tav_cellar');
    s.player.core.condition.parts.left_leg = -30;
    const calls = rig();
    turn(s, intent(null, { type: 'hide' }));
    const [a, o] = calls.find(([, b]) => b.actorId === 'trader')!;
    expect(a.skill).toBe(SK.sneaking);
    // P14: darkness gives no help against a listener
    expect(a.modifiers).toEqual(o.skill === SK.eyesight ? [{ source: 'light', type: 'situational', value: 10 }] : []);
    expect(a.tierShifts).toEqual([{ source: 'cover', value: 1 }]);
    expect(a.roles).toEqual([]);
    const [, b] = calls.find(([, o]) => o.actorId === 'trader')!;
    expect(b.modifiers).toEqual(b.skill === SK.eyesight ? [{ source: 'light', type: 'situational', value: -10 }] : []); // ST21: sight is hurt
  });
  it('tags decide the tables (ST21): a sneak gets no cover, a vanish does (Vanishing has the hide tag)', () => {
    const s = makeVillage();
    place(s, 'player', 'tav_counter');
    place(s, 'trader', 'tav_cellar');
    s.player.posture = 'stealthy';
    const calls = rig();
    turn(s, intent({ toZone: 'tav_cellar' }, { type: 'sneak' }));
    expect(calls.find(([, b]) => b.actorId === 'trader')![0].tierShifts).toEqual([]);
    const v = makeVillage();
    place(v, 'player', 'tav_counter');
    place(v, 'trader', 'tav_cellar');
    const vc = rig();
    turn(v, intent({ toZone: 'tav_cellar' }, { type: 'vanish' }));
    expect(vc.find(([, b]) => b.actorId === 'trader')![0]).toMatchObject({ skill: SK.vanishing, tierShifts: [{ source: 'cover', value: 1 }] });
  });
  it('an observer with Unblinking who loses a Vanish must also lose a stealth contest (ST23)', () => {
    const s = makeVillage();
    place(s, 'player', 'gate_inner');
    aware(s, 'guard_1', 'gate_inner');
    s.actors.find((a) => a.id === 'guard_1')!.core.perks.push({ perkId: PK.unblinking } as never);
    const calls = rig({ guard_1: [-1, 0] });
    turn(s, intent({ toZone: 'street_square' }, { type: 'vanish' }));
    expect(calls.filter(([, b]) => b.actorId === 'guard_1').map(([a]) => a.skill)).toEqual([SK.vanishing, SK.sneaking]); // the slimes in the field see it too now
    expect(['aware', 'tracking']).toContain(status(s, 'guard_1'));
  });
});
