// W6 unit tests: validator (every Validation bullet), grades table, apply, fallback, trim, director.
// Other workstreams' functions are replaced with small local fakes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor, GameState, StagePlan } from '../../src/types';

vi.mock('../../src/minds', () => ({
  installRoutines: vi.fn((a: Actor, setId: string, slots: Record<string, string | string[]>, _s: string | undefined, turn: number) => {
    a.mind!.routineSetId = setId;
    a.mind!.slots = slots;
    a.mind!.routine = { id: setId, anchorTurn: turn };
  }),
  desiredState: vi.fn((v: { self: { zone: string } }) => ({ zone: v.self.zone, activity: 'rest' })),
}));
vi.mock('../../src/perception', () => ({
  updateBeliefs: vi.fn((s: GameState, u: { observerId: string; aboutId: string; status: 'aware'; zone?: string }) => {
    const a = s.actors.find((x) => x.id === u.observerId)!;
    a.mind!.knowledge[u.aboutId] = { status: u.status, lastKnownZone: u.zone, source: 'seen', revealed: [] };
  }),
  computePerception: vi.fn((e: { zone: string }, s: GameState) => (e.zone === s.player.zone ? { player: { level: 'full', cue: 'sight' } } : {})),
}));
vi.mock('../../src/views', () => ({
  buildActorView: vi.fn((s: GameState, id: string) => ({ self: { id, zone: s.actors.find((a) => a.id === id)!.zone } })),
  buildWeaverView: vi.fn(() => ({})),
}));

import { makeVillage, createRng } from '../harness';
import { CONFIG } from '../../src/config';
import { ruleset } from '../../src/ruleset';
import { updateBeliefs } from '../../src/perception';
import {
  applyFallbackStage, applyStagePlan, frontiersNearPlayer, gradesFitTier, SceneDirector, trimStage, validateStagePlan, type PlanContext,
} from '../../src/scene';
import { toStoryStart, villageStagePlan, VirtualClock, FITTING_GRADES } from '../../src/scene/fixtures';

const ctx: PlanContext = { tier: 0, kind: 'scene', placeId: 'tavern' };
const fresh = () => toStoryStart(makeVillage());
const codes = (s: GameState, p: StagePlan, c: PlanContext = ctx) => validateStagePlan(s, p, c).map((e) => e.code);

beforeEach(() => vi.clearAllMocks());

describe('gradesFitTier', () => {
  it('follows the table', () => {
    expect(gradesFitTier(-3, 'major', 'none')).toBe(true);
    expect(gradesFitTier(-3, 'moderate', 'none')).toBe(false);
    expect(gradesFitTier(-2, 'moderate', 'minor')).toBe(true);
    expect(gradesFitTier(-2, 'moderate', 'major')).toBe(false);
    expect(gradesFitTier(-1, 'minor', 'moderate')).toBe(true);
    expect(gradesFitTier(0, 'minor', 'major')).toBe(false);
    expect(gradesFitTier(0, 'none', 'none')).toBe(false);
    expect(gradesFitTier(1, 'extreme', 'major')).toBe(true);
    expect(gradesFitTier(1, 'major', 'moderate')).toBe(false);
    expect(gradesFitTier(2, 'extreme', 'extreme')).toBe(true);
    for (const [t, g] of Object.entries(FITTING_GRADES)) expect(gradesFitTier(+t, g.challenge, g.gain)).toBe(true);
  });
});

