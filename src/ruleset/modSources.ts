// Every place a roll modifier comes from, by modifier type, so the library viewer's Stacking tab can show what feeds
// each type. Values are read from CONFIG and the library, so they follow the code. tests/unit/mod-sources.test.ts
// checks that each place in src that makes a typed modifier has exactly one entry here (same file, same type).
import type { Library, ModType } from '../types';
import { CONFIG } from '../config';
import { baneSkill, defeatsRoll, isBane } from './bane';
import { skillName } from '../library/skillNames';
import { PK } from '../library/perkIds';

/** the types a situation roll's modifiers carry (situationMods in gear.ts), besides gear */
export type SituationModType = 'perk' | 'status';
export type StackedType = ModType | SituationModType;
/** display names of the modifier types, in the order the viewer lists them */
export const MOD_TYPE_NAMES: Record<StackedType, string> = {
  achievement: 'Achievement', roll_perk: 'Perk', foe_perk: "Foe's perk", gear: 'Gear', wounds: 'Wounds', situational: 'Situation', aim: 'Aim',
  perk: 'Perk', status: 'Status',
};

/** one library entry that feeds a source, with the roll modifier it gives */
export type ModFeed = { table: 'perks' | 'items' | 'achievements'; id: string; name: string; value: string };
export type ModSource = {
  type: StackedType;
  /** skill rolls (ruleset.roll) or the situation roll (ruleset.situation, no skill) */
  roll: 'skill' | 'situation';
  source: string;
  when: string;
  value: string;
  /** the file that makes the modifier */
  at: string;
  feeds?: (lib: Library) => ModFeed[];
};

const sg = (n: number) => `${n > 0 ? '+' : ''}${+n.toFixed(2)}`;
const list = (o: Record<string, number>, skipZero = true) => Object.entries(o).filter(([, v]) => !skipZero || v).map(([k, v]) => `${k.replace(/_/g, ' ')} ${sg(v)}`).join(' · ');
const W = () => CONFIG.SKILL_WEIGHT;
const perk = (lib: Library, id: string): ModFeed[] => (lib.perks[id] ? [{ table: 'perks', id, name: lib.perks[id].name, value: '' }] : []);
const itemRollMods = (lib: Library, situation: boolean): ModFeed[] => Object.values(lib.items).flatMap((i) => (i.effects ?? [])
  .filter((e) => e.kind === 'rollMod' && (e.roll === 'situation') === situation)
  .map((e) => ({ table: 'items' as const, id: i.id, name: i.name, value: `${sg(e.value)} ${e.roll} rolls · when ${e.active}` })));

