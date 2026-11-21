// Every action the player or an NPC can take, with what it rolls and what that roll is up against: the library
// viewer's Actions tab. Skill pairs come from the same constants the engine rolls (CONTEST in ./contests,
// SPEECH_SKILL/answerSkill in src/engine/speech.ts), so the tab cannot drift from play. Rolls whose skill depends on
// the moment (a weapon's skill, a function's best skill) name the function or the source instead.
import { NPC_ACTIONS, PARSER_ACTIONS, SPEECH_ACTIONS } from '../types/agents';
import { PUSH_TYPES, answerSkill, speechSkill } from '../engine/speech';
import { CONTEST } from './contests';
import { FN } from './functionIds';
import { PK } from './perkIds';
import { DETECTION_SENSES, SK } from './skillIds';

/** one side of a roll: named skills (one of them, by the rule's choice), skill functions (the best skill of each), the
 * weapon in hand's skill, or `text` for a side that is not a skill (a grade, a quality roll) */
export type ActSide = { skills?: readonly string[]; fns?: readonly string[]; weapon?: true; text?: string };
export type ActionRow = { id: string; who: 'both' | 'player' | 'npc'; roll: ActSide | null; against: ActSide | null; at: string };
export type ActionGroup = { key: 'actions' | 'moves' | 'passive'; rows: ActionRow[] };

const sk = (...skills: string[]): ActSide => ({ skills });
const fn = (...fns: string[]): ActSide => ({ fns });
const SENSES = fn(...DETECTION_SENSES);
const DEFENSE = sk(SK.dodge, SK.parry, SK.block);
const speech = (t: string): Pick<ActionRow, 'roll' | 'against'> => ({ roll: sk(speechSkill(t)), against: sk(answerSkill(t)) });

/** the main actions, keyed by their Parser/NPC action type */
const MAIN: Record<string, Omit<ActionRow, 'id' | 'who'>> = {
  attack: { roll: { weapon: true }, against: DEFENSE, at: 'doAttack, src/engine/resolve.ts' },
  sneak: { roll: fn(FN.stealth), against: SENSES, at: 'stealthDetect, src/minds/state.ts' },
  search: { roll: SENSES, against: fn(FN.stealth), at: 'searchFor, src/minds/state.ts' },
  stash: { roll: fn(FN.stealth), against: SENSES, at: 'doStash, src/engine/resolve.ts' },
  ...Object.fromEntries(SPEECH_ACTIONS.map((t) => [t, { ...(PUSH_TYPES.includes(t) ? speech(t) : { roll: null, against: null }), at: 'doSpeak, src/engine/resolve.ts' }])), // plain talk rolls nothing
  observe: { roll: SENSES, against: { text: 'Difficulty' }, at: 'doGeneric, src/engine/resolve.ts' },
  interact: { roll: { text: 'Skill the deed calls for' }, against: { text: 'Difficulty' }, at: 'doGeneric, src/engine/resolve.ts' },
  use_item: { roll: { text: 'Skill the deed calls for' }, against: { text: 'Difficulty' }, at: 'doGeneric, src/engine/resolve.ts' },
  other: { roll: { text: 'Skill the deed calls for' }, against: { text: 'Difficulty' }, at: 'doGeneric, src/engine/resolve.ts' },
  pick: { roll: fn(FN.lockpicking), against: { text: 'Lock grade' }, at: 'doPick, src/engine/resolve.ts' },
  break: { roll: { weapon: true, skills: [SK.unarmed_improvised] }, against: { text: 'Barrier grade' }, at: 'doBreak, src/engine/resolve.ts' },
  restrain: { roll: sk(CONTEST.restrain.roll), against: sk(...CONTEST.restrain.against), at: 'restrain, src/engine/held.ts' },
  filch: { roll: fn(FN.filching), against: SENSES, at: 'filchContest, src/engine/filch.ts' },
  show: { roll: fn(FN.filching), against: SENSES, at: 'doShow, src/engine/resolve.ts' },
  steady: { roll: fn(FN.morale), against: null, at: 'steady, src/engine/steady.ts' },
  heal: { roll: fn(FN.healing), against: null, at: 'doHeal, src/engine/resolve.ts' },
  repair: { roll: fn(FN.handiwork), against: { text: 'Item need' }, at: 'doRepair, src/engine/resolve.ts' }, // D-89
  extract: { roll: { text: 'Essence quality' }, against: null, at: 'extractEssence, src/engine/extract.ts' },
  ...Object.fromEntries(['move', 'flee', 'hold', 'call_help', 'give', 'take', 'buy', 'sell', 'rest', 'wait', 'sleep', 'open']
    .map((t) => [t, { roll: null, against: null, at: 'doMain, src/engine/resolve.ts' }])),
};
const whoOf = (t: string): ActionRow['who'] => {
  const p = (PARSER_ACTIONS as readonly string[]).includes(t), n = (NPC_ACTIONS as readonly string[]).includes(t);
  return p && n ? 'both' : p ? 'player' : 'npc';
};
/** every action type either list names, in the Parser's order then the NPC-only ones */
export const ACTION_TYPES: string[] = [...new Set<string>([...PARSER_ACTIONS, ...NPC_ACTIONS])];

