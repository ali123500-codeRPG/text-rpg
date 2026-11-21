// 189 SD3–SD5, BA2–BA8: barriers on ways. One record per barrier serves both sides. A locked door stops a walker without
// its key (trying it shows it is locked); a key turns on the way through in a move slot; a bar slides back only from the
// bolt's side; rubble passes no one; code minds path round what is shut to them. Lock picking is a Lockpicking function roll
// (Thievery) at the lock's grade. The Weaver puts barriers on links and hands out keys; the GM view counts them per tier.
import { describe, expect, it } from 'vitest';
import type { Barrier, GameState, Intent, StagePlan } from '../../src/types';
import { byDoor, createRng, forcedRng, makeVillage, putBarrier } from '../harness';
import { withWays } from '../harness/village';
import { waysOut, wayTo } from '../../src/plan/where';
import { resolveTurn } from '../../src/engine';
import { shortestPath, zoneById } from '../../src/engine/relations';
import { buildActorView, buildNarrationView, buildPlayerView, buildWeaverView } from '../../src/views';
import { placeOf, walkRoute } from '../../src/engine/position';
import { pickSeconds } from '../../src/ruleset';
import { fnRoller } from '../../src/ruleset/gear';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';
import { FN } from '../../src/library/functionIds';
import { IT } from '../../src/library/itemIds';
import { BK, DU } from '../../src/library/tableIds';
import { getLibrary } from '../../src/library';
import { BT } from '../../src/library/raceIds';
import { checkIntent, checkStagePlan } from '../../src/agents/schema';
import { validateStagePlan } from '../../src/scenario/validate';
import { applyStagePlan } from '../../src/scenario/apply';

const quiet = (zone = 'tav_common', hatch = false) => makeVillage({ playerZone: zone, without: ['slime_1', 'slime_2', 'guard_1', 'patron_1'], ...(hatch ? { shape: HATCH } : {}) });
/** a second way out of the tavern: a hatch up from the cellar into the square */
const HATCH = {
  tav_cellar: withWays('tav_cellar', { to: 'street_square', label: 'the cellar hatch', kind: 'up' }),
  street_square: withWays('street_square', { to: 'tav_cellar', label: 'the cellar hatch', kind: 'down' }),
};
/** the street outside the tavern, half a metre from its front door, within grip reach of it */
const atDoor = () => { const s = quiet('street_door'); byDoor(s, 'player', 'street_door', 'tav_common', 0.5); return s; };
/** a barrier on the way between zones a and b, on both links */
function put(s: GameState, a: string, b: string, extra: Partial<Barrier> = {}): Barrier {
  return putBarrier(s, a, b, { id: 'front_door', kind: BK.door, grade: 'minor', ...extra });
}
const intent = (p: Partial<Intent>): Intent => ({ move: null, gear: null, spoken: null, addressees: null, deferred: [], clarify: null, action: null, ...p });
const go = (to: string): Intent => intent({ move: { toZone: to } });
const pick = (to: string): Intent => intent({ action: { type: 'pick', skill: '', target: to, targetPart: null, item: null, mode: null, approach: '' } });
const turn = (s: GameState, i: Intent, rng = createRng(1)) => { s.turn += 1; return resolveTurn(s, { intent: i, aimed: false, agentOutputs: [], spokespeople: [] }, rng); };
/** the pick roll's d100, after the initiative roll */
const d = (n: number) => forcedRng([50, n]);
const giveKey = (s: GameState, b: Barrier, who = s.player) => who.core.inventory.push({ id: `key_${who.id}`, itemId: IT.key, opens: [b.id] });

