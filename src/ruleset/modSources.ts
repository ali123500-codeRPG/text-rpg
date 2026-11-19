// Every place a roll modifier comes from, by modifier type, so the library viewer's Stacking tab can show what feeds
// each type. Values are read from CONFIG and the library, so they follow the code. tests/unit/mod-sources.test.ts
// checks that each place in src that makes a typed modifier has exactly one entry here (same file, same type).
import { coverMod, modeName } from './gear';
import { HUMANOID_SIZE } from '../library/bodySize';
import { D100_MEAN } from '../rng';
import type { Library, ModType } from '../types';
import { CONFIG } from '../config';
import { lightMod } from '../time';
import { ATTENTION, COVER, FATIGUE_LEVELS, GRADE_LEVELS, HEALTH_LEVELS, LIGHT, MORALE_LEVELS, NOISE, PART_STATES, type AttentionKey, type MoraleLevel, type NoiseKey, type PartStateKey } from '../scales';
import { GRADES } from '../types/core';
import { gradeMod } from './index';
import { MILESTONES } from './perks';
import { DEFEATS_ROLLS, baneSkill, defeatsRoll, isBane } from './bane';
import { rewardOf } from './achRewards';
import { cap, listWords } from '../words';
import { skillName } from '../library/skillNames';
import { PK } from '../library/perkIds';
import { perkName } from '../library';