describe('validateStagePlan', () => {
  it('the village fixture plan is valid at story start', () => {
    expect(validateStagePlan(fresh(), villageStagePlan(), ctx)).toEqual([]);
  });
  it('unknown template and unknown creature type fail (not routine-only)', () => {
    const s = fresh();
    s.blueprints.push({ storyId: 'test', id: 'wyvern_rider', kind: 'npcTemplate', data: { id: 'wyvern_rider', creatureTypeId: 'wyvern' } });
    const p = villageStagePlan();
    p.cast[0].template = 'ogre';
    p.cast[1].template = 'wyvern_rider';
    const e = validateStagePlan(s, p, ctx);
    expect(e.map((x) => x.code)).toEqual(expect.arrayContaining(['unknown_template', 'unknown_creature_type']));
    expect(e.find((x) => x.code === 'unknown_creature_type')!.message).toContain('humanoid');
    expect(e.every((x) => !x.routineOnly)).toBe(true);
  });
  it('caps on cast, zones and knows', () => {
    const s = fresh();
    CONFIG.PLAN_CAPS.cast = 2;
    CONFIG.PLAN_CAPS.zones = 3;
    CONFIG.PLAN_CAPS.knows = 0;
    expect(codes(s, villageStagePlan()).filter((c) => c === 'cap_exceeded')).toHaveLength(3);
  });
  it('bands: missing, unresolved, bad stance', () => {
    const p = villageStagePlan();
    p.cast[0].band = '';
    p.cast[1].band = 'pirates';
    p.bands[0].relations = { ghosts: 'hostile' as never };
    p.cast[2].overrides = [{ actor: 'nobody', stance: 'friendly' }];
    expect(codes(fresh(), p)).toEqual(expect.arrayContaining(['missing_band', 'unresolved_band', 'bad_stance', 'unresolved_actor']));
  });
  it('links point to a plan zone, a stage zone or a frontier', () => {
    const p = villageStagePlan();
    p.zones[0].links.push({ to: 'nowhere', label: 'a door', sight: true });
    expect(codes(fresh(), p)).toContain('bad_link');
    // a stage zone and an existing frontier are fine
    const s = makeVillage();
    const ext: StagePlan = { ...villageStagePlan(), places: [], bands: [], cast: [], rewards: [], frontiers: [],
      zones: [{ key: 'grove', place: 'field', name: 'a grove', look: 'a quiet grove', cover: 1, light: 1, links: [{ to: 'field_far', label: 'back', sight: true }, { to: 'woods', label: 'deeper', sight: false }] }] };
    expect(validateStagePlan(s, ext, { ...ctx, kind: 'extension', frontierKey: 'woods', placeId: 'field' })).toEqual([]);
  });
  it('triggers: vocabulary and one order; secrets need leakTerms', () => {
    const p = villageStagePlan();
    p.seeds.triggers.push({ id: 't1', ownerId: 'guard_1', when: { type: 'moon_rises' } as never, then: { type: 'attack', target: '$player', skill: null, intent: 'x' }, once: true });
    p.seeds.triggers.push({ id: 't2', ownerId: 'guard_1', when: { type: 'alarm_heard' }, then: [{ type: 'attack' }, { type: 'move' }] as never, once: true });
    p.seeds.secrets.push({ id: 's1', holderId: 'barkeep', fact: 'x', leakTerms: [], revealWhen: { type: 'event_in_zone', kind: 'search', zone: 'tav_cellar' } });
    const c = codes(fresh(), p);
    expect(c.filter((x) => x === 'bad_trigger')).toHaveLength(2);
    expect(c).toContain('secret_without_leak_terms');
  });
  it('grades must fit the tier', () => {
    expect(codes(fresh(), villageStagePlan(), { ...ctx, tier: -2 })).toEqual(['grades_misfit']);
  });
  it('hidden terms and leak terms are scanned in every public field', () => {
    const p = villageStagePlan();
    p.hiddenTerms = ['nest', 'smugglers', 'tab']; // whole words: 'tab' does not match 'table' (V10)
    p.bands[0].name = 'the nest watch';
    p.cast[1].knows![0].text = 'Smugglers use the cellar.';
    p.rewards.push({ item: { base: 'arming_sword', quality: 1, boosts: 'hitAdj', name: 'nest blade', look: 'plain' }, place: { groundIn: 'tav_cellar' } });
    p.seeds.secrets.push({ id: 's1', holderId: 'barkeep', fact: 'x', leakTerms: ['kegs'], revealWhen: { type: 'event_in_zone', kind: 'search', zone: 'tav_cellar' } });
    const leaks = validateStagePlan(fresh(), p, ctx).filter((e) => e.code === 'public_leak').map((e) => e.message);
    expect(leaks.some((m) => m.includes('band village_watch name'))).toBe(true);
    expect(leaks.some((m) => m.includes('knows'))).toBe(true);
    expect(leaks.some((m) => m.includes('reward 1 name'))).toBe(true);
    expect(leaks.some((m) => m.includes('zone tav_counter look') && m.includes('kegs'))).toBe(true);
    // hidden fields are not scanned
    p.weaverNote = 'the nest';
    expect(validateStagePlan(fresh(), p, ctx).filter((e) => e.message.includes('weaverNote'))).toEqual([]);
  });
  it('free-text caps: public text over the cap fails, hidden-only notes are trimmed (V6)', () => {
    const p = villageStagePlan();
    p.weaverNote = 'word '.repeat(CONFIG.NOTE_CAP);
    p.cast[0].routineGap = 'y'.repeat(CONFIG.NOTE_CAP + 1);
    p.cast[0].label = 'z'.repeat(CONFIG.TEXT_CAP + 1);
    expect(codes(fresh(), p).filter((c) => c === 'text_too_long')).toHaveLength(1);
    expect(p.weaverNote.length).toBeLessThanOrEqual(CONFIG.NOTE_CAP);
    expect(p.weaverNote.endsWith('word')).toBe(true);
    expect(p.cast[0].routineGap).toHaveLength(CONFIG.NOTE_CAP);
  });
  it('fills defaults: trigger owner and once, top-level place, missing steps (V4, V5)', () => {
    const p = villageStagePlan();
    p.places[0].parent = null as unknown as string;
    p.seeds.plans.push({ ownerId: 'barkeep', goal: 'hide the kegs', steps: undefined as unknown as string[], createdTurn: 0,
      triggers: [{ id: 't1', when: { type: 'turn_reached', turn: 3 }, then: { type: 'hide', target: null, skill: null, intent: 'hide' } } as never] });
    expect(validateStagePlan(fresh(), p, ctx)).toEqual([]);
    const pl = p.seeds.plans.at(-1)!;
    expect(pl.steps).toEqual([]);
    expect(pl.triggers[0]).toMatchObject({ ownerId: 'barkeep', once: true });
    expect(p.places[0].parent).toBe('');
  });
  it('trigger orders and secret skills must exist; one route zone is fine (V9)', () => {
    const p = villageStagePlan();
    p.seeds.triggers.push({ id: 't2', ownerId: 'barkeep', when: { type: 'alarm_heard' }, then: { type: 'confront', target: null, skill: null, intent: 'x' }, once: true } as never);
    p.seeds.secrets.push({ id: 's9', holderId: 'barkeep', fact: 'x', leakTerms: ['ledger'], revealWhen: { type: 'check_passed', skill: 'insight', minTier: 0, againstActorId: 'barkeep' } });
    const m = validateStagePlan(fresh(), p, ctx).map((e) => e.message);
    expect(m.some((x) => x.includes('then.type confront unknown'))).toBe(true);
    expect(m.some((x) => x.includes('skill insight unknown'))).toBe(true);
  });
  it('rewards resolve; minted quality and count capped', () => {
    const p = villageStagePlan(); // moderate gain: quality 2 at most
    p.rewards.push({ item: 'excalibur', place: { carriedBy: 'barkeep' } });
    p.rewards.push({ item: { base: 'arming_sword', quality: 3, boosts: 'hitAdj', name: 'a fine sword', look: 'bright' }, place: { carriedBy: 'guard_1' } });
    p.rewards.push({ item: 'coin', place: { groundIn: 'woods' } });
    expect(codes(fresh(), p)).toEqual(expect.arrayContaining(['unresolved_item', 'minted_quality', 'bad_reward']));
    const q = villageStagePlan();
    for (let i = 0; i < 3; i++) q.rewards.push({ item: { base: 'arming_sword', quality: 1, boosts: 'damageAdj', name: 'a sword', look: 'plain' }, place: { carriedBy: 'guard_1' } });
    expect(codes(fresh(), q)).toEqual(['minted_cap']);
  });
  it('routine errors are routineOnly and name the cast entry', () => {
    const p = villageStagePlan();
    p.cast[0].routineSetId = 'juggler';
    p.cast[1].slots = { counter: 'tav_counter' };
    p.cast[2].slots = { seat: 'tav_common', refuge: 'tav_cellar', exit: 'street_door', bed: 'tav_cellar' };
    p.cast[3].slots = { route: [], post: 'field_far' };
    p.cast[4].slots = { route: ['field_far', 'field_mid'], post: 'woods' };
    p.cast[4].startAt = 'nap';
    const e = validateStagePlan(fresh(), p, ctx);
    expect(e.every((x) => x.routineOnly && x.castKey)).toBe(true);
    expect(e.map((x) => [x.castKey, x.code])).toEqual(expect.arrayContaining([
      ['guard_1', 'unresolved_set'], ['barkeep', 'missing_slot'], ['patron_1', 'invalid_slot'], ['slime_1', 'invalid_slot'],
      ['slime_2', 'frontier_binding'], ['slime_2', 'bad_start_at'],
    ]));
  });
  it('bound zones must reach each other', () => {
    const p = villageStagePlan();
    p.zones.push({ key: 'island', place: 'field', name: 'an island', look: 'reeds', cover: 0, light: 0, links: [] });
    p.cast[3].slots = { route: ['field_mid', 'field_far'], post: 'island' };
    expect(validateStagePlan(fresh(), p, ctx)).toEqual([expect.objectContaining({ code: 'unreachable_zone', castKey: 'slime_1', routineOnly: true })]);
  });
  it('player-band entries use the companion set and bind nothing', () => {
    const p = villageStagePlan();
    p.cast.push({ template: 'guard', key: 'squire', label: 'a squire', name: 'Tam', appearance: 'young', band: 'player_band', routineSetId: 'gate_guard', slots: { post: 'gate_inner' }, awarenessOfPlayer: 'aware', motive: 'loyal' });
    expect(codes(fresh(), p)).toEqual(['companion_set', 'invalid_slot']);
    p.cast[5].routineSetId = 'companion';
    p.cast[5].slots = {};
    expect(codes(fresh(), p)).toEqual([]);
  });
});

