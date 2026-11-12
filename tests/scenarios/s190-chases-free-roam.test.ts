// 190 Chases and free roam (SC16-SC19, SC23, SD2 a; CH1-CH7). A scene's ground; leaving it with no one chasing ends the
// scene as left and free roam starts; in free roam talk, trade, a fight, a hostile spotting you or a quest goal starts a new
// scene, and an unbuilt frontier starts one there; pursuers keep to their chase range, follow through a frontier only at
// range far (code-run), and lose the player after CHASE_LOST_TURNS turns unseen. Also the SD1 ending moment after resolveTurn.
import { describe, expect, it, vi } from 'vitest';
import type { GameEvent, GameState, WeaverView } from '../../src/types';
import { actor, createRng, makeVillage, place } from '../harness';
import { play } from './w4-kit';
import { checkSceneEnd, closeScene, frameOf, pendingEnding } from '../../src/engine/sceneEnd';
import { CHASE_LOST_MEMORY, chaseRange, chaseZones, checkRoam, noteCrossing, pursuers, roamStart, updateChase } from '../../src/engine/chase';
import { applyStagePlan } from '../../src/scene/apply';
import { SceneDirector, validateStagePlan } from '../../src/scene';
import { grovePlan, VirtualClock } from '../../src/scene/fixtures';
import { MILL_PLAN } from './scene-director';
import { buildActorView } from '../../src/views';
import { fallbackOrder } from '../../src/minds';
import { triggerHolds } from '../../src/engine/triggers';
import { TIERS } from '../../src/scales';
import { CONFIG } from '../../src/config';
import { TP } from '../../src/library/templateIds';

/** a running scene whose ground is `ground` (no endings of its own) */
const scene = (s: GameState, ground: string[]) => {
  s.stage.scene = { ...frameOf(s, { question: 'q', scale: 'situation', endings: [] }, 'success', (_k, r) => r), ground };
  return s.stage.scene;
};
/** `id` hunts the player, last seen at `turn` in `zone` */
const hunts = (s: GameState, id: string, turn: number, zone = s.player.zone) => {
  const a = actor(s, id);
  a.mind!.overrides = { ...(a.mind!.overrides ?? {}), player: 'hostile' };
  a.mind!.knowledge.player = { status: 'hunting', lastKnownZone: zone, lastSeenTurn: turn, source: 'seen', revealed: [] };
  return a;
};
const ev = (s: GameState, e: Partial<GameEvent>): GameEvent => ({ id: `e${Math.random()}`, turn: s.turn, actorId: 'player', kind: 'idle', zone: s.player.zone, effects: [], noise: 'normal', visibility: 'normal', perception: {}, ...e } as GameEvent);