/** the types an event roll's modifiers carry (eventRollMods in gear.ts), besides gear */
export type SituationModType = 'perk' | 'status';
export type StackedType = ModType | SituationModType;
/** display names of the modifier types, in the order the viewer lists them */
export const MOD_TYPE_NAMES: Record<StackedType, string> = {
  achievement: 'Achievement', roll_perk: 'Perk', foe_perk: "Foe's perk", gear: 'Gear', wounds: 'Wounds', situational: 'Situation', aim: 'Aim',
  perk: 'Perk', status: 'Status', rating: 'Rating',
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
/** PW5 a: wound penalties are % of the average roll (woundsOnRoll, src/ruleset/body.ts) */
const OF_AVG = ` of the average roll (${D100_MEAN} + ${CONFIG.SKILL_WEIGHT} × effective skill)`;
const pctList = (o: Record<string, number>) => `${Object.entries(o).map(([k, v]) => `${k} ${sg(v)}%`).join(' · ')}${OF_AVG}`;
const W = () => CONFIG.SKILL_WEIGHT;
const perk = (lib: Library, id: string): ModFeed[] => (lib.perks[id] ? [{ table: 'perks', id, name: lib.perks[id].name, value: '' }] : []);
const itemRollMods = (lib: Library, eventRoll: boolean): ModFeed[] => Object.values(lib.items).flatMap((i) => (i.effects ?? [])
  .filter((e) => e.kind === 'rollMod' && (e.roll === 'event') === eventRoll)
  .map((e) => ({ table: 'items' as const, id: i.id, name: i.name, value: `${sg(e.value)} ${e.roll} rolls · when ${e.active}` })));

/** CV6: the cover modifier for a standing person at each level */
const COVER_PERSON = COVER.keys.map((k) => `${COVER.name(k)} ${sg(coverMod(1 - (CONFIG.COVER_HIDDEN[k] ?? 0)))}`).join(' · ');
export const MOD_SOURCES: ModSource[] = [
  // achievement
  { type: 'achievement', roll: 'skill', source: 'Bane (race and body type)', at: 'src/ruleset/bane.ts',
    when: 'Any roll against a foe of that race or body type. The best race Bane and the best body type Bane both count.',
    value: `${W()} × (+${CONFIG.BANE_SKILL_PER_LEVEL} skill × place for each level of the chain, added up)`,
    feeds: (lib) => Object.entries(lib.achievements ?? {}).filter(([, a]) => isBane(a)).map(([k, a]) => ({ table: 'achievements', id: k, name: a.name, value: sg(W() * baneSkill(k)) })) },
  { type: 'achievement', roll: 'skill', source: 'Total defeats', at: 'src/ruleset/bane.ts',
    when: `${cap(listWords(DEFEATS_ROLLS.map((k) => (k === 'hit' ? 'attack' : k))))} rolls. Only the highest earned one counts.`,
    value: `+${CONFIG.DEFEATS_ROLL_PER_TIER} × place for each tier, added up`,
    feeds: (lib) => Object.entries(lib.achievements ?? {}).filter(([, a]) => a.rule === 'defeats' && !a.by).map(([k, a]) => ({ table: 'achievements', id: k, name: a.name, value: sg(defeatsRoll(k)) })) },
  { type: 'achievement', roll: 'skill', source: 'Renown', at: 'src/ruleset/achRewards.ts',
    when: 'Every morale roll of a foe fighting a player holding a renown achievement (MB24).', value: 'minus the achievement\'s renown',
    feeds: (lib) => Object.entries(lib.achievements ?? {}).filter(([, a]) => a.renown).map(([k, a]) => ({ table: 'achievements', id: k, name: a.name, value: sg(-a.renown!) })) },
  { type: 'achievement', roll: 'skill', source: 'Rally', at: 'src/ruleset/achRewards.ts',
    when: 'An ally\'s morale roll while it fights beside a player holding a rally achievement.', value: 'plus the achievement\'s rally',
    feeds: (lib) => Object.entries(lib.achievements ?? {}).filter(([, a]) => a.rally).map(([k, a]) => ({ table: 'achievements', id: k, name: a.name, value: sg(a.rally!) })) },
  { type: 'achievement', roll: 'skill', source: 'Defense and spotting achievements', at: 'src/ruleset/achRewards.ts',
    when: 'Defense rolls (dodge, block, parry) take the best defenseRoll achievement (clean defenses); spotting rolls (sight, hearing and smell perception rolls) take the best spotRoll achievement (spotted). Same type as Bane and total defeats.',
    value: 'the achievement\'s amount plus every lower level\'s, added up',
    feeds: (lib) => Object.entries(lib.achievements ?? {}).filter(([, a]) => a.defenseRoll || a.spotRoll)
      .map(([k, a]) => ({ table: 'achievements', id: k, name: a.name, value: `${sg(rewardOf(a, a.defenseRoll ? 'defenseRoll' : 'spotRoll'))} ${a.defenseRoll ? 'defense' : 'spotting'} rolls` })) },
  // roll_perk
  { type: 'roll_perk', roll: 'skill', source: `${MILESTONES.filter((_, i) => i % 2 === 1).join('/')} perk numbers`, at: 'src/ruleset/perks.ts',
    when: 'Rolls of the perk\'s skill (or the skills it names, or every melee or ranged attack): rollAdd on every roll, hitAdd on attack rolls only.', value: 'the perk\'s rollAdd / hitAdd',
    feeds: (lib) => Object.values(lib.perks).filter((d) => d.ladder && (d.numbers?.rollAdd || d.numbers?.hitAdd)).map((d) => ({ table: 'perks', id: d.id, name: d.name,
      value: ((on) => [d.numbers?.rollAdd ? `${sg(d.numbers.rollAdd)} every ${on} roll` : '', d.numbers?.hitAdd ? `${sg(d.numbers.hitAdd)} ${on} attack rolls` : ''].filter(Boolean).join(' · '))(d.numbersForAttack ? `${d.numbersForAttack}` : (d.numbersFor ?? [d.ladder!.skill]).map(skillName).join(' / ')) })) },
  { type: 'rating', roll: 'skill', source: 'Strength', at: 'src/engine/held.ts', when: 'Grapple rolls to break free of a hold and to hold on: STRENGTH_HOLD_SHARE × the roller\'s Melee strength rating (Grapple left out of its pool), in skill points (GR26).',
    value: `${W()} × ${CONFIG.STRENGTH_HOLD_SHARE} × Melee strength` },
  { type: 'roll_perk', roll: 'skill', source: perkName(PK.steady_guard), at: 'src/ruleset/index.ts', when: 'Parry rolls made with a medium melee weapon.',
    value: sg(W() * CONFIG.STEADY_GUARD), feeds: (lib) => perk(lib, PK.steady_guard) },
  { type: 'roll_perk', roll: 'skill', source: perkName(PK.bare_handed_guard), at: 'src/ruleset/index.ts', when: 'Dodge rolls while the owner holds no weapon.',
    value: sg(W() * CONFIG.BARE_HANDED_GUARD), feeds: (lib) => perk(lib, PK.bare_handed_guard) },
  { type: 'roll_perk', roll: 'skill', source: perkName(PK.overdrive), at: 'src/ruleset/index.ts', when: 'Every roll while the owner\'s short-term line is more than half full; each costs OVERDRIVE_STRAIN strain.',
    value: `Stamina × ${CONFIG.OVERDRIVE_SHARE} × its tier`, feeds: (lib) => perk(lib, PK.overdrive) },
  // foe_perk
  { type: 'foe_perk', roll: 'skill', source: perkName(PK.dodgy), at: 'src/ruleset/allSteps.ts', when: 'Attack rolls against a foe who has Dodgy.',
    value: sg(-W() * CONFIG.DODGY_SKILL), feeds: (lib) => perk(lib, PK.dodgy) },
  // gear
  { type: 'gear', roll: 'skill', source: 'Weapon class hit', at: 'src/ruleset/index.ts', when: 'Attack rolls: the class hit plus the mode\'s hitAdj, as one entry.',
    value: `${list(Object.fromEntries(Object.entries(CONFIG.WEAPON_CLASSES).map(([k, c]) => [k, c.hit])), false)} · unarmed ${sg(CONFIG.UNARMED_PROFILE.hit)}`,
    feeds: (lib) => Object.values(lib.items).flatMap((i) => (i.weapon?.modes ?? []).filter((m) => m.hitAdj).map((m) => ({ table: 'items' as const, id: i.id, name: i.name,
      value: `${modeName(m)}: ${sg((CONFIG.WEAPON_CLASSES[m.class] ?? CONFIG.UNARMED_PROFILE).hit + (m.hitAdj ?? 0))} (class ${sg((CONFIG.WEAPON_CLASSES[m.class] ?? CONFIG.UNARMED_PROFILE).hit)}, hitAdj ${sg(m.hitAdj ?? 0)})` }))) },
  { type: 'gear', roll: 'skill', source: 'Item roll effects', at: 'src/ruleset/gear.ts', when: 'Rolls of the kind the effect names, while the item is worn, held, in use or carried.',
    value: 'the effect\'s value', feeds: (lib) => itemRollMods(lib, false) },
  // wounds: % of the average roll (PW1 b)
  { type: 'wounds', roll: 'skill', source: 'Health level', at: 'src/ruleset/body.ts', when: 'Every roll, by the actor\'s place on the health track.',
    value: pctList(Object.fromEntries(CONFIG.HEALTH_TRACK.filter(([, , v]) => v).map(([l, , v]) => [HEALTH_LEVELS.name(l), v]))) },
  { type: 'wounds', roll: 'skill', source: 'Morale level', at: 'src/ruleset/morale.ts', when: 'Every roll, the morale roll included (fear feeds on itself), by the actor\'s morale level (MB3).',
    value: pctList(Object.fromEntries(CONFIG.MORALE_TRACK.filter(([, , v]) => v).map(([k, , v]) => [MORALE_LEVELS.name(k as MoraleLevel), v as number]))) },
  { type: 'wounds', roll: 'skill', source: 'Fatigue level', at: 'src/ruleset/fatigue.ts', when: 'Every roll, by the actor\'s fatigue level (FT3): the share of the long-term stamina bar used.',
    value: pctList(Object.fromEntries(CONFIG.FATIGUE_TRACK.filter(([, , v]) => v).map(([k, , v]) => [FATIGUE_LEVELS.name(k), v]))) },
  { type: 'wounds', roll: 'skill', source: 'Role wounds', at: 'src/ruleset/body.ts',
    when: 'Rolls whose skill uses a body role (grip, strike, sense …) on a damaged or crippled part. Shared roles split it across their parts; a crippled sense part hits every roll.',
    value: pctList({ ...Object.fromEntries(Object.entries(CONFIG.ROLE_PENALTY).map(([k, v]) => [PART_STATES.name(k as PartStateKey), v])), [PART_STATES.name('destroyed')]: CONFIG.ROLE_PENALTY.crippled * CONFIG.DESTROYED_PART_WEIGHT }) }, // BG-91, CS24
  { type: 'wounds', roll: 'skill', source: 'Essential part crippled', at: 'src/ruleset/body.ts',
    when: 'Every roll while any essential part (head, neck …) is Crippled or worse; once, however many such parts.', value: `${sg(CONFIG.ESSENTIAL_CRIPPLED_PENALTY)}%${OF_AVG}` },
  { type: 'wounds', roll: 'skill', source: 'Shield damaged', at: 'src/ruleset/body.ts', when: 'Block rolls with a Damaged shield.', value: `${sg(CONFIG.ROLE_PENALTY.damaged)}%${OF_AVG}` },
  // situational
  { type: 'situational', roll: 'skill', source: 'Light', at: 'src/ruleset/gear.ts', when: 'Rolls whose skill has a light tag (sight, stealth …): the tag\'s sign × the light where the action is.',
    value: LIGHT.keys.map((k) => `${LIGHT.name(k)} ${sg(lightMod(k))}`).join(' · ') },
  { type: 'situational', roll: 'skill', source: 'Cover', at: 'src/ruleset/gear.ts', when: `Rolls with a hide tag (the Stealth skills, stashing), by what shows of the roller in its zone's cover: ${CONFIG.COVER_HALVING_MOD} for each halving (CV6, CV7). A small body shows less (its height ÷ ${HUMANOID_SIZE.heightM} m); a body taller than a person and than what the zone's cover stands shows more. Values here for a standing person.`,
    value: COVER_PERSON },
  { type: 'situational', roll: 'skill', source: 'Cover (shot)', at: 'src/ruleset/index.ts', when: `Ranged attacks at a target in cover: the same number as a minus, by what shows of the target (Past the Cover counts ${2 ** CONFIG.PAST_THE_COVER_HALVINGS} times as much showing). Melee never takes it.`,
    value: COVER_PERSON.replace(/\+/g, '−') },
  { type: 'situational', roll: 'skill', source: 'Range', at: 'src/ruleset/index.ts', when: 'Ranged attacks, by the distance to the target as a share of the weapon\'s reach (both from real metres).',
    value: CONFIG.RANGE_SHARE_MODS.map(([share, v]) => `up to ${Math.round(share * 100)}% ${sg(v)}`).join(' · ') },
  { type: 'situational', roll: 'skill', source: 'Hostile close', at: 'src/ruleset/index.ts', when: `Ranged attacks with a hostile near enough to strike or grab the shooter: within ${CONFIG.HOSTILE_NEAR_STEP_M} m (a step) plus its own melee reach, between bodies (Point Blank removes it).`,
    value: sg(CONFIG.HOSTILE_NEAR_MOD) },
  { type: 'situational', roll: 'skill', source: 'Outnumbered', at: 'src/ruleset/index.ts', when: `Defense rolls after the first this turn (Blade Wall removes it for Parry, Shield Wall for Block, Slip the Crowd for Dodge).`,
    value: sg(CONFIG.OUTNUMBERED_MOD) },
  { type: 'situational', roll: 'skill', source: 'Unaware', at: 'src/ruleset/index.ts', when: 'Defense rolls by a defender who didn\'t see the attack coming. One table by awareness (AWARENESS_DEFENSE): an attacker with Unseen Strike moves it one step on, so an unaware defender takes the step after and one only suspicious takes this one.', value: sg(CONFIG.AWARENESS_DEFENSE[CONFIG.AWARENESS_STEP.unaware]) },
  { type: 'situational', roll: 'skill', source: "Can't defend", at: 'src/ruleset/index.ts', when: 'Defense rolls by someone down, asleep or held in a grip (BG-207): no dice, the defense fails outright as a Critical Failure.', value: 'fails outright' },
  { type: 'situational', roll: 'skill', source: 'Dodge vs missile', at: 'src/ruleset/index.ts', when: 'Dodge rolls against a ranged attack.', value: sg(CONFIG.DODGE_VS_MISSILE) },
  { type: 'situational', roll: 'skill', source: 'Waking', at: 'src/engine/sleep.ts', when: 'A light sleeper\'s hearing check against someone hostile moving openly near it (NW19): the grade their noise sets, louder is easier.',
    value: Object.entries(CONFIG.WAKE_GRADE).map(([k, g]) => `${NOISE.name(k as NoiseKey)} ${sg(gradeMod(CONFIG.DIFFICULTY[g]))}`).join(' · ') },
  { type: 'situational', roll: 'skill', source: 'How faint', at: 'src/engine/makeOut.ts', when: 'A make-out roll on something half seen or half heard (PG4): the grade set by how far past the clear range it is (darkness one step harder) or how many dB above the hearing floor it reaches.',
    value: [...new Set([...CONFIG.MAKE_OUT_SIGHT_GRADES, ...CONFIG.MAKE_OUT_SOUND_GRADES].map(([, g]) => g))].map((g) => `${g} ${sg(gradeMod(CONFIG.DIFFICULTY[g]))}`).join(' · ') },
  { type: 'situational', roll: 'skill', source: 'Attention', at: 'src/engine/filch.ts', when: 'A watcher\'s Sight and Hearing rolls against a filch (TN4): how closely they watch.', value: Object.entries(CONFIG.FILCH_ATTENTION).filter(([k]) => k !== 'asleep').map(([k, v]) => `${ATTENTION.name(k as AttentionKey)} ${sg(v)}`).join(' · ') },
  { type: 'situational', roll: 'skill', source: 'Item size', at: 'src/engine/filch.ts', when: 'A watcher\'s Sight and Hearing rolls against a filch (TN4): the item\'s bulk.', value: CONFIG.FILCH_SIZE.map((v, b) => `bulk ${b} ${sg(v)}`).join(' · ') },
  { type: 'situational', roll: 'skill', source: 'Lock or grade', at: 'src/ruleset/index.ts', when: 'SE23\'s grade modifier, on rolls in doubt (OD1 b): Lockpicking rolls (BA2) and breaking a container open (BF31) with the weapon in hand (bare hands: Improvised), at the lock\'s grade (shown as lock); use, interact, observe and other at the grade of what they act on, else the Parser\'s (OD3, shown as grade).', value: GRADES.map((k) => `${GRADE_LEVELS.name(k)} ${sg(gradeMod(CONFIG.DIFFICULTY[k]))}`).join(' · ') },
  { type: 'situational', roll: 'skill', source: 'Repeat try', at: 'src/ruleset/pressure.ts',
    when: 'Persuading, lying, threatening or haggling again at the same listener, out of a fight (plain talk never counts; in a fight there is no repeat penalty, TF9).', value: `−${CONFIG.REPEAT_TRY} × earlier tries` },
  { type: 'situational', roll: 'skill', source: 'Coin offered', at: 'src/engine/speech.ts', when: 'A bribe in a fight (TF10): the briber\'s Barter roll, by the coin offered against the listener\'s price (OFFER_BRIBE_PRICE per level).',
    value: `${sg(CONFIG.OFFER_BRIBE_MOD)} per doubling over the price, as much less per halving` },
  // status
  { type: 'status', roll: 'skill', source: 'Shaken', at: 'src/ruleset/pressure.ts',
    when: 'Every roll against someone whose intimidation beat you, until your engagement ends.', value: `−${CONFIG.SHAKEN_PER_TIER} × tiers lost by` },
  { type: 'status', roll: 'skill', source: 'Shaken', at: 'src/engine/steady.ts',
    when: 'Steadying yourself (SY1): the worst Shaken you carry against anyone.', value: `−${CONFIG.SHAKEN_PER_TIER} × tiers lost by` },
  { type: 'status', roll: 'skill', source: 'Swayed', at: 'src/ruleset/pressure.ts',
    when: 'Every roll against someone whose persuasion beat you, until your engagement ends.', value: `−${CONFIG.SWAYED_PER_TIER} × tiers lost by` },
  { type: 'situational', roll: 'skill', source: 'Rallied by', at: 'src/engine/auras.ts', when: 'A rally roll (TC43): the morale check of someone a rally reaches (Battle Cry; Rally later).',
    value: `${CONFIG.SKILL_WEIGHT} × ${CONFIG.RALLY_SHARE} × the rallier\'s rallying skill (augment equation)` },
  { type: 'status', roll: 'skill', source: 'Rallied', at: 'src/ruleset/index.ts',
    when: 'Every roll after a rally (Battle Cry\'s; Rally later), until your engagement ends. A second rally adds nothing (TC41).', value: `+${CONFIG.RALLIED_MOD}` },
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