describe('189 barriers on ways (SD3–SD5, BA2–BA8)', () => {
  it('BA2: Filching holds the Lockpicking function, and lockpicks help it; picking time halves per 25 points, past 100 too, unless capped', () => {
    const s = quiet();
    s.player.core.skills[SK.filching] = { raw: 40, state: 'normal' };
    expect(fnRoller(s, s.player, FN.lockpicking)).toBe(SK.filching);
    expect(pickSeconds(50)).toBe(30);
    expect(pickSeconds(75)).toBe(15);
    expect(pickSeconds(25)).toBe(60);
    // scaling: picking time keeps halving per 25 points past 100, and a cap would stop it
    expect(pickSeconds(100)).toBe(7.5);
    expect(pickSeconds(150)).toBe(1.875);
    expect(pickSeconds(200)).toBe(0.46875);
    const speed = getLibrary().durations![DU.pick_lock].speed!; // the row's speed function carries the cap
    speed.fastCap = 100;
    expect(pickSeconds(200)).toBe(7.5);
    speed.fastCap = null;
  });
  it('a locked door stops a walker without its key: trying it shows it locked; with the key (BA3) the walk unlocks it and goes through', () => {
    const s = quiet();
    const b = put(s, 'tav_common', 'street_door', { lock: { locked: true } });
    expect(buildPlayerView(s).zone.links.find((l) => l.to === 'street_door')!.way).toEqual({ kind: 'door' }); // a shut door looks like any door
    const ev = turn(s, go('street_door'));
    expect(s.player.zone).toBe('tav_common');
    expect(ev.find((e) => e.kind === 'way')!.way).toMatchObject({ did: 'found_locked', to: 'street_door' });
    expect(b.tried).toContain('player');
    expect(buildPlayerView(s).zone.links.find((l) => l.to === 'street_door')!.way).toMatchObject({ locked: true });
    const nv = buildNarrationView(s, ev);
    expect(nv.events.find((e) => e.kind === 'way')!.way).toMatchObject({ what: 'door', did: 'tried it: locked' });
    // BA3: with the key it turns on the way through, in the move slot; outside a fight the walk goes on through it (AT45)
    giveKey(s, b);
    expect(buildPlayerView(s).zone.links.find((l) => l.to === 'street_door')!.way).toMatchObject({ locked: true, key: true });
    const ev2 = turn(s, go('street_door'));
    expect(ev2.find((e) => e.kind === 'way')!.way!.did).toBe('unlocked');
    expect(b.lock!.locked).toBe(false);
    expect(s.player.zone).toBe('street_door');
  });
  it('BA3: locking it again with the key takes the move', () => {
    const s = atDoor();
    const b = put(s, 'tav_common', 'street_door', { lock: { locked: false } });
    giveKey(s, b);
    const ev = turn(s, intent({ way: { toZone: 'tav_common', op: 'lock' } }));
    expect(b.lock!.locked).toBe(true);
    expect(ev.find((e) => e.kind === 'way')!.way!.did).toBe('lock');
    const none = atDoor();
    const nb = put(none, 'tav_common', 'street_door', { lock: { locked: false } });
    turn(none, intent({ way: { toZone: 'tav_common', op: 'lock' } }));
    expect(nb.lock!.locked).toBe(false); // no key, no lock
  });
  it('BG-54: a way op that cannot be done (a plain hatch "unbarred") leaves the move to happen', () => {
    const s = atDoor();
    put(s, 'tav_common', 'street_door', { kind: BK.hatch });
    turn(s, intent({ move: { toZone: 'tav_common' }, way: { toZone: 'tav_common', op: 'unbar' } }));
    expect(s.player.zone).toBe('tav_common');
    expect(s.log.some((l) => l.code === 'way_op_dropped')).toBe(true);
  });
  it('BA4: a bar slides back only from the bolt\'s side', () => {
    const inside = quiet();
    const b = put(inside, 'tav_common', 'street_door', { bar: { side: 'tav_common', drawn: true } });
    expect(turn(inside, go('street_door')).find((e) => e.kind === 'way')!.way!.did).toBe('unbarred');
    expect(b.bar!.drawn).toBe(false); // from the far side it is found barred: BG-69 below
  });
  it('a walk goes round a shut way when there is another, and rubble passes no one', () => {
    const s = quiet(undefined, true);
    put(s, 'tav_common', 'street_door', { kind: BK.rubble, blocked: true });
    expect(shortestPath(s, 'tav_common', 'street_door', false, s.player)).toEqual(['tav_counter', 'tav_cellar', 'street_square', 'street_door']);
    expect(shortestPath(s, 'tav_common', 'street_door')).toEqual(['street_door']); // sound and distance ignore it
    giveKey(s, s.barriers!.front_door);
    expect(shortestPath(s, 'tav_common', 'street_door', false, s.player)?.[0]).toBe('tav_counter'); // no key opens rubble
  });
  it('BG-70: a door opened to look in stands open: seen through without going in, and shut again', () => {
    const s = atDoor();
    const b = put(s, 'tav_common', 'street_door');
    expect(buildPlayerView(s).zones.map((z) => z.id)).not.toContain('tav_common');
    const ev = turn(s, intent({ way: { toZone: 'tav_common', op: 'open' } }));
    expect(ev.find((e) => e.kind === 'way')!.way).toMatchObject({ did: 'open', barrier: b.id });
    expect(s.player.zone).toBe('street_door');
    expect(b.open).toBe(true);
    const v = buildPlayerView(s);
    expect(v.zones.map((z) => z.id)).toContain('tav_common');
    expect(v.zone.links.find((l) => l.to === 'tav_common')).toMatchObject({ sight: true, way: { open: true } });
    expect(buildNarrationView(s, ev).events.find((e) => e.kind === 'way')!.way!.did).toBe('opened it and left it standing open');
    turn(s, intent({ way: { toZone: 'tav_common', op: 'shut' } }));
    expect(b.open).toBeUndefined();
    expect(buildPlayerView(s).zones.map((z) => z.id)).not.toContain('tav_common');
  });
  it('BG-70: opening a door locked against you is trying it: you learn it is locked', () => {
    const s = atDoor();
    const b = put(s, 'tav_common', 'street_door', { lock: { locked: true } });
    const ev = turn(s, intent({ way: { toZone: 'tav_common', op: 'open' } }));
    expect(ev.find((e) => e.kind === 'way')!.way!.did).toBe('found_locked');
    expect(b.open).toBeUndefined();
    expect(b.tried).toContain('player');
    giveKey(s, b);
    turn(s, intent({ way: { toZone: 'tav_common', op: 'open' } }));
    expect(b).toMatchObject({ open: true, lock: { locked: false } });
  });
  it('BG-69: the player walks to a door barred out of sight and tries it, never round it unseen; once tried, round it', () => {
    const s = quiet('street_door', true);
    const b = put(s, 'tav_common', 'street_door', { bar: { side: 'tav_common', drawn: true } });
    expect(shortestPath(s, 'street_door', 'tav_common', false, s.player)).toEqual(['tav_common']);
    const ev = turn(s, go('tav_common'));
    expect(ev.find((e) => e.kind === 'way')!.way).toMatchObject({ did: 'found_barred', barrier: b.id });
    expect(s.player.zone).toBe('street_door');
    expect(shortestPath(s, 'street_door', 'tav_common', false, s.player)?.[0]).toBe('street_square');
  });
  it('FR5: an NPC knows the bolts of a place it lives or works in; a visitor learns by trying, as the player does', () => {
    const s = quiet('street_door', true);
    const b = put(s, 'tav_common', 'street_door', { bar: { side: 'tav_common', drawn: true } });
    const npc = s.actors.find((a) => a.id === 'trader')!;
    npc.mind = { ...npc.mind!, slots: { post: 'gate_inner' } }; // works somewhere else: a visitor here
    expect(shortestPath(s, 'street_door', 'tav_common', false, npc)).toEqual(['tav_common']);
    npc.mind.slots = { post: 'street_door' }; // works on this street: knows the door is barred
    expect(shortestPath(s, 'street_door', 'tav_common', false, npc)?.[0]).toBe('street_square');
    npc.mind.slots = {};
    b.tried = [npc.id]; // tried it
    expect(shortestPath(s, 'street_door', 'tav_common', false, npc)?.[0]).toBe('street_square');
  });
  it('BA7: a broken barrier: Destroyed opens to all, Crippled lets an amorphous body through', () => {
    const s = quiet();
    const b = put(s, 'tav_common', 'street_door', { lock: { locked: true }, state: 'crippled', tried: ['player'] }); // BG-69: known shut
    expect(shortestPath(s, 'tav_common', 'street_door', false, s.player)).toBeNull();
    s.player.core.bodyTypeId = BT.amorphous;
    expect(shortestPath(s, 'tav_common', 'street_door', false, s.player)).toEqual(['street_door']);
    s.player.core.bodyTypeId = 'BT1';
    b.state = 'destroyed';
    expect(shortestPath(s, 'tav_common', 'street_door', false, s.player)).toEqual(['street_door']);
  });
  it('BA7: code minds path round a way shut to them; holding the key they go through', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const b = put(s, 'tav_counter', 'tav_cellar', { lock: { locked: true } });
    const v = buildActorView(s, 'trader');
    expect(v.map.find((z) => z.id === 'tav_counter')!.links.find((l) => l.to === 'tav_cellar')).toMatchObject({ shut: true });
    const trader = s.actors.find((a) => a.id === 'trader')!;
    // BG-1614: a code mind's walk (views/ways.ts) goes round the ways it knows are shut, never through them
    expect(walkRoute(s, placeOf(trader), { zone: 'tav_cellar' }, trader, true)).toBeNull();
    giveKey(s, b, trader);
    expect(walkRoute(s, placeOf(trader), { zone: 'tav_cellar' }, trader, true)?.path).toEqual(['tav_cellar']);
  });
  describe('BA2 picking a lock', () => {
    // alone, so the turn's only other d100 is the player's initiative
    const setup = (grade: Barrier['grade'] = 'minor') => {
      const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'patron_1', 'trader'] });
      s.player.core.skills[SK.filching] = { raw: 50, state: 'normal' };
      const b = put(s, 'tav_common', 'street_door', { grade, lock: { locked: true } });
      return { s, b };
    };
    it('Success opens it, and out of a fight the picking time passes', () => {
      const { s, b } = setup();
      const t0 = s.clocks.time ?? 0;
      const ev = turn(s, pick('street_door'), d(70));
      expect(ev.find((e) => e.kind === 'pick')!.way!.did).toBe('picked');
      expect(b.lock!.locked).toBe(false);
      expect(ev.find((e) => e.kind === 'pick')!.noise).toBe('hushed');
      expect(ev.find((e) => e.kind === 'pick')!.visibility).toBe('slight'); // the pick itself is made out only up close
      expect((s.clocks.time ?? 0) - t0).toBeGreaterThanOrEqual(1); // at least the turn; 60 s at skill 50
    });
    it('Near Miss: not yet; Failure: beyond the picker until its skill is higher', () => {
      const { s, b } = setup('moderate'); // OD10 a: Moderate is +0, so Near Miss is d100 14-38 at 50
      expect(turn(s, pick('street_door'), d(30)).find((e) => e.kind === 'pick')!.way!.did).toBe('not_yet');
      expect(turn(s, pick('street_door'), d(12)).find((e) => e.kind === 'pick')!.way!.did).toBe('beyond');
      expect(b.beyond?.player).toBeDefined();
      expect(turn(s, pick('street_door'), d(99)).find((e) => e.kind === 'pick')!.way!.did).toBe('beyond'); // no roll
      s.player.core.skills[SK.filching] = { raw: 60, state: 'normal' };
      expect(turn(s, pick('street_door'), d(95)).find((e) => e.kind === 'pick')!.way!.did).toBe('picked');
      expect(b.lock!.locked).toBe(false);
    });
    it('Critical Failure snaps the pick: the lockpicks used are lost', () => {
      const { s } = setup('extreme');
      s.player.core.inventory.push({ id: 'picks', itemId: IT.lockpicks, equippedIn: ['grip:right_hand'] });
      const ev = turn(s, pick('street_door'), d(1));
      expect(ev.find((e) => e.kind === 'pick')!.way!.did).toBe('pick_broke');
      expect(s.player.core.inventory.some((i) => i.id === 'picks')).toBe(false);
    });
    it('in a fight, work builds a fight turn at a time until the time is done', () => {
      const { s, b } = setup();
      s.mode = 'tactical';
      expect(turn(s, pick('street_door'), d(70)).find((e) => e.kind === 'pick')!.way!.did).toBe('picking');
      expect(b.work?.player).toBeGreaterThan(0);
      expect(b.lock!.locked).toBe(true);
    });
    it('the Parser may say pick and way', () => {
      expect(checkIntent(pick('street_door')).value.action?.type).toBe('pick');
      expect(checkIntent(intent({ way: { toZone: 'z', op: 'bar' } })).value.way).toEqual({ toZone: 'z', op: 'bar' });
    });
  });
  describe('the Weaver puts barriers on ways', () => {
    const plan = (barrier: object, drop = false): StagePlan => ({
      event: { summary: 's', challenge: 'minor', gain: 'minor' }, places: [], frontiers: [], bands: [], rewards: [], hiddenTerms: [], weaverNote: '',
      zones: [{ key: 'shed', place: 'street', kind: 'ZK1', name: 'the shed', look: 'a shed', ways: [{ to: 'street_square', label: 'the shed door', kind: drop ? 'window' : 'door', barrier: barrier as never }] }],
      cast: [], seeds: { plans: [], triggers: [], secrets: [] },
    });
    it('one record for both sides, keys handed to the holders it names', () => {
      const s = quiet();
      const p = plan({ kind: BK.door, grade: 'major', locked: true, keys: ['trader'] });
      expect(checkStagePlan(p).value.zones[0].ways[0].barrier).toMatchObject({ kind: BK.door, locked: true });
      expect(validateStagePlan(s, p, { kind: 'extension', tier: 'success', placeId: 'street' }).filter((e) => !e.repaired)).toEqual([]);
      applyStagePlan(s, p, { kind: 'extension', tier: 'success', placeId: 'street' }, { entry: 'open' }, createRng(1));
      const shed = s.zones.find((z) => z.name === 'the shed')!;
      const id = wayTo(s, shed.id, 'street_square')!.barrier!;
      expect(s.barriers![id]).toMatchObject({ kind: BK.door, grade: 'major', lock: { locked: true } });
      expect(wayTo(s, 'street_square', shed.id)!.barrier).toBe(id);
      expect(s.actors.find((a) => a.id === 'trader')!.core.inventory.find((i) => i.itemId === IT.key)!.opens).toEqual([id]);
      expect(buildWeaverView(s, { kind: 'scenario', placeId: 'street' }).places.flatMap((p) => p.areas).find((z) => z.id === shed.id)!.links[0].way).toMatchObject({ kind: 'door', grade: 'major', lock: 'locked' });
    });
    it('a bad barrier is refused: an unknown kind, a bolt on neither side, a lock on rubble, shutters off a drop or another barrier on one (PC3)', () => {
      const s = quiet();
      const errs = (b: object, drop = false) => validateStagePlan(s, plan(b, drop), { kind: 'extension', tier: 'success', placeId: 'street' }).filter((e) => !e.repaired).map((e) => e.message).join(' ');
      expect(errs({ kind: 'BK99' })).toMatch(/barrier kind id/);
      expect(errs({ kind: BK.gate, barredFrom: 'tav_cellar' })).toMatch(/barredFrom/);
      expect(errs({ kind: BK.rubble, locked: true })).toMatch(/takes no lock/);
      // PC3: a window's shutters go only on a drop, and a drop takes no other barrier
      expect(errs({ kind: BK.window, locked: true }, true)).toBe('');
      expect(errs({ kind: BK.window }, false)).toMatch(/goes only on a drop/);
      expect(errs({ kind: BK.door }, true)).toMatch(/a barrier on a drop is a window/);
    });
  });
});

