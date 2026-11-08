// In-memory fake GameApi with canned lines, for building and screenshotting the screens until W7's pipeline lands.
import type { CreationBuild, GameApi, GameState, GmSnapshot, LogLine, Notice } from '../types';
import { CONFIG } from '../config';
import { getLibrary } from '../library';
import { takePerk, undoPerk } from '../ruleset';
import { spawnNpc, validateBuild } from '../library/spawn';
import { playerFromBuild } from './sheet';

const NARRATION = [
  'Rain needles the thatch of the Crooked Kettle. The common room smells of wet wool and old ale, and the barkeep watches you over a cup she has been wiping for some time.',
  'You step out past the gate. The field is streaked with silver trails, and something low and glistening shifts in the long grass by the trees.',
  'The slime lurches at you. You bring the round shield across, and the blow slaps wetly against the boards; your counter cuts a long furrow through its body.',
];

export const validateBuildLocal = (b: CreationBuild): string[] => validateBuild(b);

export function createFakeGame(opts: { autoStart?: boolean; fell?: boolean; notices?: Notice[]; banner?: boolean } = {}): GameApi {
  let state: GameState | null = null;
  let lines: LogLine[] = [];
  let busy = false, fell = !!opts.fell, n = 0;
  const notices: Notice[] = opts.notices ?? [];
  const subs = new Set<() => void>();
  const emit = () => subs.forEach((f) => f());

  function start(b: CreationBuild) {
    const player = playerFromBuild(b, 'fake', 'tav_common', 'tavern');
    const settings = { difficulty: 'normal', showMechanics: CONFIG.SHOW_MECHANICS, tone: CONFIG.STYLE.tone };
    const slime = spawnNpc(null, 'slime', { id: 'slime_1', zone: 'field_mid', placeId: 'field', bandId: 'slimes', storyId: 'fake', name: 'slime' });
    slime.mind!.knowledge = { player: { status: 'aware', lastKnownZone: 'field_edge', lastSeenTurn: 2, source: 'seen', revealed: [] } };
    state = {
      storyId: 'fake', turn: 3, mode: 'tactical', zones: [], player, actors: [slime], bands: [], events: [],
      hidden: { plans: { slime_1: { goal: 'drive the stranger off the field', steps: ['slam', 'retreat to the trees'], triggers: [], createdTurn: 2 } }, memory: {}, secrets: [], firedLog: [], weaverNote: 'the slimes are fleeing something in the woods', stage: { eventSummary: 'slimes trouble the village', challenge: 'moderate', gain: 'minor', hiddenTerms: ['woods_beast'] } },
      agentLog: [{ turn: 3, agent: 'narrator', input: { view: 'NarrationView…' }, output: { text: NARRATION[2] }, status: 'ok', errors: [], modelTierApplied: 'complex' } as GameState['agentLog'][number],
        { turn: 3, agent: 'parser', input: { text: 'block and cut back' }, output: { intent: 'attack', target: 'slime_1' }, status: 'ok', errors: [], modelTierApplied: 'quick' } as GameState['agentLog'][number]],
      log: [{ turn: 3, code: 'planner_late' }, { turn: 3, code: 'skill_improved', detail: { skill: 'block', from: 37, to: 40, milestone: 40 } }], rngSeed: 1, rngState: 1, pending: { turn: 3, mode: 'tactical', engaged: ['slime_1'], fired: [] },
      places: [], facts: [], stage: { zoneIds: [], tier: 'success', sceneNumber: 2, sceneStartTurn: 2, ...(opts.banner ? { fallback: { reason: 'Scene planning failed: placeholder area', turn: 2 } } : {}) },
      sceneCaps: { promotions: 0, minted: 0 }, clocks: {}, flags: {},
      quests: [{ id: 'q1', state: 'active', text: 'Clear the slimes from the field' }, { id: 'q2', state: 'active', text: 'Ask the barkeep about the woods' }, { id: 'q0', state: 'done', text: 'Find a bed for the night' }],
      settings, libraryVersion: 1, blueprints: [], meta: { storyId: 'fake', title: 'The slime field', schemaVersion: 1, createdAt: '2026-11-07', settings },
    };
    if (player.progression) { player.progression.marks = ['dodge', 'sight']; player.progression.unspentPerkPoints = 1; }
    player.core.inventory.push({ id: 'player_draught', itemId: 'healing_draught', qty: 2 }, { id: 'player_draught_2', itemId: 'healing_draught', qty: 1 }, { id: 'player_bandage', itemId: 'bandage', qty: 2 });
    player.core.condition.hpLostPct = 10; // healed from Hurt to Bruised on turn 3
    lines = [
      { turn: 1, kind: 'narration', text: NARRATION[0] },
      { turn: 2, kind: 'player', text: 'I head out through the gate to the field' },
      { turn: 2, kind: 'narration', text: NARRATION[1] },
      { turn: 3, kind: 'player', text: 'I raise my shield and cut back at it' },
      { turn: 3, kind: 'narration', text: NARRATION[2],
        check: { kind: 'attack', skill: 'melee_medium', tier: 'great_success', against: { what: 'slime’s dodge', tier: 'success' }, result: 'full hit, body' },
        speech: [{ speaker: 'a gate guard', volume: 'shout', text: 'That’s one! Watch your left!' }],
        heals: [{ source: 'bandage', from: 'Hurt', to: 'Bruised', parts: [{ id: 'left_leg', from: 'Damaged', to: 'Healthy' }] }],
        unlocks: [{ skill: 'block', milestone: 40 }], gains: { block: 3 },
        changes: [{ kind: 'combat', text: 'Slime → you · blocked, shield' }, { kind: 'combat', text: 'You → slime · full hit, body' }, { kind: 'health', text: 'You are Bruised' }],
        mechanics: ['Slime slam: d100 71 + 30×0.5 + 10 → Great Success', 'Your block: d100 64 + 65×0.5 → Success · gap −1 · blocked (shield 30 → 18)', 'Your cut: d100 82 + 75×0.5 → Great Success · dodge 0 · full hit · 25 damage to body'] },
    ];
  }
  if (opts.autoStart) start({ name: 'Aldric', skills: { melee_medium: 50, block: 40, dodge: 30, endurance: 50, sight: 30, hearing: 30, feint: 10, riposte: 10 }, tagged: ['melee_medium', 'block', 'endurance'] });

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
      const t = state.turn + 1;
      lines = [...lines, { turn: t, kind: text.startsWith('/') ? 'command' : 'player', text: o.aimed ? `${text} (aimed)` : text }];
      if (text === '/undo') { fell = false; lines = [...lines, { turn: t, kind: 'notice', text: 'Rewound one turn.' }]; emit(); return; }
      busy = true; emit();
      await new Promise((r) => setTimeout(r, 600));
      state.turn = t;
      if (/^(sneak|hide|vanish)\b/i.test(text)) state.player.posture = 'stealthy'; // shows the stealthy badge and bar
      lines = [...lines, { turn: t, kind: 'narration', text: `(Canned narration ${++n}.) The grass hisses as the slime gathers itself again.`, mechanics: [`Turn ${t}: d100 ${40 + n} → Success`] }];
      busy = false; emit();
    },
    async reset() { state = null; lines = []; fell = false; emit(); },
    calls: () => n * 3 + 4,
    working: () => [],
    gm(): GmSnapshot { return { state, agentLog: state?.agentLog ?? [], log: state?.log ?? [], fallbackBanner: !!state?.stage.fallback, backups: state ? [{ turn: 0, path: 'stories/fake/backups/0' }] : [] }; },
    async restoreBackup() { emit(); },
    takePerk(id) { if (state) { takePerk(state, state.player, id); emit(); } },
    undoPerk(id) { if (state) { undoPerk(state, state.player, id); emit(); } },
  };
}
