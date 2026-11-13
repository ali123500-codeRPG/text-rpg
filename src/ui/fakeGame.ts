// In-memory fake GameApi with canned lines, for building and screenshotting the screens until W7's pipeline lands.
import { placeZones } from '../scenario/geometry';
import { BK, EK, PA, VL, ZK } from '../library/tableIds';
import { roadShape } from '../scenario/apply';
import { HL } from '../library/tableIds';
import { TP } from '../library/templateIds';
import type { CreationBuild, GameApi, GameState, GmSnapshot, LogLine, Notice, XpPart } from '../types';
import { CONFIG, defaultSettings } from '../config';
import { maxMorale, moraleLevel, setMoraleLost } from '../ruleset/morale';
import { getLibrary } from '../library';
import { takePerk, undoPerk } from '../ruleset';
import { abandonQuest, pinQuest } from '../engine/quests';
import { spawnNpc, validateBuild } from '../library/spawn';
import { playerFromBuild } from './sheet';
import { SK } from '../library/skillIds';
import { IT } from '../library/itemIds';
import { ACH } from '../library/achievementIds';
import { achievementInfo, grantAchievement } from '../engine/xp';
import { actionNotes, doingSnap, placeName } from '../agents/game';
import { buildPlayerView } from '../views';
import { DU, FU } from '../library/tableIds';
import { makeFurniture } from '../engine/furniture';

const NARRATION = [
  'Rain needles the thatch of the Crooked Kettle. The common room smells of wet wool and old ale, and the barkeep watches you over a cup she has been wiping for some time.',
  'You step out past the gate. The field is streaked with silver trails, and something low and glistening shifts in the long grass by the trees.',
  'The slime lurches at you. You bring the round shield across, and the blow slaps wetly against the boards; your counter cuts a long furrow through its body.',
];

/** a canned exchange of blows on the fake page: the player loses health and the right arm, and gains Block, XP and coin */
function fightTurn(st: GameState): Partial<LogLine> {
  const p = st.player;
  p.core.condition.hpLostPct = Math.min(99, p.core.condition.hpLostPct + 35);
  p.core.condition.parts.right_arm = -10;
  const blk = p.core.skills[SK.block];
  if (blk) blk.raw += 2; else p.core.skills[SK.block] = { raw: 2, state: 'normal' } as typeof p.core.skills[string];
  if (p.progression) p.progression.xp += 40;
  const purse = p.core.inventory.find((i) => i.itemId === IT.coin);
  if (purse) purse.qty = (purse.qty ?? 1) + 15; else p.core.inventory.push({ id: 'player_coin', itemId: IT.coin, qty: 15 });
  // the late block cost the shield too, so its state on the gear line lands (Q2)
  const lib = getLibrary();
  const shield = p.core.inventory.find((i) => i.equippedIn?.length && lib.items[i.itemId]?.shield);
  if (shield) shield.pools = { ...shield.pools, shield: Math.min(40, (shield.pools?.shield ?? 100) - 60) };
  return {
    text: 'The slime rears and lashes down. You get the shield up late; the blow tears past it and something in your right arm gives with a wet crack. You answer anyway, a heavy cut that opens its side. It sags, steaming, and coins spill from its gut into the grass.',
    check: { kind: 'attack', skill: SK.melee_medium, tier: 'great_success', against: { what: 'slime’s dodge', tier: 'failure' }, result: 'heavy hit, body' },
    incomingChecks: [{ kind: 'attack', skill: SK.melee_light, tier: 'critical_success', against: { what: 'your block', tier: 'near_miss' }, result: 'crushing hit, right arm', by: 'the slime' }],
    changes: [{ kind: 'combat', text: 'Slime → you · crushing hit, right arm' }, { kind: 'combat', text: 'You → slime · heavy hit, body' }, { kind: 'condition', text: 'Your right arm is crippled' }],
    wounds: [{ id: 'right_arm', from: 'healthy', to: 'crippled' }], gains: { [SK.block]: 2 }, coin: 15,
  };
}

