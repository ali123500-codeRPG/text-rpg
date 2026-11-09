// In-memory fake GameApi with canned lines, for building and screenshotting the screens until W7's pipeline lands.
import { TP } from '../library/templateIds';
import type { CreationBuild, GameApi, GameState, GmSnapshot, LogLine, Notice } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { takePerk, undoPerk } from '../ruleset';
import { abandonQuest, pinQuest } from '../engine/quests';
import { spawnNpc, validateBuild } from '../library/spawn';
import { playerFromBuild } from './sheet';
import { SK } from '../library/skillIds';
import { IT } from '../library/itemIds';
import { placeName } from '../agents/game';

const NARRATION = [
  'Rain needles the thatch of the Crooked Kettle. The common room smells of wet wool and old ale, and the barkeep watches you over a cup she has been wiping for some time.',
  'You step out past the gate. The field is streaked with silver trails, and something low and glistening shifts in the long grass by the trees.',
  'The slime lurches at you. You bring the round shield across, and the blow slaps wetly against the boards; your counter cuts a long furrow through its body.',
];

export const validateBuildLocal = (b: CreationBuild): string[] => validateBuild(b);

export function createFakeGame(opts: { autoStart?: boolean; fell?: boolean; notices?: Notice[]; banner?: boolean } = {}): GameApi {
  let state: GameState | null = null;
  let lines: LogLine[] = [];
  const KETTLE = { id: 'tavern', name: 'The Crooked Kettle' };
  const placeOf = (st: GameState) => ({ id: st.player.placeId, name: placeName(st) });
  let busy = false, fell = !!opts.fell, n = 0;
  const notices: Notice[] = opts.notices ?? [];
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());

  function start(b: CreationBuild) {
    const player = playerFromBuild(b, 'fake', 'tav_common', 'tavern');
    const settings = { difficulty: 'normal', showMechanics: CONFIG.SHOW_MECHANICS, tone: CONFIG.STYLE.tone };
    const slime = spawnNpc(null, TP.slime, { id: 'slime_1', zone: 'field_mid', placeId: 'field', bandId: 'slimes', storyId: 'fake', name: 'slime' });
    slime.mind!.knowledge = { player: { status: 'aware', lastKnownZone: 'field_edge', lastSeenTurn: 2, source: 'seen', revealed: [] } };
    const guard = spawnNpc(null, TP.guard, { id: 'guard_1', zone: 'tav_common', placeId: 'tavern', bandId: 'village_watch', storyId: 'fake', name: 'Bren' });
    state = {
      storyId: 'fake', turn: 4, mode: 'tactical', zones: [], player, actors: [slime, guard], bands: [], events: [],
      hidden: { plans: { slime_1: { goal: 'drive the stranger off the field', steps: ['slam', 'retreat to the trees'], triggers: [], createdTurn: 2 } }, memory: {}, secrets: [], firedLog: [], agreements: [{ id: 'ag_1', parties: ['player', 'guard_1'], text: 'He lets you back in after dark; you tell him if you see the thief.', madeTurn: 2, madeBy: 'guard_1' }], weaverNote: 'the slimes are fleeing something in the woods', stage: { eventSummary: 'slimes trouble the village', challenge: 'moderate', gain: 'minor', hiddenTerms: ['woods_beast'] } },
      agentLog: [{ turn: 3, agent: 'narrator', input: { view: 'NarrationView…' }, output: { text: NARRATION[2] }, status: 'ok', errors: [], modelTierApplied: 'complex' } as GameState['agentLog'][number],
        { turn: 3, agent: 'parser', input: { text: 'block and cut back' }, output: { intent: 'attack', target: 'slime_1' }, status: 'ok', errors: [], modelTierApplied: 'quick' } as GameState['agentLog'][number]],
      log: [{ turn: 3, code: 'planner_late' }, { turn: 3, code: 'skill_improved', detail: { skill: SK.block, from: 37, to: 40, milestone: 40 } }], rngSeed: 1, rngState: 1, pending: { turn: 3, mode: 'tactical', engaged: ['slime_1'], fired: [] },
      places: [{ id: 'tavern', storyId: 'fake', kind: 'tavern', parentId: null, names: { current: 'the Crooked Kettle', past: [] }, zones: [{ id: 'tav_common', placeId: 'tavern', name: 'common room', look: 'A low room with a hearth.', links: [], cover: 'some', light: 'dim', groundItems: [] }], state: {}, headlines: [] }], facts: [], stage: { zoneIds: [], tier: 'success', sceneNumber: 2, sceneStartTurn: 2, ...(opts.banner ? { fallback: { reason: 'Scene planning failed: placeholder area', turn: 2 } } : {}) },
      sceneCaps: { promotions: 0, minted: 0 }, clocks: {}, flags: {},
      quests: [
        { id: 'q0', state: 'done', text: 'Find a bed for the night', giver: 'guard_1', dealId: 'deal_0', goal: { kind: 'other' }, progress: 0, level: 'zero', startTurn: 1, endTurn: 2 },
        { id: 'q1', state: 'active', text: 'Clear the slimes from the field', giver: 'guard_1', dealId: 'ag_1', goal: { kind: 'defeat', by: 'body_type', of: slime.core.bodyTypeId, count: 3 }, progress: 1, level: 'i', startTurn: 2, after: 'q0', pay: { coin: 10 }, paid: { coin: 0, qty: 0 }, due: 3 * 1440 + 1080, dueBy: 'dusk' },
      ],
      settings, libraryVersion: 1, blueprints: [], meta: { storyId: 'fake', title: 'The slime field', schemaVersion: 1, createdAt: '2026-11-07', settings },
    };
    if (player.progression) { player.progression.marks = [SK.dodge, SK.eyesight]; player.progression.unspentPerkPoints = 1; }
    player.core.inventory.push({ id: 'player_draught', itemId: IT.healing_draught, qty: 2 }, { id: 'player_draught_2', itemId: IT.healing_draught, qty: 1 }, { id: 'player_bandage', itemId: IT.bandage, qty: 2 });
    player.core.condition.hpLostPct = 10; // healed from Hurt to Bruised on turn 3
    lines = [
      { turn: 1, kind: 'narration', text: NARRATION[0], place: KETTLE, scene: 1 },
      { turn: 2, kind: 'player', text: 'I head out through the gate to the field' },
      { turn: 2, kind: 'narration', text: NARRATION[1], place: KETTLE, scene: 2, gear: ['Now held: right hand · Arming sword', 'Now held: left hand · Round shield'] },
      { turn: 3, kind: 'player', text: 'I raise my shield and cut back at it', aimed: true },
      { turn: 3, kind: 'narration', text: NARRATION[2], place: KETTLE, scene: 2,
        check: { kind: 'attack', skill: SK.melee_medium, tier: 'great_success', against: { what: 'slime’s dodge', tier: 'success' }, result: 'full hit, body' },
        speech: [{ speaker: 'a gate guard', volume: 'shout', text: 'That’s one! Watch your left!' }],
        heals: [{ source: 'bandage', from: 'Hurt', to: 'Bruised', parts: [{ id: 'left_leg', from: 'Damaged', to: 'Healthy' }] }],
        unlocks: [{ skill: SK.block, milestone: 40 }], gains: { [SK.block]: 3 },
        incomingChecks: [{ kind: 'attack', skill: SK.melee_light, tier: 'great_success', against: { what: 'your block', tier: 'success' }, result: 'blocked, shield', by: 'the slime' }],
        changes: [{ kind: 'combat', text: 'Slime → you · blocked, shield' }, { kind: 'combat', text: 'You → slime · full hit, body' }, { kind: 'health', text: 'You are Bruised' }],
        mechanics: ['Slime slam: d100 71 + 30×0.5 + 10 → Great Success', 'Your block: d100 64 + 65×0.5 → Success · gap −1 · blocked (shield 30 → 18)', 'Your cut: d100 82 + 75×0.5 → Great Success · dodge 0 · full hit · 25 damage to body'] },
    ];
  }
  if (opts.autoStart) start({ name: 'Aldric', skills: { [SK.melee_medium]: 50, [SK.block]: 40, [SK.dodge]: 30, [SK.endurance]: 50, [SK.eyesight]: 30, [SK.earshot]: 30, [SK.feint]: 10, [SK.riposte]: 10 }, tagged: [SK.melee_medium, SK.block, SK.endurance] });

  return {
    state: () => state,
    lines: () => lines,
    notices: () => notices,
    busy: () => busy,
    fell: () => fell,
    subscribe(cb) { subs.add(cb); return () => subs.delete(cb); },
    validateBuild: validateBuildLocal,
    async newStory(b) { start(b); emit(); },
    async resume() { return state !== null; },
    async submit(text, o) {
      if (busy || !state) return;
      // numbered like the game: the turn's lines carry state.turn, then the turn advances; /undo steps back one
      const t = state.turn;
      if (text === '/undo') { fell = false; state.turn = Math.max(1, t - 1); lines = [...lines, { turn: state.turn, kind: 'command', text: 'Turn undone.' }]; emit(); return; }
      lines = [...lines, { turn: t, kind: text.startsWith('/') ? 'command' : 'player', text, ...(o?.aimed ? { aimed: true } : {}) }];
      busy = true; emit();
      await new Promise((r) => setTimeout(r, 600));
      state.turn = t + 1;
      if (/^(sneak|hide|vanish)\b/i.test(text)) state.player.posture = 'stealthy'; // shows the stealthy badge and bar
      lines = [...lines, { turn: t, kind: 'narration', text: `(Canned narration ${++n}.) The grass hisses as the slime gathers itself again.`, mechanics: [`Turn ${t}: d100 ${40 + n} → Success`],
        place: placeOf(state), scene: state.stage.sceneNumber }];
      busy = false; emit();
    },
    async reset() { state = null; lines = []; fell = false; emit(); },
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
