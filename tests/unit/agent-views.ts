// Small hand-built views for the W7 agent tests (no view builder needed).
import type { ActorView, DialogueView, NarrationView, PlayerView, ZoneView, PlannerOutput, VoiceOutput, Intent } from '../../src/types';

export const zone = (id: string, links: string[] = [], ground: string[] = []): ZoneView => ({
  id, name: id.replace(/_/g, ' '), look: `the ${id}`, cover: 'none', light: 'bright',
  links: links.map((to) => ({ to, label: `toward ${to}`, sight: true })), groundItems: ground.map((g) => ({ id: g, name: g })),
});

export function playerView(): PlayerView {
  return {
    turn: 1,
    player: {
      id: 'player', name: 'Aldric', classes: ['swordsman'], skills: ['melee_medium', 'block', 'persuasion', 'sight'], perks: [],
      health: 'Unhurt', parts: [],
      inventory: [{ id: 'sword_1', itemId: 'arming_sword', name: 'arming sword', kind: 'weapon', equippedIn: ['hand:right_arm'], modes: ['cut', 'thrust'] }],
      posture: 'open', standingDefense: 'block',
    },
    zone: zone('tav_common', ['tav_counter', 'street_door'], ['mug_1']),
    zones: [zone('tav_counter', ['tav_common'])],
    actors: [{ id: 'patron_1', label: 'an old drinker', zone: 'tav_common', level: 'full', gear: [] }],
    facts: [], headlines: [],
  };
}

export function actorView(id = 'guard_1'): ActorView {
  return {
    turn: 3,
    self: {
      id, label: 'a gate guard', name: 'Bertram', kind: 'npc', zone: 'gate_inner', placeId: 'gate', bandId: 'village_watch',
      health: 'Unhurt', parts: [], active: true, broken: false, surrendered: false, fearless: false, control: 'agent', standingDefense: 'block',
      gear: [{ id: 'spear_1', itemId: 'spear', name: 'spear', kind: 'weapon', equippedIn: ['hand:right_arm'], modes: ['thrust'] }],
      attackSkill: 'melee_medium', routines: [{ id: 'guard_post', brief: 'stand at the post' }, { id: 'guard_alert', brief: 'watch hard' }],
      slots: { post: 'gate_inner' },
    },
    beliefs: [{ about: 'player', status: 'suspicious', lastKnownZone: 'street_square', source: 'heard', revealed: [], opposed: true, active: true, label: 'a swordsman' }],
    perceived: [], told: [], secrets: [], firedTriggers: [],
    band: { id: 'village_watch', name: 'the village watch', goals: 'keep the gate', temperament: 'dutiful', tacticsLevel: 2, relations: {} },
    map: [{ id: 'gate_inner', links: [{ to: 'street_square', sight: true }, { to: 'field_edge', sight: true }] }],
    zones: [zone('gate_inner', ['street_square', 'field_edge'])],
    seen: [],
  };
}

export function dialogueView(id = 'trader'): DialogueView {
  const { plan: _p, memory: _m, secrets: _s, firedTriggers: _f, ...rest } = actorView(id);
  return {
    ...rest,
    self: { ...rest.self, name: 'Mags', label: 'the barkeep', routines: [{ id: 'barkeep', brief: 'tend the bar' }, { id: 'leave', brief: 'go home' }] },
    knows: [{ id: 'f_road', text: 'The north road floods in spring.' }],
    dialogue: [{ spoken: 'What news?', impression: 'convincing' }],
  };
}

export function narrationView(): NarrationView {
  return {
    style: { tone: 'grounded low fantasy', length: '2 to 4 short paragraphs' },
    events: [
      { id: 'e1', kind: 'presence', level: 'full', cue: 'sight', actor: 'an old drinker', activityLook: 'nursing a mug' },
      { id: 'e2', kind: 'move', level: 'partial', cue: 'sound', where: 'behind the bar' },
    ],
    player: { name: 'Aldric', health: 'Unhurt', parts: [], zone: 'tav_common' },
    surroundings: [zone('tav_common', ['tav_counter'])],
    heard: [], actors: [{ label: 'an old drinker', zone: 'tav_common', activityLook: 'nursing a mug' }], facts: [], headlines: [],
  };
}

export const intentOf = (over: Partial<Intent> = {}): Intent => ({
  move: null,
  action: { type: 'observe', skill: 'sight', target: null, targetPart: null, item: null, mode: null, approach: 'carefully', stance: 'careful' },
  gear: null, spoken: null, addressees: null, deferred: [], clarify: null, ...over,
});

export const plannerOut = (over: Partial<PlannerOutput['action']> = {}): PlannerOutput => ({
  action: { type: 'move', target: 'street_square', skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: 'check the square', ...over },
  dialogue: null, gear: null, stance: null, planUpdate: null,
});

export const voiceOut = (over: Partial<VoiceOutput> = {}): VoiceOutput => ({
  action: { type: 'talk', target: 'player', skill: null, targetPart: null, aimed: false, defense: null, item: null, mode: null, intent: 'answer' },
  line: 'The north road floods in spring.', volume: 'normal', shares: ['f_road'], gear: null, stance: null, routine: null, ...over,
});