describe('applyStagePlan', () => {
  it('builds places, zones, frontiers, bands and cast with stable ids', () => {
    const s = fresh();
    applyStagePlan(s, villageStagePlan(), ctx, { entry: 'open' }, createRng(1));
    expect(s.places.map((p) => p.id)).toEqual(['village', 'tavern', 'street', 'field']);
    expect(s.places[1].parentId).toBe('village');
    expect(s.stage.zoneIds).toHaveLength(7);
    expect(s.zones.find((z) => z.id === 'field_far')!.links.find((l) => l.to === 'woods')).toEqual({ to: 'woods', label: 'into the woods', sight: false, frontier: true });
    expect(s.player.zone).toBe('tav_common');
    expect(s.bands.map((b) => b.id)).toEqual(['player_band', 'village_watch', 'tavern_folk', 'slimes']);
    expect(s.actors.map((a) => [a.id, a.zone, a.placeId, a.bandId])).toEqual([
      ['guard_1', 'gate_inner', 'street', 'village_watch'], ['barkeep', 'tav_counter', 'tavern', 'tavern_folk'],
      ['patron_1', 'tav_common', 'tavern', 'tavern_folk'], ['slime_1', 'field_mid', 'field', 'slimes'], ['slime_2', 'field_far', 'field', 'slimes'],
    ]);
    const mags = s.actors[1];
    expect(mags.names.current).toBe('Mags');
    expect(mags.knownOnSight).toBe(true);
    expect(mags.mind!.knows).toHaveLength(1);
    expect(mags.core.inventory.find((i) => i.itemId === 'coin')!.qty).toBe(5);
    expect(s.hidden.stage).toEqual({ eventSummary: villageStagePlan().event.summary, challenge: 'moderate', gain: 'moderate', hiddenTerms: ['nest'] });
    expect(s.hidden.castNotes!.guard_1.motive).toContain('harvest');
    expect(s.hidden.memory).toEqual({});
  });
  it('opening beliefs go through updateBeliefs on open entry only; band beliefs always', () => {
    const p = villageStagePlan();
    p.cast[0].awarenessOfBands = [{ band: 'slimes', awareness: 'suspicious' }];
    const s = fresh();
    applyStagePlan(s, p, ctx, { entry: 'sneaking' }, createRng(1));
    const calls = vi.mocked(updateBeliefs).mock.calls.map((c) => c[1]);
    expect(calls).toEqual([
      expect.objectContaining({ kind: 'opening', observerId: 'guard_1', aboutId: 'slime_1', status: 'suspicious', zone: 'field_mid' }),
      expect.objectContaining({ kind: 'opening', observerId: 'guard_1', aboutId: 'slime_2', status: 'suspicious', zone: 'field_far' }),
    ]);
    vi.clearAllMocks();
    applyStagePlan(fresh(), villageStagePlan(), ctx, { entry: 'open' }, createRng(1));
    expect(vi.mocked(updateBeliefs).mock.calls.map((c) => { const u = c[1] as { observerId: string; status: string }; return [u.observerId, u.status]; })).toEqual([
      ['guard_1', 'unaware'], ['barkeep', 'aware'], ['patron_1', 'suspicious'], ['slime_1', 'unaware'], ['slime_2', 'unaware'],
    ]);
  });
  it('seeds resolve keys; minted rewards become story blueprints', () => {
    const p = villageStagePlan();
    p.seeds.plans.push({ ownerId: 'guard_1', goal: 'catch the thief', steps: ['watch'], triggers: [], createdTurn: 99 });
    p.seeds.triggers.push({ id: 't1', ownerId: 'patron_1', when: { type: 'player_seen_in_zone', zone: 'tav_cellar' }, then: { type: 'call_help', target: 'barkeep', skill: null, intent: 'shout' }, once: true });
    p.seeds.secrets.push({ id: 's1', holderId: 'barkeep', fact: 'owes money', leakTerms: ['debt'], revealWhen: { type: 'check_passed', skill: 'persuasion', minTier: 0, againstActorId: 'barkeep' } });
    p.rewards.push({ item: { base: 'arming_sword', quality: 2, boosts: 'hitAdj', name: 'Wim\'s old blade', look: 'a notched sword' }, place: { groundIn: 'tav_cellar' } });
    const s = fresh();
    applyStagePlan(s, p, ctx, { entry: 'open' }, createRng(1));
    expect(s.hidden.plans.guard_1.createdTurn).toBe(0);
    expect(s.hidden.plans.patron_1.triggers[0].then.target).toBe('barkeep');
    expect(s.hidden.secrets[0].holderId).toBe('barkeep');
    const bp = s.blueprints.find((b) => b.kind === 'item')!;
    expect((bp.data as { name: string }).name).toBe("Wim's old blade");
    expect((bp.data as { weapon: { modes: { hitAdj: number }[] } }).weapon.modes[0].hitAdj).toBe(CONFIG.QUALITY_TABLE.hitAdj[1]);
    expect(s.zones.find((z) => z.id === 'tav_cellar')!.groundItems[0].itemId).toBe(bp.id);
    expect(s.sceneCaps.minted).toBe(1);
  });
  it('keys that collide with existing ids get fresh ids; existing bands keep lethal', () => {
    const s = makeVillage();
    const ext: StagePlan = { ...villageStagePlan(), places: [], rewards: [], frontiers: [],
      bands: [{ key: 'slimes', name: 'woods slimes', goals: '', temperament: '', tacticsLevel: 1, lethal: undefined as never, relations: { player_band: 'opposed' } }],
      zones: [{ key: 'field_mid', place: 'field', name: 'a grove', look: 'a quiet grove', cover: 1, light: 1, links: [{ to: 'field_far', label: 'back', sight: true }] }],
      cast: [{ template: 'slime', key: 'slime_1', label: 'a slime', name: 'slime', appearance: 'green', band: 'slimes', routineSetId: 'slime_wander', slots: { route: ['field_mid', 'field_far'], post: 'field_mid' }, awarenessOfPlayer: 'unaware', motive: '' }] };
    applyStagePlan(s, ext, { tier: 0, kind: 'extension', frontierKey: 'woods', placeId: 'field' }, { entry: 'open' }, createRng(1));
    expect(s.stage.zoneIds).toContain('field_mid_2');
    expect(s.bands.find((b) => b.id === 'slimes_2')!.lethal).toBe(true);
    const a = s.actors.find((x) => x.id === 'slime_1_2')!;
    expect(a.mind!.slots).toEqual({ route: ['field_mid_2', 'field_far'], post: 'field_mid_2' });
    // the crossed frontier now leads to the entry zone, with a way back, and the player stands there
    expect(s.zones.find((z) => z.id === 'field_far')!.links.find((l) => l.label === 'into the woods')).toEqual({ to: 'field_mid_2', label: 'into the woods', sight: false });
    expect(s.player.zone).toBe('field_mid_2');
  });
  it('degrade: routine-error actors get idle_here; four flags', () => {
    const p = villageStagePlan();
    p.cast[3].slots = { post: 'field_far' };
    const s = fresh();
    const errs = validateStagePlan(s, p, ctx);
    applyStagePlan(s, p, ctx, { entry: 'open', degrade: errs }, createRng(1));
    const slime = s.actors.find((a) => a.id === 'slime_1')!;
    expect(slime.mind!.routine).toEqual({ id: 'idle_here', anchorTurn: 0 });
    expect(slime.mind!.slots).toEqual({ here: 'field_far' });
    expect(s.actors.find((a) => a.id === 'slime_2')!.mind!.routine!.id).toBe('slime_wander');
    expect(s.stage.fallback).toEqual({ reason: 'routine_fallback', turn: 0 });
    expect(s.stage.routineFallback).toEqual({ actors: ['slime_1'], turn: 0 });
    expect(s.log.find((l) => l.code === 'routine_fallback')!.detail!.errors).toHaveLength(errs.length);
  });
});