describe('190 chases and free roam', () => {
  it('CH1: a scene plan\'s ground is the start zone, the zones it builds and the stage zones it names; an extension adds to it', () => {
    const s = makeVillage({ playerZone: 'field_edge' });
    applyStagePlan(s, { ...MILL_PLAN, event: { ...MILL_PLAN.event, challenge: 'moderate', gain: 'moderate' } }, { kind: 'scene', tier: 'success', placeId: 'field' }, { entry: 'open' }, createRng(1));
    expect(s.stage.scene!.ground).toEqual(['field_edge', 'mill_yard', 'mill_race']);
    s.player.zone = 'field_far';
    applyStagePlan(s, grovePlan(), { kind: 'extension', tier: 'success', placeId: 'field', frontierKey: 'woods' }, { entry: 'open' }, createRng(1));
    expect(s.stage.scene!.ground).toEqual(expect.arrayContaining(['grove', 'field_far']));
  });

  it('SC16: off the ground with no one chasing, the scene ends as left and free roam starts', () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    scene(s, ['tav_common', 'tav_counter']);
    checkSceneEnd(s, []);
    expect(s.stage.ending).toBeUndefined();
    place(s, 'player', 'street_door');
    checkSceneEnd(s, []);
    expect(s.stage.breakCause).toBe('scene_end');
    expect(closeScene(s)).toBe('roam');
    expect(s.stage.breakCause).toBeUndefined();
    expect(s.stage.scene).toBeUndefined();
    expect(s.stage.roam).toEqual({ since: s.turn });
    expect(s.hidden.scenes!.at(-1)).toMatchObject({ ending: 'left' });
    expect(pendingEnding(s)).toBe('left'); // SD1: the ending moment still shows it
  });

  it('SC16: a ground ending held over a talk lapses if the player steps back onto the ground', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    scene(s, ['tav_common']);
    checkSceneEnd(s, [ev(s, { kind: 'speak', target: 'trader' })]);
    expect(s.stage.ending).toMatchObject({ as: 'left', roam: true });
    place(s, 'player', 'tav_common');
    checkSceneEnd(s, []);
    expect(s.stage.ending).toBeUndefined();
    expect(s.stage.breakCause).toBeUndefined();
  });

  it('CH4: off the ground with a pursuer, the scene follows the chase', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    scene(s, ['tav_common']);
    hunts(s, 'patron_1', s.turn);
    expect(pursuers(s).map((a) => a.id)).toEqual(['patron_1']);
    checkSceneEnd(s, []);
    expect(s.stage.ending).toBeUndefined();
    expect(s.stage.breakCause).toBeUndefined();
    actor(s, 'patron_1').mind!.moraleState = 'broken'; // broken pursuers don't count
    expect(pursuers(s)).toEqual([]);
  });

  it('CH7/SC23: unseen for CHASE_LOST_TURNS turns, pursuers drop to tracking, remember it, and off the ground the scene ends as escaped', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    scene(s, ['tav_common']);
    s.turn = 10;
    const wim = hunts(s, 'patron_1', 10 - CONFIG.CHASE_LOST_TURNS + 1, 'street_door');
    updateChase(s);
    expect(wim.mind!.knowledge.player!.status).toBe('hunting');
    s.turn += 1;
    updateChase(s);
    expect(wim.mind!.knowledge.player).toMatchObject({ status: 'tracking', lostTurn: s.turn });
    expect(s.hidden.memory.patron_1!.at(-1)!.text).toBe(CHASE_LOST_MEMORY);
    expect(pursuers(s)).toEqual([]);
    expect(s.stage.ending).toMatchObject({ as: 'escaped', roam: true });
    checkSceneEnd(s, []);
    expect(closeScene(s)).toBe('roam');
    expect(s.hidden.scenes!.at(-1)).toMatchObject({ ending: 'escaped' });
  });

  it('CH7: lost on the ground, the scene carries on; the chaser goes back to its routine until it sees the player again', () => {
    const s = makeVillage({ playerZone: 'tav_cellar', without: ['slime_1', 'slime_2'] });
    scene(s, ['tav_common', 'tav_counter', 'tav_cellar']);
    s.turn = 10;
    const wim = hunts(s, 'patron_1', 5, 'street_door');
    place(s, 'patron_1', 'street_door');
    updateChase(s);
    expect(s.stage.ending).toBeUndefined();
    const v = buildActorView(s, 'patron_1');
    expect(v.beliefs.find((b) => b.about === 'player')!.lost).toBe(true);
    expect(fallbackOrder(v, createRng(1)).source).toBe('routine');
    wim.mind!.knowledge.player!.lastSeenTurn = s.turn + 1; // seen again: the chase is on
    expect(buildActorView(s, 'patron_1').beliefs.find((b) => b.about === 'player')!.lost).toBeUndefined();
  });

  it('CH5: chase range from the band, else the template, else the default; zones per range', () => {
    const s = makeVillage({ playerZone: 'street_door' });
    scene(s, ['tav_common', 'tav_counter']);
    const wim = actor(s, 'patron_1'), slime = actor(s, 'slime_1');
    expect(chaseRange(s, wim)).toBe('post');
    expect(chaseRange(s, slime)).toBe('far');
    expect(chaseZones(s, wim)!.sort()).toEqual(['tav_cellar', 'tav_common', 'tav_counter']); // its own place
    expect(chaseZones(s, slime)).toBeUndefined();
    s.bands.find((b) => b.id === 'tavern_folk')!.chase = 'ground';
    expect(chaseRange(s, wim)).toBe('ground');
    expect(chaseZones(s, wim)!.sort()).toEqual(['tav_cellar', 'tav_common', 'tav_counter']);
    s.bands.find((b) => b.id === 'tavern_folk')!.chase = 'near';
    expect(chaseZones(s, wim)).toEqual(expect.arrayContaining(['street_door', 'street_square'])); // one place beyond
    expect(chaseZones(s, wim)).not.toContain('gate_inner');
    // agent-run NPCs decide for themselves
    expect(chaseZones(s, actor(s, 'guard_1'))).toBeUndefined();
  });

  it('CH5: a code-run pursuer stops at the edge of its range', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    s.mode = 'tactical';
    const wim = hunts(s, 'patron_1', s.turn, 'street_square');
    wim.mind!.knowledge.player!.status = 'aware';
    const o = fallbackOrder(buildActorView(s, 'patron_1'), createRng(1));
    expect(o.type).toBe('hold');
    s.bands.find((b) => b.id === 'tavern_folk')!.chase = 'far';
    expect(fallbackOrder(buildActorView(s, 'patron_1'), createRng(1))).toMatchObject({ type: 'move', target: 'street_door' });
  });

  it('CH6: a pursuer that saw the crossing knows where it leads (code-run only at range far); one still hunting that reaches it follows', () => {
    const s = makeVillage({ playerZone: 'field_far', without: ['slime_2'] });
    const grove = { id: 'grove', placeId: 'field', name: 'a grove', look: '', links: [{ to: 'field_far', label: 'back', sight: true }], cover: 'some' as const, light: 'bright' as const, groundItems: [] };
    s.zones.push(grove);
    s.places.find((p) => p.id === 'field')!.zones.push(grove);
    s.stage.zoneIds.push('grove');
    s.player.zone = 'grove';
    const slime = hunts(s, 'slime_1', s.turn, 'field_far');
    const wim = hunts(s, 'patron_1', s.turn, 'field_far');
    s.events = [ev(s, { kind: 'move', zone: 'field_far', target: 'woods', effects: [{ kind: 'frontier_crossed', actorId: 'player', data: { frontier: 'woods' } }], perception: { slime_1: { level: 'full', cue: 'sight' }, patron_1: { level: 'full', cue: 'sight' } } })];
    noteCrossing(s, 'field_far', 'grove');
    expect(slime.mind!.knowledge.player!.lastKnownZone).toBe('grove');
    expect(wim.mind!.knowledge.player!.lastKnownZone).toBe('field_far'); // post: never crosses
    expect(s.stage.crossings).toEqual([{ from: 'field_far', to: 'grove', turn: s.turn }]);
    // a far pursuer that did not see it go, but reaches the crossing still hunting, follows
    slime.mind!.knowledge.player!.lastKnownZone = 'field_far';
    place(s, 'slime_1', 'field_far');
    updateChase(s);
    expect(slime.mind!.knowledge.player!.lastKnownZone).toBe('grove');
  });

  it('CH2: in free roam talk, trade, a fight, a hostile spotting you or a quest goal starts a new scene; dawn or dusk does not', () => {
    const s = makeVillage({ playerZone: 'street_square' });
    s.stage.roam = { since: s.turn - 1 };
    expect(roamStart(s, [])).toBeNull();
    expect(roamStart(s, [ev(s, { kind: 'speak', speech: { skill: 'x', addressees: ['trader'] } })])).toBe('talk');
    expect(roamStart(s, [ev(s, { kind: 'speak', actorId: 'trader', target: 'player' })])).toBe('talk');
    expect(roamStart(s, [ev(s, { kind: 'speak', actorId: 'trader', target: 'player', bark: true })])).toBeNull();
    expect(roamStart(s, [ev(s, { kind: 'buy', target: 'trader' })])).toBe('trade');
    expect(roamStart(s, [ev(s, { kind: 'attack', target: 'slime_1' })])).toBe('attack');
    const slime = actor(s, 'slime_1');
    slime.mind!.knowledge.player = { status: 'aware', lastKnownZone: 'street_square', lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    expect(roamStart(s, [])).toBe('spotted');
    delete slime.mind!.knowledge.player;
    s.quests.push({ id: 'q1', state: 'ready', text: 'go to the gate', giver: 'trader', dealId: 'd1', goal: { kind: 'reach', place: 'gate' }, progress: 1, level: 'i', startTurn: 1 } as never);
    s.log.push({ turn: s.turn, code: 'quest_ready', detail: { id: 'q1' } });
    expect(roamStart(s, [])).toBe('quest');
    checkRoam(s, []);
    expect(s.stage.breakCause).toBe('roam');
    expect(s.log.at(-1)).toMatchObject({ code: 'roam_scene', detail: { why: 'quest' } });
  });

  it('SD2 a: free roam runs no beats and never stalls; a turn of talk starts a scene after it', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    s.stage.roam = { since: 0 };
    s.stage.quiet = 50;
    expect(triggerHolds(s, { id: 'b', ownerId: 'trader', when: { type: 'quiet_turns', turns: 1 }, then: { type: 'idle', target: null, skill: null, intent: '' }, once: true }, actor(s, 'trader'), [], 'start', s.turn)).toBe(false);
    play(s);
    expect(s.stage.breakCause).toBeUndefined();
    expect(s.log.some((l) => l.code === 'scene_stalled')).toBe(false);
    play(s, { intent: { move: null, gear: null, spoken: 'evening', addressees: ['trader'], deferred: [], clarify: null, action: { type: 'talk', skill: '', target: 'trader', targetPart: null, item: null, mode: null, approach: '', stance: 'normal' } }, spokespeople: ['trader'] });
    expect(s.stage.breakCause).toBe('roam');
  });

  it('CH3 a: in free roam an unbuilt frontier starts a scene there with its own event roll; no extension is fetched ahead', async () => {
    const s = makeVillage({ playerZone: 'field_far' });
    s.stage.roam = { since: s.turn };
    const weave = vi.fn(async (v: WeaverView) => grovePlan(TIERS.keyOf(v.tier)!));
    const d = new SceneDirector({ weave, clock: new VirtualClock() });
    expect(d.afterSave(s)).toEqual([]);
    const before = s.stage.sceneNumber;
    const r = await d.cross(s, 'woods', createRng(s.rngState));
    expect(r.eventRoll).toBeDefined();
    expect(weave.mock.calls[0][0].target).toMatchObject({ kind: 'scene', frontierKey: 'woods', label: 'into the woods' });
    expect(s.player.zone).toBe('grove');
    expect(s.stage.sceneNumber).toBe(before + 1);
    expect(s.stage.roam).toBeUndefined();
    expect(s.stage.scene!.ground).toEqual(expect.arrayContaining(['field_far', 'grove']));
    expect(s.zones.find((z) => z.id === 'field_far')!.links.find((l) => l.to === 'grove')?.frontier).toBeUndefined();
  });

  it('CH5: the Weaver may give a band a chase range from the table', () => {
    const s = makeVillage({ playerZone: 'field_edge' });
    const plan = { ...MILL_PLAN, bands: [{ key: 'millers', name: 'millers', goals: '', temperament: '', tactics: 'simple' as const, lethal: true, relations: {}, chase: 'far' as const }] };
    expect(validateStagePlan(s, plan, { kind: 'scene', tier: 'success', placeId: 'field' }).filter((e) => e.code === 'bad_band')).toEqual([]);
    expect(validateStagePlan(s, { ...plan, bands: [{ ...plan.bands[0], chase: 'forever' as never }] }, { kind: 'scene', tier: 'success', placeId: 'field' }).map((e) => e.code)).toContain('bad_band');
    applyStagePlan(s, plan, { kind: 'scene', tier: 'success', placeId: 'field' }, { entry: 'open' }, createRng(1));
    expect(s.bands.find((b) => b.name === 'millers')!.chase).toBe('far');
  });

  it('SD1: a scene that ends inside resolveTurn still reports its ending afterwards', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    s.stage.scene = frameOf(s, { question: 'q', scale: 'situation', endings: [{ when: { kind: 'time', at: 'day' }, as: 'resolved', text: 'x' }, { when: { kind: 'judged' }, as: 'lost', text: 'y' }] }, 'success', (_k, r) => r);
    s.clocks = { minutes: 9 * 60 } as never;
    play(s);
    expect(s.hidden.scenes?.at(-1)?.ending).toBe('resolved');
    expect(pendingEnding(s)).toBe('resolved');
  });

  it('SD2 a: every ending starts free roam for now; a road encounter or a knock-out starts the next scene', () => {
    for (const cause of ['scene_end', 'story_beat'] as const) {
      const s = makeVillage();
      scene(s, ['tav_common']);
      if (cause === 'scene_end') s.stage.ended = { as: 'resolved', text: '' };
      s.stage.breakCause = cause;
      expect(closeScene(s)).toBe('roam');
      expect(s.stage.breakCause).toBeUndefined();
    }
    for (const cause of ['encounter', 'knocked_out'] as const) {
      const s = makeVillage();
      scene(s, ['tav_common']);
      s.stage.breakCause = cause;
      expect(closeScene(s)).toBe('new');
      expect(s.stage.roam).toBeUndefined();
    }
  });

  it('templates carry the CH5 defaults', () => {
    const s = makeVillage();
    expect(chaseRange(s, actor(s, 'guard_1'))).toBe('ground');
    expect(actor(s, 'trader').core.templateId).toBe(TP.trader);
    expect(chaseRange(s, actor(s, 'trader'))).toBe('post');
  });
});