function robTurn(st: GameState): Partial<LogLine> {
  const purse = st.player.core.inventory.find((i) => i.itemId === IT.coin);
  const took = Math.min(purse?.qty ?? 0, 12);
  if (!purse || !took) return {};
  purse.qty = (purse.qty ?? 1) - took;
  return { coin: -took };
}

// "bandage" works at a 40 s bandage 15 s a turn while someone in view spans a crossbow (20 s), to show long actions (AT11a):
// Who's here, the action box and each turn's Actions row
function bandageTurn(st: GameState): Partial<LogLine> {
  const before = doingSnap(buildPlayerView(st));
  const p = st.player, other = st.actors.find((a) => a !== p && a.zone === p.zone && before.has(a.id));
  const step = (a: typeof p, row: string, need: number) => {
    const done = (a.busy?.row === row ? a.busy.done : 0) + 15;
    if (a.busy?.row === row && done >= need) { delete a.busy; return; }
    if (!a.busy || a.busy.row === row) a.busy = { row, key: row, order: { type: 'use_item', target: null, item: null }, done, need, turn: st.turn };
  };
  step(p, DU.bandage, 40);
  if (other && (other.busy || !p.busy || p.busy.done <= 15)) step(other, DU.span_crossbow, 20);
  const actions = actionNotes(st, before, doingSnap(buildPlayerView(st)));
  return actions.length ? { actions } : {};
}

function levelTurn(st: GameState): Partial<LogLine> {
  const p = st.player, c = p.core.classes[0];
  if (!c || !p.progression) return {};
  c.level += 1;
  p.progression.xp = 20;
  p.progression.unspentPerkPoints += 1;
  return { levelUps: [{ classId: c.classId, level: c.level }] };
}

/** grants achievements through the engine and returns them as the turn line carries them */
function earnTurn(st: GameState, keys: string[]): Partial<LogLine> {
  const pr = st.player.progression;
  const had = new Set((pr?.achievements ?? []).map((a) => a.id));
  for (const k of keys) grantAchievement(st, k, undefined, 1);
  return { achievements: (pr?.achievements ?? []).filter((a) => !had.has(a.id)).map((a) => achievementInfo(st, a)) };
}

/** "end" ends the scenario with a full set of gains, to show the scenario-end gains moment (D-226) */
function endTurn(st: GameState): Partial<LogLine> {
  const p = st.player;
  const raise = (k: string, by: number) => { const sk = p.core.skills[k]; const from = sk?.raw ?? 0; if (sk) sk.raw += by; else p.core.skills[k] = { raw: by, state: 'normal' } as typeof p.core.skills[string]; return { skill: k, from, to: from + by }; };
  const skills = [raise(SK.melee_medium, 3), raise(SK.block, 4), raise(SK.dodge, 2)];
  const fromLevel = p.core.classes[0]?.level ?? 1;
  const lvl = levelTurn(st);
  const earned = earnTurn(st, [ACH.flawless_1, ACH.brink_1]);
  const parts: XpPart[] = [{ kind: 'defeat', label: '3 foes defeated', amount: 90 }, ...(earned.achievements ?? []).map((a) => ({ kind: 'achievement' as const, label: a.name, amount: 25 })),
    { kind: 'quest', label: 'Clear the cellar for the barkeep', amount: 40 }];
  const scenarioGains: NonNullable<LogLine['scenarioGains']> = {
    skills, perks: [{ skill: SK.block, milestone: 20 }], allPerks: [{ tree: 'TR1', step: 50, name: 'All-50: Melee' }],
    achievements: earned.achievements ?? [], xp: { gained: parts.reduce((n, x) => n + x.amount, 0), fromLevel, fromPct: 62, toLevel: fromLevel + 1, toPct: 30, parts }, levelUps: lvl.levelUps ?? [],
    essences: [{ name: 'Gel Patience', grade: 'fine' }],
  };
  const closing = 'The cellar is quiet now, and the job is done.';
  (p.progression!.gainsLog ??= []).push({ ...scenarioGains, number: st.stage.scenarioNumber ?? 1, ending: 'resolved', endTurn: st.turn, closing });
  st.stage.scenarioNumber = (st.stage.scenarioNumber ?? 1) + 1;
  return {
    text: 'Dawn finds you on the far bank. The new road climbs west toward a town you have only heard of.',
    scenarioEnd: { as: 'resolved', name: 'resolved', closing },
    scenarioGains,
  };
}