/** perk moves: the actions a perk gives (PERK_MOVES), keyed by perk */
const MOVES: Record<string, Omit<ActionRow, 'id'>> = {
  [PK.bluff]: { who: 'both', ...speech('deceive'), at: 'perk move, src/engine/perkMoves.ts' },
  [PK.dirt_in_the_eyes]: { who: 'both', roll: sk(CONTEST.dirt_in_the_eyes.roll), against: sk(CONTEST.dirt_in_the_eyes.against), at: 'perk move, src/engine/perkMoves.ts' },
  [PK.play_dead]: { who: 'both', roll: sk(CONTEST.play_dead.roll), against: sk(answerSkill('deceive')), at: 'src/engine/playDead.ts' },
  [PK.draw_them_in]: { who: 'both', roll: sk(CONTEST.draw_them_in.roll), against: sk(CONTEST.draw_them_in.against), at: 'doDrawThemIn, src/engine/resolve.ts' },
  [PK.battle_cry]: { who: 'both', roll: sk(SK.intimidation), against: sk(SK.resolve), at: 'battleCry, src/engine/auras.ts' },
  [PK.rally]: { who: 'both', roll: sk(SK.command), against: null, at: 'rallyCall, src/engine/auras.ts' },
  [PK.grit_your_teeth]: { who: 'player', roll: fn(FN.morale), against: null, at: 'steady, src/engine/steady.ts' },
};

/** contests nobody chooses: they roll when something else happens */
const PASSIVE: ActionRow[] = [
  { id: 'size_up', who: 'both', roll: sk(CONTEST.size_up.roll), against: sk(CONTEST.size_up.against), at: 'sizeUp, src/engine/speech.ts' },
  { id: 'ambush', who: 'both', roll: sk(SK.combat_stealth), against: SENSES, at: 'resolveAmbush and stealthDetect, src/minds/state.ts' },
  { id: 'break_free', who: 'both', roll: sk(CONTEST.restrain.roll), against: sk(CONTEST.restrain.roll), at: 'breakFree, src/engine/held.ts' },
  { id: 'wake', who: 'both', roll: fn(FN.stealth), against: sk(SK.earshot), at: 'wakeCheck, src/engine/sleep.ts' },
  { id: 'aura', who: 'both', roll: { text: 'Aura skill' }, against: sk(SK.resolve), at: 'auraContest, src/engine/auras.ts' },
  { id: PK.overheard, who: 'both', ...speech('deceive'), at: 'overhearLie, src/engine/speech.ts' },
];

export const ACTIONS: ActionGroup[] = [
  { key: 'actions', rows: ACTION_TYPES.map((id): ActionRow => ({ id, who: whoOf(id), ...(MAIN[id] ?? { roll: null, against: null, at: '' }) })).sort((x, y) => Number(!x.roll) - Number(!y.roll)) }, // rolled first
  { key: 'moves', rows: Object.entries(MOVES).map(([id, r]) => ({ id, ...r })) },
  { key: 'passive', rows: PASSIVE },
];
/** the actions with no row of their own in MAIN (a new action type lands here until it gets one); a test keeps it empty */
export const unlistedActions = (): string[] => ACTION_TYPES.filter((t) => !MAIN[t]);
