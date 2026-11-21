// D-141 (VW2 a): the Witness. A chat beside play, outside the turn: the player talks over a goal and the Witness answers
// in plain words; once a vow has taken shape it fills the vow form. Code reads the form (engine/vows.ts readVow): a form
// code cannot check is sent back once with the reason, so the Witness can say why and offer the nearest one it can.
// The Witness sees only what the player knows. It never sets a vow: the player's Swear does.
import type { GameState, Vow } from '../types';
import { getLibrary, itemDef } from '../library';
import { SKILL_NAMES } from '../library/skillNames';
import { REWARD_LEVELS } from '../scales';
import { CONFIG } from '../config';
import { zoneById } from '../engine/relations';
import { charLevel } from '../engine/xp';
import { activeVows, readVow, vowXp, VOW_ACTS, type VowForm } from '../engine/vows';
import { trueSkill } from '../ruleset/perks';
import { callName } from '../views';
import { runAgent, type AgentCtx } from './call';
import { FIXED } from './prompts';
import { checkWitness } from './schema';

export type WitnessLine = { by: 'player' | 'witness'; text: string };
/** what one Witness call gives the screen: its words, and a vow ready to swear when one took shape */
export type WitnessReply = { reply: string; form?: VowForm; vow?: Vow };

/** the Witness's data: the player's sheet, the people, places and things they know, what vows may ask and stake, and the chat */
export function witnessData(s: GameState, chat: readonly WitnessLine[]): string {
  const p = s.player, lib = getLibrary(), j = p.journal;
  const held = new Set((p.progression?.achievements ?? []).map((a) => a.key));
  const people = [...new Set([...Object.keys(j?.lastKnown ?? {}), ...Object.keys(j?.clearSight ?? {})])].filter((id) => id !== p.id)
    .map((id) => `${id}: ${callName(s, p.id, id)}`);
  const places = (j?.zonesSeen ?? []).map((id) => `${id}: ${zoneById(s, id)?.name ?? id}`);
  const carried = p.core.inventory.map((i) => { try { return `${i.id}: ${itemDef(s, i.itemId).name}`; } catch { return ''; } }).filter(Boolean);
  const skills = Object.keys(p.core.skills).filter((k) => SKILL_NAMES[k]).map((k) => `${SKILL_NAMES[k]} ${Math.floor(trueSkill(p, k))}`);
  const achievements = Object.entries(lib.achievements ?? {}).filter(([k, d]) => !held.has(k) && !d.name.includes('{')).map(([k, d]) => `${k}: ${d.name}`);
  return [
    `SHEET: ${JSON.stringify({ level: charLevel(p), skills, essencesTaken: p.progression?.tally?.essences_taken ?? 0 })}`,
    `PEOPLE (id: how the player knows them):\n${people.join('\n') || '(none)'}`,
    `PLACES (id: name):\n${places.join('\n') || '(none)'}`,
    `CARRIED (item id: name):\n${carried.join('\n') || '(nothing)'}`,
    `KINDS (for defeat goals): races ${Object.values(lib.races ?? {}).map((r) => r.name).join(', ')}; body types ${Object.values(lib.bodyTypes ?? {}).map((b) => b.name).join(', ')}`,
    `ACHIEVEMENTS NOT YET HELD (key: name):\n${achievements.join('\n')}`,
    `ACTS (for restraint vows): ${VOW_ACTS.join(', ')}`,
    `RULES: ${JSON.stringify({ activeVows: activeVows(s).map((v) => v.text), most: CONFIG.VOW_MAX_ACTIVE, days: [CONFIG.VOW_DAYS_MIN, CONFIG.VOW_DAYS_MAX],
      stakes: CONFIG.VOW_STAKES.map((k) => ({ stake: REWARD_LEVELS.name(k), thread: vowXp(s, k) })) })}`,
    `CHAT (oldest first):\n${chat.map((l) => `${l.by}: ${l.text}`).join('\n')}`,
  ].join('\n\n');
}

/** one Witness call on the chat so far; null when the call failed */
export async function callWitness(s: GameState, chat: readonly WitnessLine[], ctx: AgentCtx): Promise<WitnessReply | null> {
  let vow: Vow | undefined;
  const run = await runAgent(ctx, {
    agent: 'witness', fixed: FIXED.witness, data: witnessData(s, chat), schema: checkWitness,
    accept: (v) => {
      if (!v.vow) return { kind: 'ok', value: v };
      const r = readVow(s, v.vow);
      if ('vow' in r) { vow = r.vow; return { kind: 'ok', value: v }; }
      return { kind: 'retry', errors: ['vow_refused', r.error], note: `code cannot take that vow: ${r.error}. Tell the player why in reply and offer the nearest vow code can check, with vow null until they agree` };
    },
  });
  if (!run.value) return null;
  return { reply: run.value.reply, ...(run.value.vow && vow ? { form: run.value.vow, vow } : {}) };
}