export const validateBuildLocal = (b: CreationBuild): string[] => validateBuild(b);

// the fake world for the Map page: a village, the tavern inside it and the field east of it (the cellar and the north road unexplored)
type FakeZone = GameState['places'][number]['zones'][number];
const FZ = (id: string, placeId: string, name: string, look: string, links: [string, string, boolean?, true?][], extra: Partial<FakeZone> = {}): FakeZone =>
  ({ id, placeId, name, look, links: links.map(([to, label, sight = true, frontier]) => ({ to, label, sight, ...(frontier ? { frontier } : {}) })), cover: 'some', light: 'dim', groundItems: [], ...extra });
const FP = (id: string, kind: string, parentId: string | null, name: string, zones: FakeZone[]): GameState['places'][number] =>
  ({ id, storyId: 'fake', kind, parentId, names: { current: name, past: [] }, zones, state: {}, headlines: [] });
const FAKE_PLACES = (): GameState['places'] => placed([
  FP('village', 'village', null, 'Millbrook', [
    FZ('v_square', 'village', 'village square', 'A muddy square around a well, with the tavern sign creaking over it.', [['tav_common', 'the Kettle’s front door', false], ['field_edge', 'the east lane'], ['ash_gate', 'the west road', false]], { outdoor: true, light: 'bright', cover: 'none', area: 1600 }),
  ]),
  FP('ashford', 'village', null, 'Ashford', [
    FZ('ash_gate', 'ashford', 'Ashford gate', 'A timber gate in a low wall, a day’s walk west of Millbrook.', [['v_square', 'the east road', false], ['f_ash', 'the market, north', false, true]], { outdoor: true, light: 'bright', cover: 'none', area: 25, aspect: 2 }),
  ]),
  FP('tavern', 'tavern', 'village', 'the Crooked Kettle', [
    FZ('tav_common', 'tavern', 'common room', 'A low room with a hearth, benches and a scarred counter.', [['tav_kitchen', 'the kitchen door, west', false], ['v_square', 'out the front door, south', false], ['tav_yard', 'the back door, east'], ['tav_upstairs', 'the stairs up', false]], { area: 64, edges: { n: EK.wall, e: EK.wall, s: EK.window, w: EK.wall }, furniture: makeFurniture('tav_common', [{ kind: FU.counter, name: 'scarred counter', at: 'n' }, { kind: FU.hearth, name: 'hearth', at: 'w' }, { kind: FU.table, name: 'long table' }, { kind: FU.bench, name: 'bench', at: 'se' }, { kind: FU.barrels, name: 'ale barrels', at: 'ne' }]) }),
    FZ('tav_kitchen', 'tavern', 'kitchen', 'Copper pots, a long table and the smell of onions.', [['tav_common', 'the common room, east', false], ['tav_cellar', 'the cellar hatch, down', false]], { area: 25 }),
    FZ('tav_yard', 'tavern', 'back yard', 'A walled yard of firewood and a rain barrel.', [['tav_common', 'the back door, west'], ['f_lane', 'the gate to the lane', true, true]], { outdoor: true, cover: 'some', area: 150, edges: { n: EK.low, e: EK.low, s: EK.low, w: EK.wall }, furniture: makeFurniture('tav_yard', [{ kind: FU.woodpile, name: 'woodpile', at: 'nw' }, { kind: FU.water_barrel, name: 'rain barrel', at: 'sw' }, { kind: FU.cart, name: 'hand cart', at: 'e' }]) }),
    FZ('tav_upstairs', 'tavern', 'upstairs landing', 'A narrow landing with three doors.', [['tav_common', 'the stairs down', false]], { light: 'dark', height: 3, area: 9, aspect: 2 }),
    FZ('tav_cellar', 'tavern', 'cellar', 'A damp cellar of barrels.', [['tav_kitchen', 'the hatch, up', false]], { light: 'dark', height: -3, area: 60 }),
  ]),
  FP('field', 'field', 'village', 'the slime field', [
    FZ('field_edge', 'field', 'field edge', 'Long grass streaked with silver trails.', [['v_square', 'the lane back west'], ['field_mid', 'into the field, north']], { outdoor: true, light: 'bright', cover: 'none', area: 1600 }),
    FZ('field_mid', 'field', 'middle of the field', 'Trampled grass around a shallow pond.', [['field_edge', 'the field edge, south'], ['f_trees', 'the trees, east', true, true]], { outdoor: true, light: 'bright', cover: 'some', area: 1600 }),
  ]),
]);
/** code places every fake zone in metres, as applyStagePlan does for real ones */
function placed(ps: GameState['places']): GameState['places'] { placeZones({ places: ps } as GameState, ps.flatMap((p) => p.zones)); return ps; }

