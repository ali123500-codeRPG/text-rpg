// Every place a roll modifier comes from, by modifier type, so the library viewer's Stacking tab can show what feeds
// each type. Values are read from CONFIG and the library, so they follow the code. tests/unit/mod-sources.test.ts
// checks that each place in src that makes a typed modifier has exactly one entry here (same file, same type).
import { modeName } from './gear';
import type { Library, ModType } from '../types';
import { CONFIG } from '../config';
import { GRADE_LEVELS, HEALTH_LEVELS, MORALE_LEVELS, PART_STATES, type MoraleLevel, type PartStateKey } from '../scales';
import { GRADES } from '../types/core';
import { gradeMod } from './index';
import { MILESTONES } from './perks';
import { baneSkill, defeatsRoll, isBane } from './bane';
import { skillName } from '../library/skillNames';
import { PK } from '../library/perkIds';

/** the types a event roll's modifiers carry (eventRollMods in gear.ts), besides gear */
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
  /** skill rolls (ruleset.roll) or the event roll (ruleset.eventRoll, no skill) */
  roll: 'skill' | 'event';
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
const itemRollMods = (lib: Library, eventRoll: boolean): ModFeed[] => Object.values(lib.items).flatMap((i) => (i.effects ?? [])
  .filter((e) => e.kind === 'rollMod' && (e.roll === 'event') === eventRoll)
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
    when: 'Every morale roll of a foe fighting a player holding a renown achievement (MB24).', value: 'minus the achievement\'s renown',
    feeds: (lib) => Object.entries(lib.achievements ?? {}).filter(([, a]) => a.renown).map(([k, a]) => ({ table: 'achievements', id: k, name: a.name, value: sg(-a.renown!) })) },
  { type: 'achievement', roll: 'skill', source: 'Rally', at: 'src/ruleset/achRewards.ts',
    when: 'An ally\'s morale roll while it fights beside a player holding a rally achievement.', value: 'plus the achievement\'s rally',
    feeds: (lib) => Object.entries(lib.achievements ?? {}).filter(([, a]) => a.rally).map(([k, a]) => ({ table: 'achievements', id: k, name: a.name, value: sg(a.rally!) })) },
  // roll_perk
  { type: 'roll_perk', roll: 'skill', source: `${MILESTONES.filter((_, i) => i % 2 === 1).join('/')} perk numbers`, at: 'src/ruleset/perks.ts',
    when: 'Rolls of the perk\'s skill: rollAdd on every roll, hitAdd on attack rolls only.', value: 'the perk\'s rollAdd / hitAdd',
    feeds: (lib) => Object.values(lib.perks).filter((d) => d.ladder && (d.numbers?.rollAdd || d.numbers?.hitAdd)).map((d) => ({ table: 'perks', id: d.id, name: d.name,
      value: [d.numbers?.rollAdd ? `${sg(d.numbers.rollAdd)} every ${skillName(d.ladder!.skill)} roll` : '', d.numbers?.hitAdd ? `${sg(d.numbers.hitAdd)} ${skillName(d.ladder!.skill)} attack rolls` : ''].filter(Boolean).join(' · ') })) },
  { type: 'roll_perk', roll: 'skill', source: 'Steady Guard', at: 'src/ruleset/index.ts', when: 'Parry rolls made with a medium melee weapon.',
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
      value: `${modeName(m)}: ${sg((CONFIG.WEAPON_CLASSES[m.class] ?? CONFIG.UNARMED_PROFILE).hit + (m.hitAdj ?? 0))} (class ${sg((CONFIG.WEAPON_CLASSES[m.class] ?? CONFIG.UNARMED_PROFILE).hit)}, hitAdj ${sg(m.hitAdj ?? 0)})` }))) },
  { type: 'gear', roll: 'skill', source: 'Item roll effects', at: 'src/ruleset/gear.ts', when: 'Rolls of the kind the effect names, while the item is worn, held, in use or carried.',
    value: 'the effect\'s value', feeds: (lib) => itemRollMods(lib, false) },
  // wounds
  { type: 'wounds', roll: 'skill', source: 'Health level', at: 'src/ruleset/body.ts', when: 'Every roll, by the actor\'s place on the health track.',
    value: list(Object.fromEntries(CONFIG.HEALTH_TRACK.map(([l, , v]) => [HEALTH_LEVELS.name(l), v]))) },
  { type: 'wounds', roll: 'skill', source: 'Morale level', at: 'src/ruleset/morale.ts', when: 'Every roll, the morale roll included (fear feeds on itself), by the actor\'s morale level (MB3).',
    value: CONFIG.MORALE_TRACK.filter(([, , v]) => v).map(([k, , v]) => `${MORALE_LEVELS.name(k as MoraleLevel)} ${sg(v as number)}`).join(' · ') },
  { type: 'wounds', roll: 'skill', source: 'Role wounds', at: 'src/ruleset/body.ts',
    when: 'Rolls whose skill uses a body role (grip, strike, sense …) on a damaged or crippled part. Shared roles split it across their parts; a crippled sense part hits every roll.',
    value: list(Object.fromEntries(Object.entries(CONFIG.ROLE_PENALTY).map(([k, v]) => [PART_STATES.name(k as PartStateKey), v]))) }, // BG-91
  { type: 'wounds', roll: 'skill', source: 'Essential part crippled', at: 'src/ruleset/body.ts',
    when: 'Every roll while any essential part (head, neck …) is Crippled or worse; once, however many such parts.', value: sg(CONFIG.ESSENTIAL_CRIPPLED_PENALTY) },
  { type: 'wounds', roll: 'skill', source: 'Shield damaged', at: 'src/ruleset/body.ts', when: 'Block rolls with a Damaged shield.', value: sg(CONFIG.ROLE_PENALTY.damaged) },
  // situational
  { type: 'situational', roll: 'skill', source: 'Light', at: 'src/ruleset/gear.ts', when: 'Rolls whose skill has a light tag (sight, stealth …): the tag\'s sign × the light where the action is.',
    value: list(CONFIG.LIGHT_MODS) },
  { type: 'situational', roll: 'skill', source: 'Range', at: 'src/ruleset/index.ts', when: 'Ranged attacks, by the distance to the target as a share of the weapon\'s reach (both from real metres).',
    value: CONFIG.RANGE_SHARE_MODS.map(([share, v]) => `up to ${Math.round(share * 100)}% ${sg(v)}`).join(' · ') },
  { type: 'situational', roll: 'skill', source: 'Hostile close', at: 'src/ruleset/index.ts', when: `Ranged attacks with a hostile within ${CONFIG.HOSTILE_NEAR_M} m of the shooter, close enough to strike or grab (Point Blank removes it).`,
    value: sg(CONFIG.HOSTILE_NEAR_MOD) },
  { type: 'situational', roll: 'skill', source: 'Outnumbered', at: 'src/ruleset/index.ts', when: 'Defense rolls after the first this turn (Blade Wall removes it for Parry with a medium weapon, Shield Wall for Block, Slip the Crowd for Dodge).',
    value: sg(CONFIG.OUTNUMBERED_MOD) },
  { type: 'situational', roll: 'skill', source: 'Unaware', at: 'src/ruleset/index.ts', when: 'Defense rolls by a defender who didn\'t see the attack coming.', value: sg(CONFIG.UNAWARE_MOD) },
  { type: 'situational', roll: 'skill', source: 'Dodge vs missile', at: 'src/ruleset/index.ts', when: 'Dodge rolls against a ranged attack.', value: sg(CONFIG.DODGE_VS_MISSILE) },
  { type: 'situational', roll: 'skill', source: 'Scenario difficulty', at: 'src/engine/resolve.ts', when: 'Look around rolls: moderate minus the scenario\'s difficulty, at the roll\'s skill weight, so a task at your own grade plays the same at every level.',
    value: GRADE_LEVELS.keys.map((k) => `${GRADE_LEVELS.name(k)} ${sg(gradeMod(CONFIG.DIFFICULTY[k]))}`).join(' · ') },
  { type: 'situational', roll: 'skill', source: 'Waking', at: 'src/engine/sleep.ts', when: 'A light sleeper\'s hearing check against someone hostile moving openly near it (NW19): the grade their noise sets, louder is easier.',
    value: Object.entries(CONFIG.WAKE_GRADE).map(([k, g]) => `${k} ${sg(gradeMod(CONFIG.DIFFICULTY[g]))}`).join(' · ') },
  { type: 'situational', roll: 'skill', source: 'Lock', at: 'src/engine/resolve.ts', when: 'Lockpicking rolls (BA2): the lock\'s grade.', value: GRADES.map((k) => `${GRADE_LEVELS.name(k)} ${sg(CONFIG.LOCK_GRADE_MOD[k])}`).join(' · ') },
  { type: 'situational', roll: 'skill', source: 'Repeat try', at: 'src/ruleset/pressure.ts',
    when: 'Persuading, lying, threatening or haggling again at the same listener in one engagement (plain talk never counts).', value: `−${CONFIG.REPEAT_TRY} × earlier tries` },
  { type: 'situational', roll: 'skill', source: 'Travel pace', at: 'src/engine/travel.ts', when: 'The noticing roll on a road trip when something meets you, by pace (TV8).',
    value: `slow ${sg(CONFIG.TRAVEL_NOTICE_MOD.slow)}, fast ${sg(CONFIG.TRAVEL_NOTICE_MOD.fast)}` },
  // status
  { type: 'status', roll: 'skill', source: 'Shaken', at: 'src/ruleset/pressure.ts',
    when: 'Every roll against someone whose intimidation beat you, until your engagement ends.', value: `−${CONFIG.SHAKEN_PER_TIER} × tiers lost by` },
  { type: 'status', roll: 'skill', source: 'Swayed', at: 'src/ruleset/pressure.ts',
    when: 'Every roll against someone whose persuasion beat you, until your engagement ends.', value: `−${CONFIG.SWAYED_PER_TIER} × tiers lost by` },
  // aim
  { type: 'aim', roll: 'skill', source: 'Aimed part', at: 'src/ruleset/index.ts', when: 'Aimed attacks, by the size of the part aimed at.',
    value: list(CONFIG.AIM_PENALTY) },
  // the event roll (no skill)
  { type: 'perk', roll: 'event', source: 'Perk event-roll bonus', at: 'src/ruleset/gear.ts', when: 'Event rolls, for each perk with an event-roll value.',
    value: 'the perk\'s event-roll value', feeds: (lib) => Object.values(lib.perks).filter((d) => d.eventRoll).map((d) => ({ table: 'perks', id: d.id, name: d.name, value: sg(d.eventRoll!) })) },
  { type: 'gear', roll: 'event', source: 'Item event-roll effects', at: 'src/ruleset/gear.ts', when: 'Event rolls, for each item effect that names the event roll.',
    value: 'the effect\'s value', feeds: (lib) => itemRollMods(lib, true) },
  { type: 'achievement', roll: 'event', source: 'Achievement event-roll bonus', at: 'src/ruleset/gear.ts', when: 'Event rolls, for the best current achievement with an event-roll value.',
    value: 'the achievement\'s event-roll value', feeds: (lib) => Object.entries(lib.achievements ?? {}).filter(([, a]) => a.eventRoll).map(([k, a]) => ({ table: 'achievements', id: k, name: a.name, value: sg(a.eventRoll!) })) },
  { type: 'situational', roll: 'event', source: 'Night travel', at: 'src/engine/travel.ts', when: 'Event rolls for an encounter on a trip pressed on through dusk or night (TV4).',
    value: sg(CONFIG.NIGHT_TRAVEL_EVENT_MOD) },
];