export const MOD_SOURCES: ModSource[] = [
  // achievement
  { type: 'achievement', roll: 'skill', source: 'Bane (race and body type)', at: 'src/ruleset/bane.ts',
    when: 'Any roll against a foe of that race or body type. The best race Bane and the best body type Bane both count.',
    value: `${W()} × (+${CONFIG.BANE_SKILL_PER_LEVEL} skill per level of the chain)`,
    feeds: (lib) => Object.entries(lib.achievements ?? {}).filter(([, a]) => isBane(a)).map(([k, a]) => ({ table: 'achievements', id: k, name: a.name, value: sg(W() * baneSkill(k)) })) },
  { type: 'achievement', roll: 'skill', source: 'Total defeats', at: 'src/ruleset/bane.ts',
    when: 'Attack, dodge and block rolls. Only the highest earned one counts.',
    value: `+${CONFIG.DEFEATS_ROLL_PER_TIER} per tier`,
    feeds: (lib) => Object.entries(lib.achievements ?? {}).filter(([, a]) => a.rule === 'defeats' && !a.by).map(([k, a]) => ({ table: 'achievements', id: k, name: a.name, value: sg(defeatsRoll(k)) })) },
  { type: 'achievement', roll: 'skill', source: 'Renown', at: 'src/ruleset/achRewards.ts',
    when: 'A foe\'s first morale check while it fights a player holding a renown achievement.', value: 'minus the achievement\'s renown',
    feeds: (lib) => Object.entries(lib.achievements ?? {}).filter(([, a]) => a.renown).map(([k, a]) => ({ table: 'achievements', id: k, name: a.name, value: sg(-a.renown!) })) },
  // roll_perk
  { type: 'roll_perk', roll: 'skill', source: '40/80/120 perk numbers', at: 'src/ruleset/perks.ts',
    when: 'Rolls of the perk\'s skill: rollAdd on every roll, hitAdd on attack rolls only.', value: 'the perk\'s rollAdd / hitAdd',
    feeds: (lib) => Object.values(lib.perks).filter((d) => d.ladder && (d.numbers?.rollAdd || d.numbers?.hitAdd)).map((d) => ({ table: 'perks', id: d.id, name: d.name,
      value: [d.numbers?.rollAdd ? `${sg(d.numbers.rollAdd)} every ${skillName(d.ladder!.skill)} roll` : '', d.numbers?.hitAdd ? `${sg(d.numbers.hitAdd)} ${skillName(d.ladder!.skill)} attack rolls` : ''].filter(Boolean).join(' · ') })) },
  { type: 'roll_perk', roll: 'skill', source: 'Steady Guard', at: 'src/ruleset/index.ts', when: 'Block rolls made with a melee weapon, not a shield.',
    value: sg(W() * CONFIG.STEADY_GUARD), feeds: (lib) => perk(lib, PK.steady_guard) },
  { type: 'roll_perk', roll: 'skill', source: 'Bare-Handed Guard', at: 'src/ruleset/index.ts', when: 'Dodge rolls while the owner holds no weapon.',
    value: sg(W() * CONFIG.BARE_HANDED_GUARD), feeds: (lib) => perk(lib, PK.bare_handed_guard) },
  // foe_perk
  { type: 'foe_perk', roll: 'skill', source: 'Dodgy', at: 'src/ruleset/allSteps.ts', when: 'Attack rolls against a foe who has Dodgy.',
    value: sg(-W() * CONFIG.DODGY_SKILL), feeds: (lib) => perk(lib, PK.dodgy) },
  // gear
  { type: 'gear', roll: 'skill', source: 'Weapon class hit', at: 'src/ruleset/index.ts', when: 'Attack rolls: the class hit plus the mode\'s hitAdj, as one entry.',
    value: `${list(Object.fromEntries(Object.entries(CONFIG.WEAPON_CLASSES).map(([k, c]) => [k, c.hit])), false)} · unarmed ${sg(CONFIG.UNARMED_PROFILE.hit)}`,
    feeds: (lib) => Object.values(lib.items).flatMap((i) => (i.weapon?.modes ?? []).filter((m) => m.hitAdj).map((m) => ({ table: 'items' as const, id: i.id, name: i.name,
      value: `${m.id}: ${sg((CONFIG.WEAPON_CLASSES[m.class] ?? CONFIG.UNARMED_PROFILE).hit + (m.hitAdj ?? 0))} (class ${sg((CONFIG.WEAPON_CLASSES[m.class] ?? CONFIG.UNARMED_PROFILE).hit)}, hitAdj ${sg(m.hitAdj ?? 0)})` }))) },
  { type: 'gear', roll: 'skill', source: 'Item roll effects', at: 'src/ruleset/gear.ts', when: 'Rolls of the kind the effect names, while the item is worn, held, in use or carried.',
    value: 'the effect\'s value', feeds: (lib) => itemRollMods(lib, false) },
  // wounds
  { type: 'wounds', roll: 'skill', source: 'Health level', at: 'src/ruleset/body.ts', when: 'Every roll, by the actor\'s place on the health track.',
    value: list(Object.fromEntries(CONFIG.HEALTH_TRACK.map(([l, , v]) => [l, v]))) },
  { type: 'wounds', roll: 'skill', source: 'Role wounds', at: 'src/ruleset/body.ts',
    when: 'Rolls whose skill uses a body role (grip, strike, sense …) on a damaged or crippled part. Shared roles split it across their parts; a crippled sense part hits every roll.',
    value: list(CONFIG.ROLE_PENALTY) },
  { type: 'wounds', roll: 'skill', source: 'Shield damaged', at: 'src/ruleset/body.ts', when: 'Block rolls with a Damaged shield.', value: sg(CONFIG.ROLE_PENALTY.damaged) },
  // situational
  { type: 'situational', roll: 'skill', source: 'Light', at: 'src/ruleset/gear.ts', when: 'Rolls whose skill has a light tag (sight, stealth …): the tag\'s sign × the light where the action is.',
    value: list(CONFIG.LIGHT_MODS) },
  { type: 'situational', roll: 'skill', source: 'Range', at: 'src/ruleset/index.ts', when: 'Ranged attacks, by zones to the target.',
    value: Object.entries(CONFIG.RANGE_MODS).filter(([d, v]) => +d >= 1 && v).map(([d, v]) => `${d} zone${+d === 1 ? '' : 's'} ${sg(v)}`).join(' · ') },
  { type: 'situational', roll: 'skill', source: 'Hostile in zone', at: 'src/ruleset/index.ts', when: 'Ranged attacks while a hostile shares the shooter\'s zone (Point Blank removes it).',
    value: sg(CONFIG.RANGE_MODS[0] ?? 0) },
  { type: 'situational', roll: 'skill', source: 'Outnumbered', at: 'src/ruleset/index.ts', when: 'Defense rolls after the first this turn (Blade Wall removes it for Block with a medium weapon).',
    value: sg(CONFIG.OUTNUMBERED_MOD) },
  { type: 'situational', roll: 'skill', source: 'Unaware', at: 'src/ruleset/index.ts', when: 'Defense rolls by a defender who didn\'t see the attack coming.', value: sg(CONFIG.UNAWARE_MOD) },
  { type: 'situational', roll: 'skill', source: 'Dodge vs missile', at: 'src/ruleset/index.ts', when: 'Dodge rolls against a ranged attack.', value: sg(CONFIG.DODGE_VS_MISSILE) },
  { type: 'situational', roll: 'skill', source: 'Scene difficulty', at: 'src/engine/resolve.ts', when: 'Look around rolls: moderate minus the scene\'s difficulty.',
    value: list(Object.fromEntries(Object.entries(CONFIG.DIFFICULTY).map(([k, v]) => [k, CONFIG.DIFFICULTY.moderate - v]))) },
  // aim
  { type: 'aim', roll: 'skill', source: 'Aimed part', at: 'src/ruleset/index.ts', when: 'Aimed attacks, by the size of the part aimed at. Contests drop it.',
    value: list(CONFIG.AIM_PENALTY) },
  // the situation roll (no skill)
  { type: 'perk', roll: 'situation', source: 'Perk situation bonus', at: 'src/ruleset/gear.ts', when: 'Situation rolls, for each perk with a situation value.',
    value: 'the perk\'s situation value', feeds: (lib) => Object.values(lib.perks).filter((d) => d.situation).map((d) => ({ table: 'perks', id: d.id, name: d.name, value: sg(d.situation!) })) },
  { type: 'gear', roll: 'situation', source: 'Item situation effects', at: 'src/ruleset/gear.ts', when: 'Situation rolls, for each item effect that names the situation roll.',
    value: 'the effect\'s value', feeds: (lib) => itemRollMods(lib, true) },
];