/** barriers on the fake map's exits, so the Map shows its marks: the kitchen door (locked, tried), the back door (barred
 *  from the yard, tried), the front door (locked, the player holds its key) and the yard gate to the lane (blocked) */
function fakeBarriers(st: GameState): void {
  const put = (id: string, a: string, b: string, rec: Omit<import('../types').Barrier, 'id'>) => {
    (st.barriers ??= {})[id] = { id, ...rec };
    for (const z of st.places.flatMap((p) => p.zones)) for (const l of z.links) if ((z.id === a && l.to === b) || (z.id === b && l.to === a)) l.barrier = id;
  };
  put('fb_kitchen', 'tav_common', 'tav_kitchen', { kind: BK.door, grade: 'moderate', lock: { locked: true }, tried: [st.player.id] });
  put('fb_back', 'tav_common', 'tav_yard', { kind: BK.door, grade: 'minor', bar: { side: 'tav_yard', drawn: true }, tried: [st.player.id] });
  put('fb_front', 'tav_common', 'v_square', { kind: BK.door, grade: 'minor', lock: { locked: true } });
  put('fb_lane', 'tav_yard', 'f_lane', { kind: BK.gate, grade: 'minor', blocked: true });
  st.player.core.inventory.push({ id: 'fake_key', itemId: IT.key, qty: 1, opens: ['fb_front'] } as typeof st.player.core.inventory[number]);
}