describe('applyFallbackStage', () => {
  it('scene: the place\'s saved zones, grades none/none, flagged', () => {
    const s = makeVillage();
    s.stage.zoneIds = [];
    s.zones = [];
    applyFallbackStage(s, { tier: 0, kind: 'scene', placeId: 'tavern' }, 'invalid_plan', [{ code: 'x', message: 'y', routineOnly: false }]);
    expect(s.stage.zoneIds).toEqual(['tav_common', 'tav_counter', 'tav_cellar']);
    expect(s.hidden.stage.challenge).toBe('none');
    expect(s.stage.fallback).toEqual({ reason: 'invalid_plan', turn: 1 });
    expect(s.log[0]).toMatchObject({ code: 'weaver_fallback', detail: { errors: [{ code: 'x' }] } });
  });
  it('extension: one empty zone named by the frontier label, no cast', () => {
    const s = makeVillage({ playerZone: 'field_far' });
    const n = s.actors.length;
    applyFallbackStage(s, { tier: 0, kind: 'extension', frontierKey: 'woods', placeId: 'field' }, 'call_failed', []);
    const z = s.zones.find((x) => x.id === 'woods')!;
    expect(z.name).toBe('into the woods');
    expect(z.links).toEqual([{ to: 'field_far', label: 'far side of the field', sight: false }]);
    expect(s.player.zone).toBe('woods');
    expect(s.actors).toHaveLength(n);
    expect(s.stage.fallback!.reason).toBe('call_failed');
  });
  it('story start with no place yet still gets a zone', () => {
    const s = fresh();
    applyFallbackStage(s, ctx, 'weaver_timeout', []);
    expect(s.stage.zoneIds).toEqual(['tavern_area']);
    expect(s.player.zone).toBe('tavern_area');
  });
});