export function createFakeGame(opts: { autoStart?: boolean; fell?: boolean; notices?: Notice[]; banner?: boolean } = {}): GameApi {
  let state: GameState | null = null;
  let lines: LogLine[] = [];
  const KETTLE = { id: 'tavern', name: 'The Crooked Kettle' };
  const placeOf = (st: GameState) => ({ id: st.player.placeId, name: placeName(st) });
  let busy = false, fell = !!opts.fell, n = 0, asks = 0;
  let ending: import('../types').ScenarioEndNote | null = null;
  const notices: Notice[] = opts.notices ?? [];
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());

  function start(b: CreationBuild) {
    const player = playerFromBuild(b, 'fake', 'tav_common', 'tavern');
    player.journal = { ...(player.journal ?? { secretsKnown: [], factsWitnessed: [], remembered: {}, namesKnown: [] }), zonesSeen: ['ash_gate', 'v_square', 'field_edge', 'field_mid', 'tav_common', 'tav_kitchen', 'tav_yard', 'tav_upstairs'], clearSight: { slime_1: 'field_mid' } };
    const settings = defaultSettings();
    const slime = spawnNpc(null, TP.slime, { id: 'slime_1', zone: 'field_mid', placeId: 'field', bandId: 'slimes', storyId: 'fake', name: 'slime' });
    slime.mind!.knowledge = { player: { status: 'aware', lastKnownZone: 'field_edge', lastSeenTurn: 2, source: 'seen', revealed: [] } };
    const guard = spawnNpc(null, TP.guard, { id: 'guard_1', zone: 'tav_common', placeId: 'tavern', bandId: 'village_watch', storyId: 'fake', name: 'Bren' });
    state = {
      storyId: 'fake', turn: 4, mode: 'tactical', zones: [], player, actors: [slime, guard], bands: [], events: [],
      hidden: { plans: { slime_1: { goal: 'drive the stranger off the field', steps: ['slam', 'retreat to the trees'], triggers: [], createdTurn: 2 } }, memory: {}, secrets: [], firedLog: [], agreements: [{ id: 'ag_1', parties: ['player', 'guard_1'], text: 'He lets you back in after dark; you tell him if you see the thief.', madeTurn: 2, madeBy: 'guard_1' }], weaverNote: 'the slimes are fleeing something in the woods', stage: { eventSummary: 'slimes trouble the village', challenge: 'moderate', gain: 'minor', hiddenTerms: ['woods_beast'] } },
      agentLog: [{ turn: 3, agent: 'narrator', input: { view: 'NarrationView…' }, output: { text: NARRATION[2] }, status: 'ok', errors: [], modelTierApplied: 'complex' } as GameState['agentLog'][number],
        { turn: 3, agent: 'parser', input: { text: 'block and cut back' }, output: { intent: 'attack', target: 'slime_1' }, status: 'ok', errors: [], modelTierApplied: 'quick' } as GameState['agentLog'][number]],
      log: [{ turn: 3, code: 'planner_late' }, { turn: 3, code: 'skill_improved', detail: { skill: SK.block, from: 37, to: 40, milestone: 40 } }], rngSeed: 1, rngState: 1, pending: { turn: 3, mode: 'tactical', engaged: ['slime_1'], fired: [] },
      places: FAKE_PLACES(), facts: [], stage: { zoneIds: [], tier: 'success', scenarioNumber: 2, scenarioStartTurn: 2, ...(opts.banner ? { fallback: { reason: 'Scenario planning failed: placeholder area', turn: 2 } } : {}) },
      scenarioCaps: { promotions: 0, minted: 0 }, clocks: {}, flags: {},
      quests: [
        { id: 'q0', state: 'done', text: 'Find a bed for the night', giver: 'guard_1', dealId: 'deal_0', goal: { kind: 'other' }, progress: 0, level: 'zero', startTurn: 1, endTurn: 2 },
        { id: 'q1', state: 'active', text: 'Clear the slimes from the field', giver: 'guard_1', dealId: 'ag_1', goal: { kind: 'defeat', by: 'race', of: slime.core.raceId!, count: 3, noun: 'slimes' }, progress: 1, level: 'i', startTurn: 2, after: 'q0', pay: { coin: 10 }, paid: { coin: 0, qty: 0 }, due: 3 * 1440 + 1080, dueBy: 'dusk' },
      ],
      settings, libraryVersion: 1, blueprints: [{ storyId: 'fake', id: `${IT.short_sword}_m2_1`, kind: 'item', data: { id: `${IT.short_sword}_m2_1`, kind: 'weapon', name: 'Wim’s old blade', look: 'a notched short sword with a wire-bound grip', base: { itemId: IT.short_sword, quality: 'fine' } } }], meta: { storyId: 'fake', title: 'The slime field', schemaVersion: 1, createdAt: '2026-11-07', settings },
    };
    if (player.progression) { player.progression.marks = [SK.dodge, SK.eyesight]; player.progression.unspentPerkPoints = 1; }
    fakeBarriers(state);
    player.core.inventory.push({ id: 'player_draught', itemId: IT.healing_draught, qty: 2 }, { id: 'player_draught_2', itemId: IT.healing_draught, qty: 1 }, { id: 'player_bandage', itemId: IT.bandage, qty: 2 },
      { id: 'player_shield', itemId: IT.round_shield, qty: 1, equippedIn: ['grip:left_arm'], pools: { shield: 70 } }); // the shield the story says you raise
    player.core.condition.hpLostPct = 10; // healed from Hurt to Bruised on turn 3
    lines = [
      { turn: 1, kind: 'narration', text: NARRATION[0], place: KETTLE, scenario: 1 },
      { turn: 2, kind: 'player', text: 'I head out through the gate to the field' },
      { turn: 2, kind: 'narration', text: NARRATION[1], place: KETTLE, scenario: 2, gear: ['Now held: right hand · Arming sword', 'Now held: left hand · Round shield'] },
      { turn: 3, kind: 'player', text: 'I raise my shield and cut back at it', aimed: true },
      { turn: 3, kind: 'narration', text: NARRATION[2], place: KETTLE, scenario: 2,
        check: { kind: 'attack', skill: SK.melee_medium, tier: 'great_success', against: { what: 'slime’s dodge', tier: 'success' }, result: 'full hit, body' },
        speech: [{ speaker: 'a gate guard', volume: 'shout', text: 'That’s one! Watch your left!' }],
        heals: [{ source: HL.bandage, from: 'hurt', to: 'bruised', parts: [{ id: 'left_leg', from: 'damaged', to: 'healthy' }] }],
        unlocks: [{ skill: SK.block, milestone: 40 }], gains: { [SK.block]: 3 },
        incomingChecks: [{ kind: 'attack', skill: SK.melee_light, tier: 'great_success', against: { what: 'your block', tier: 'success' }, result: 'blocked, shield', by: 'the slime' }],
        changes: [{ kind: 'combat', text: 'Slime → you · blocked, shield' }, { kind: 'combat', text: 'You → slime · full hit, body' }, { kind: 'health', text: 'You are Bruised' }],
        mechanics: ['Slime slam: d100 71 + 30×0.5 + 10 → Great Success', 'Your block: d100 64 + 65×0.5 → Success · gap −1 · blocked (shield 30 → 18)', 'Your cut: d100 82 + 75×0.5 → Great Success · dodge 0 · full hit · 25 damage to body'] },
    ];
  }
  if (opts.autoStart) start({ name: 'Aldric', skills: { [SK.melee_medium]: 50, [SK.parry]: 40, [SK.dodge]: 30, [SK.endurance]: 50, [SK.eyesight]: 30, [SK.earshot]: 30, [SK.riposte]: 20, [SK.resolve]: 45 }, tagged: [SK.melee_medium, SK.parry, SK.endurance],
    personality: { nerve: 40, traits: { [PA.honesty]: 50, [PA.pride]: 25, [PA.sociability]: -30 }, values: [VL.duty, VL.freedom] } });

  return {
    state: () => state,
    lines: () => lines,
    notices: () => notices,
    busy: () => busy,
    scenarioEnding: () => ending,
    fell: () => fell,
    subscribe(cb) { subs.add(cb); return () => subs.delete(cb); },
    validateBuild: validateBuildLocal,
    async newStory(b) { start(b); emit(); },
    async resume() { return state !== null; },
    async hallOfFame() {
      return [{ name: 'Aldric', pronouns: 'he', title: 'Slime-Bane', classes: [{ name: 'Swordsman', level: 6 }], level: 6, owner: 'player' as const, storyId: 'story_fake',
        skills: [{ name: 'Medium weapons', value: 58 }, { name: 'Parry', value: 47 }, { name: 'Endurance', value: 50 }, { name: 'Dodge', value: 31 }],
        perks: ['Keen Ear', 'Turn the Blade'], achievements: ['First Blood', 'Slime-Bane'], scars: ['First Crack'], defeats: 12, turn: 48, day: 3,
        place: 'The back yard · The Lantern & Ladle', downedBy: { by: 'a lanky youth', weapon: 'dagger', part: 'neck', outcome: 'crushing hit' }, fellAt: '2026-11-10T21:00:00.000Z' }];
    },
    async sendHero(storyId: string) { return { id: `unique_${storyId}` }; },
    async sendBlueprint(id: string) { return { id: `item_story_fake_${id}` }; },
    async librarySends() { return []; },
    async worlds() { return [{ worldId: 'story_fake', name: 'Aldric’s world', lastStoryId: 'story_fake', day: 3, past: [{ name: 'Aldric', fell: true }], threadbound: [IT.varos_loop] }]; },
    async titleWorld() {},
    async reportBug() { return 'BG-99'; },
    async openBugs() { return [{ id: 'BG-12', code: 'player_report', storyId: 'story_fake', turn: 4, status: 'open' as const, at: Date.now(), note: 'Walking to the back of the cellar did nothing.' }]; },
    // guided mode: every other move is a question (screenshots and UI checks)
    async agentMove(_persona, _style, guided) {
      if (guided?.answered) return { command: 'I talk to the barkeep.', say: 'Okay, your way!' };
      if (guided && (guided.mustAsk || ++asks % 2)) return { command: '', say: 'The barkeep offers a job: clear the cellar for 5 silver. Take it?', ask: { kind: guided.mustAsk?.kind ?? 'deal', about: `the barkeep ${asks}`, choices: ['I take the job.', 'I turn it down.', 'I ask for more.'], pick: 0 } };
      return { command: 'I look around.', say: '<sigh> Getting my bearings first. The room is quiet, too quiet, and I do not like it.', direction: 'calm, a little curious' };
    },
    async submit(text, o) {
      if (busy || !state) return;
      // numbered like the game: the turn's lines carry state.turn, then the turn advances; /undo steps back one
      const t = state.turn;
      if (text === '/undo') { fell = false; state.turn = Math.max(1, t - 1); lines = [...lines, { turn: state.turn, kind: 'command', text: 'Turn undone.' }]; emit(); return; }
      lines = [...lines, { turn: t, kind: text.startsWith('/') ? 'command' : 'player', text, ...(o?.aimed ? { aimed: true } : {}) }];
      busy = true;
      if (/^end\b/i.test(text)) ending = { as: 'resolved', name: 'resolved' }; // the ending's rule draws while the turn runs (SD1)
      emit();
      await new Promise((r) => setTimeout(r, 600));
      ending = null;
      const ended = /^end\b/i.test(text) ? endTurn(state) : null;
      // "door" tries and opens doors, to show the play screen's Way rows
      const ways = /^door\b/i.test(text) ? { ways: ['Door to kitchen: locked', 'Door to back yard: barred from the other side', 'Door to village square: unlocked with your key on the way through'] } : null;
      state.turn = t + 1;
      if (/^(sneak|hide|vanish)\b/i.test(text)) state.player.posture = 'stealthy'; // shows the stealthy badge and bar
      const drop = /^charge\b/i.test(text); // "charge" drops the player, to show the fall on the fake page
      if (drop) fell = true;
      // "attack" trades blows, to show the play screen's motion: health and a crippled arm lost, a skill, XP and coin gained
      const hurt = /^attack\b/i.test(text) ? fightTurn(state) : null;
      // "travel" adds a road west of the village and sets you partway along it, to show your point on the road on the Map (TV7)
      if (/^travel\b/i.test(text)) {
        if (!state.places.some((x) => x.id === 'west_road')) {
          state.places.push(FP('west_road', 'road', null, 'the west road', [FZ('w_road', 'west_road', 'the west road', 'A rutted cart road between hedges.',
            [['v_square', 'Millbrook, east', false], ['ash_gate', 'Ashford, west', false]], { outdoor: true, light: 'bright', cover: 'none', kind: ZK.road, ...roadShape('hour', 'quiet') })]));
          placeZones(state, state.places.find((x) => x.id === 'west_road')!.zones);
        }
        const road = state.places.find((x) => x.id === 'west_road')!.zones[0];
        state.player.zone = road.id; state.player.placeId = road.placeId;
        if (road.rect) state.player.pos = { x: road.rect.x - road.rect.w * 0.1, y: road.rect.y };
        (state.player.journal?.zonesSeen ?? []).push(road.id);
      }
      // "fear" drops the player's morale to the next level down (Terrified, Panicking, Broken), and "calm" brings back a quarter,
      // to show the nerve's warning on the play screen (MW1–MW3)
      const wasBroken = moraleLevel(state.player) === 'broken';
      if (/^(fear|calm)\b/i.test(text)) {
        const p = state.player, max = maxMorale(p), lostPct = (100 * (p.core.condition.moraleLost ?? 0)) / max;
        const next = CONFIG.MORALE_TRACK.find(([, at]) => at > lostPct + 0.001)?.[1] ?? 100;
        setMoraleLost(p, /^fear/i.test(text) ? (Math.min(100, next) / 100) * max : (p.core.condition.moraleLost ?? 0) - max / 4);
      }
      // the turn "fear" breaks the nerve shows the Nerve broken card; "punch" while Broken is refused (MB12)
      const nerve = !wasBroken && moraleLevel(state.player) === 'broken' ? { nerveBroke: true as const } : wasBroken && /^punch\b/i.test(text) ? { nerveRefused: true as const } : null;
      // "rob" has a pickpocket lift coin from the purse, to show the Coin row and the sheet's coin losing it
      const robbed = /^rob\b/i.test(text) ? robTurn(state) : null;
      const bandaged = /^bandage\b/i.test(text) ? bandageTurn(state) : null;
      // "walk" leaves a walk to the upstairs landing still on its way, to show the move order in the action box and on the Map
      // (AT49); "stop" ends it
      if (/^walk\b/i.test(text)) {
        state.player.walking = { toZone: text.split(/\s+/)[1] || 'tav_upstairs' };
        if (!state.stage.zoneIds.length) state.stage.zoneIds = state.places.flatMap((x) => x.zones.map((z) => z.id)); // a way to walk
      }
      if (/^stop\b/i.test(text)) delete state.player.walking;
      // "steady" leaves you Mentally steady, to show the chip beside Morale (SY1); any "fear" after it uses it up
      if (/^steady\b/i.test(text)) state.player.core.condition.mentallySteady = true;
      if (/^fear\b/i.test(text)) delete state.player.core.condition.mentallySteady;
      // "train" levels the current class up, to show the level-up beat and the rail's perk-point badge landing with it
      const lvl = /^train\b/i.test(text) ? levelTurn(state) : null;
      // the attack earns an achievement; "spar" loses a spar and earns a scar, to show both gold cards and their pop-ups
      const earned = hurt || /^spar\b/i.test(text) ? earnTurn(state, hurt ? [ACH.crippled_1] : [ACH.spar_losses_1]) : null;
      lines = [...lines, { turn: t, kind: 'narration', text: `(Canned narration ${++n}.) The grass hisses as the slime gathers itself again.`, mechanics: [`Turn ${t}: d100 ${40 + n} → Success`],
        place: placeOf(state), scenario: state.stage.scenarioNumber, ...(drop ? { downedBy: { by: 'the slime', weapon: 'acid lash', part: 'left leg', outcome: 'crushing hit' } } : {}), ...(hurt ?? {}), ...(lvl ?? {}), ...(earned ?? {}), ...(ended ?? {}), ...(ways ?? {}), ...(robbed ?? {}), ...(nerve ?? {}), ...(bandaged ?? {}) }];
      busy = false; emit();
    },
    async reset() { state = null; lines = []; fell = false; emit(); },
    endScenario() {},
    calls: () => n * 3 + 4,
    working: () => [],
    gm(): GmSnapshot { return { state, agentLog: state?.agentLog ?? [], log: state?.log ?? [], fallbackBanner: !!state?.stage.fallback, backups: state ? [{ turn: 0, path: 'stories/fake/backups/0' }] : [] }; },
    async restoreBackup() { emit(); },
    takePerk(id) { if (state) { takePerk(state, state.player, id); emit(); } },
    undoPerk(id) { if (state) { undoPerk(state, state.player, id); emit(); } },
    abandonQuest(id) { if (state && abandonQuest(state, id)) emit(); },
    pinQuest(id) { if (state) { pinQuest(state, id); emit(); } },
  };
}