describe('stage', () => {
  it('frontiersNearPlayer and trimStage', () => {
    const s = makeVillage({ playerZone: 'field_far' });
    expect(frontiersNearPlayer(s)).toEqual(['woods']);
    s.player.zone = 'tav_common';
    expect(frontiersNearPlayer(s)).toEqual([]);
    CONFIG.MAX_STAGE_ZONES = 6;
    trimStage(s);
    expect(s.stage.zoneIds.sort()).toEqual(['gate_inner', 'street_door', 'street_square', 'tav_cellar', 'tav_common', 'tav_counter']);
    expect(s.zones.find((z) => z.id === 'gate_inner')!.links.find((l) => l.to === 'field_edge')!.frontier).toBe(true);
  });
  it('trim keeps zones with engaged actors', () => {
    const s = makeVillage();
    const slime = s.actors.find((a) => a.id === 'slime_1')!;
    slime.zone = 'field_far';
    slime.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [] };
    CONFIG.MAX_STAGE_ZONES = 6;
    trimStage(s);
    expect(s.stage.zoneIds).toContain('field_far');
    expect(s.stage.zoneIds).toHaveLength(6);
  });
});

describe('SceneDirector', () => {
  const situation = (tier: number) => vi.spyOn(ruleset, 'situation').mockReturnValue({ actorId: 'player', roll: 50, tier, modifiers: [] });

  it('scene start: one roll, repair retry with errors, then applies', async () => {
    situation(-2);
    const bad = villageStagePlan(0);
    const good = villageStagePlan(-2);
    const weave = vi.fn().mockResolvedValueOnce(bad).mockResolvedValueOnce(good);
    const d = new SceneDirector({ weave, clock: new VirtualClock() });
    const s = fresh();
    const r = await d.storyStart(s, createRng(1));
    expect(r.outcome).toBe('applied');
    expect(ruleset.situation).toHaveBeenCalledTimes(1);
    expect(weave).toHaveBeenCalledTimes(2);
    expect(weave.mock.calls[1][1]).toEqual([expect.objectContaining({ code: 'grades_misfit' })]);
    expect(s.turn).toBe(0);
    expect(s.stage).toMatchObject({ tier: -2, sceneNumber: 1, sceneStartTurn: 0 });
    expect(r.events.map((e) => e.kind)).toEqual(['arrival', 'presence']);
    expect(r.situation!.tier).toBe(-2);
  });
  it('scene start past WEAVER_TIMEOUT gives the fallback', async () => {
    situation(0);
    const clock = new VirtualClock();
    const weave = vi.fn(() => clock.sleep(CONFIG.WEAVER_TIMEOUT_MS + 1).then(() => villageStagePlan()));
    const d = new SceneDirector({ weave, clock });
    const s = fresh();
    const p = d.startScene(s, createRng(1));
    await clock.advance(CONFIG.WEAVER_TIMEOUT_MS);
    const r = await p;
    expect(r.outcome).toBe('fallback');
    expect(s.stage.fallback!.reason).toBe('weaver_timeout');
  });
  it('background extension is held, waited for and reused; never re-rolled', async () => {
    const clock = new VirtualClock();
    const s = makeVillage({ playerZone: 'field_far' });
    const ext: StagePlan = { ...villageStagePlan(), places: [], bands: [], cast: [], rewards: [], frontiers: [],
      zones: [{ key: 'grove', place: 'field', name: 'a grove', look: 'a quiet grove', cover: 1, light: 1, links: [{ to: 'field_far', label: 'back', sight: true }] }] };
    const weave = vi.fn(() => clock.sleep(5000).then(() => ext));
    const spy = vi.spyOn(ruleset, 'situation');
    const d = new SceneDirector({ weave, clock });
    expect(d.afterSave(s)).toEqual(['woods']);
    expect(d.afterSave(s)).toEqual([]);
    expect(s.stage.zoneIds).not.toContain('grove');
    const crossing = d.cross(s, 'woods', createRng(1));
    await clock.advance(5000);
    const r = await crossing;
    expect(r.outcome).toBe('applied');
    expect(s.player.zone).toBe('grove');
    expect(weave).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
    // undo: the restored state crosses again with the held extension
    const s2 = makeVillage({ playerZone: 'field_far' });
    expect((await d.cross(s2, 'woods', createRng(1))).outcome).toBe('applied');
    expect(weave).toHaveBeenCalledTimes(1);
  });
  afterEach(() => vi.restoreAllMocks());
});
