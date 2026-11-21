// 40 perks: the 40 milestone of each skill ("40 milestone perks: options" F1–F5, P1–P19). Every 40
// perk gives +5 true skill in its own skill, +1 true skill in its own skill and every other skill sharing one of its
// groups (docs/skill-tags.md; the group, not the function: LF1), so +6 in its own skill, and ONE more number: a number of the skill itself (`numbers`), or +10 true skill spent on
// skills that work well with it (`trueSkillTo`), or a config number code reads by the perk's id (`ownRule`). 40/80/120 perks have no conditions. The 20/60/100/140 perks carry the
// rules changes. Names are placeholders. Story and Rules are written from the same row, so they always match.
import type { AttackKind, BoostNumbers, PerkEffect, PerkWriteup, SkillGroup } from '../types';
import { GROUP_NAMES, groupName } from './functionNames';
import { skillName } from './skillNames';
import { SK } from './skillIds';
import { GR } from './functionIds';
import { PK } from './perkIds';
import { CONFIG } from '../config';
import { payoffShare } from '../ruleset/stacking';

type Row = {
  id: string; ref: string; skill: string; name: string; effect: PerkEffect;
  /** 40 (left out), 80 or 120 */
  milestone?: 40 | 80 | 120;
  /** display name of the skill, and its group key: every skill of that group, itself included, gets +1 */
  group: SkillGroup;
  extra: { story: string; rule: string; numbers?: BoostNumbers; numbersFor?: string[]; numbersForAttack?: AttackKind; trueSkillTo?: Record<string, number>; ownRule?: string };
};
/** what "a melee attack" and "a ranged attack" cover, for perks whose numbers work with one kind of attack (numbersForAttack) */
const MELEE_ATTACK = 'melee attack (a weapon, unarmed or improvised blow, or a natural attack such as a bite)';
const RANGED_ATTACK = 'ranged attack (a shot or a throw, whatever skill rolls it)';

const ROWS: Row[] = [
  // P1: option b (R5), so the aim half stays with Precise, the banked higher perk
  { id: PK.keen_edge, ref: 'P1', skill: SK.melee_light, group: GR.melee, name: 'Keen Edge', effect: 'attack',
    extra: { story: 'You have learned where flesh is softest: +10 to hit with any melee attack.', rule: `+10 on the attack roll of every ${MELEE_ATTACK}.`, numbers: { hitAdd: 10 }, numbersForAttack: 'melee' } },
  { id: PK.guard_drill, ref: 'P2', skill: SK.melee_medium, group: GR.melee, name: 'Guard Drill', effect: 'defense',
    extra: { story: 'Every guard you hold makes the next one harder to break: +10 Parry.', rule: `+10 true skill in ${skillName(SK.parry)}.`, trueSkillTo: { [SK.parry]: 10 } } },
  { id: PK.heavy_hand, ref: 'P3', skill: SK.melee_heavy, group: GR.melee, name: 'Heavy Hand', effect: 'attack',
    extra: { story: 'Armor dents, bones give: every melee blow you land hits 20% harder.', rule: `Damage of every ${MELEE_ATTACK} is ×1.2, before armor.`, numbers: { damageMult: 1.2 }, numbersForAttack: 'melee' } },
  { id: PK.sharp_eyes, ref: 'P4', skill: SK.ranged_light, group: GR.ranged, name: 'Sharp Eyes', effect: 'senses',
    extra: { story: `Nothing escapes the archer's eye: +10 ${skillName(SK.eyesight)}.`, rule: `+10 true skill in ${skillName(SK.eyesight)}.`, trueSkillTo: { [SK.eyesight]: 10 } } },
  { id: PK.steady_draw, ref: 'P5', skill: SK.ranged_medium, group: GR.ranged, name: 'Steady Draw', effect: 'attack',
    extra: { story: 'Steady hands, a heavier bite: +5 to hit with any ranged attack, and it hits 10% harder.', rule: `+5 on the attack roll of every ${RANGED_ATTACK}, and its damage is ×1.1, before armor.`, numbers: { hitAdd: 5, damageMult: 1.1 }, numbersForAttack: 'ranged' } },
  { id: PK.armor_piercer, ref: 'P6', skill: SK.ranged_heavy, group: GR.ranged, name: 'Armor Piercer', effect: 'attack',
    extra: { story: 'Steel plate is just a suggestion to anything you shoot or throw: it stops 2 less of each hit.', rule: `On a hit with any ${RANGED_ATTACK}, each armor the hit passes (worn and natural) reduces the damage by 2 less (never below 0).`, numbers: { armorPierce: 2 }, numbersForAttack: 'ranged' } },
  { id: PK.street_fighter, ref: 'P7', skill: SK.unarmed_strike, group: GR.melee, name: 'Street Fighter', effect: 'attack',
    extra: { story: 'Fists taught you that anything in reach is a weapon: +10 Improvisation.', rule: `+10 true skill in ${skillName(SK.unarmed_improvised)}.`, trueSkillTo: { [SK.unarmed_improvised]: 10 } } },
  { id: PK.iron_grip, ref: 'P8', skill: SK.unarmed_grapple, group: GR.melee, name: 'Iron Grip', effect: 'attack',
    extra: { story: 'Once you take hold, struggling only tires them out: +10 on every grapple roll, breaking free included.', rule: `+10 on every roll with skill ${skillName(SK.unarmed_grapple)} (grapple attacks, and both sides of a break-free contest).`, numbers: { rollAdd: 10 } } },
  { id: PK.brawlers_eye, ref: 'P9', skill: SK.unarmed_improvised, group: GR.melee, name: "Brawler's Eye", effect: 'attack',
    extra: { story: `A brawler sees the opening before the punch: +5 ${skillName(SK.unarmed_strike)}, +5 ${skillName(SK.eyesight)}.`, rule: `+5 true skill in ${skillName(SK.unarmed_strike)} and +5 in ${skillName(SK.eyesight)}.`, trueSkillTo: { [SK.unarmed_strike]: 5, [SK.eyesight]: 5 } } },
  { id: PK.light_feet, ref: 'P10', skill: SK.dodge, group: GR.defense, name: 'Light Feet', effect: 'defense',
    extra: { story: 'Feet that never get hit never make a sound: +10 Sneaking.', rule: `+10 true skill in ${skillName(SK.sneaking)}.`, trueSkillTo: { [SK.sneaking]: 10 } } },
  { id: PK.braced, ref: 'P11', skill: SK.block, group: GR.defense, name: 'Take the Hit', effect: 'health',
    extra: { story: 'Every blow you stop leaves you harder: +10 Endurance.', rule: `+10 true skill in ${skillName(SK.endurance)}.`, trueSkillTo: { [SK.endurance]: 10 } } },
  { id: PK.quick_mend, ref: 'P12', skill: SK.endurance, group: GR.health, name: 'Fast Healer', effect: 'health',
    extra: { story: 'Your body mends itself twice as fast as it has any right to: wounds, nerve and breath alike.', rule: `Every natural recovery is ×2: health (Natural recovery, read from ${skillName(SK.endurance)}), morale (Natural composure, read from ${skillName(SK.resolve)}) and stamina (Catching your breath).`, numbers: { recoveryMult: 2 } } },
  { id: PK.marksmans_eye, ref: 'P13', skill: SK.eyesight, group: GR.notice, name: "Marksman's Eye", effect: 'attack',
    extra: { story: 'What your eye finds, your arrow follows: +5 Light ranged, +5 Medium ranged.', rule: `+5 true skill in ${skillName(SK.ranged_light)} and +5 in ${skillName(SK.ranged_medium)}.`, trueSkillTo: { [SK.ranged_light]: 5, [SK.ranged_medium]: 5 } } },
  { id: PK.soft_step, ref: 'P14', skill: SK.earshot, group: GR.notice, name: 'Soft Step', effect: 'senses',
    extra: { story: 'You know what every footstep sounds like, so yours make none: +10 Sneaking.', rule: `+10 true skill in ${skillName(SK.sneaking)}.`, trueSkillTo: { [SK.sneaking]: 10 } } },
  // Stamina (SS2, SS4, SS6). Stamina is alone in its group, so the +1 lands on Stamina itself
  { id: PK.iron_lungs, ref: 'SS2', skill: SK.stamina, group: GR.stamina, name: 'Iron Lungs', effect: 'health',
    extra: { story: `A body that keeps going learns to take punishment: +10 ${skillName(SK.endurance)}.`, rule: `+10 true skill in ${skillName(SK.endurance)}.`, trueSkillTo: { [SK.endurance]: 10 } } },
  { id: PK.deep_lungs, ref: 'SS4', skill: SK.stamina, group: GR.stamina, name: 'Deep Lungs', effect: 'health', milestone: 80,
    extra: { story: 'You breathe deeper than other people: your short-term stamina is half again as large.', rule: `The owner's short-term line is ×${CONFIG.DEEP_LUNGS_LINE} its size (CONFIG.DEEP_LUNGS_LINE, placeholder), before the fatigue level bands shrink it.` } },
  { id: PK.bottomless, ref: 'SS6', skill: SK.stamina, group: GR.stamina, name: 'Bottomless', effect: 'health', milestone: 120,
    extra: { story: 'Effort that would empty anyone else barely touches you: every strain you pay is halved.', rule: `Every strain cost the owner pays is ×${CONFIG.BOTTOMLESS_STRAIN} (CONFIG.BOTTOMLESS_STRAIN, placeholder), after worn armour.` } },
  { id: PK.sharp_answer, ref: 'LG2', skill: SK.parry, group: GR.defense, name: 'Sharp Answer', effect: 'attack',
    extra: { ownRule: 'SHARP_ANSWER_MULT', story: 'A parry is there to earn the strike, and you make the strike count: the free blow back after a parry hits a quarter harder.',
      rule: `The free strike back after the owner's parry deals ×${CONFIG.SHARP_ANSWER_MULT} damage, before armor (SHARP_ANSWER_MULT, placeholder). Other free attacks, Riposte's counters among them, are unchanged.` } },
  { id: PK.read_the_feint, ref: 'LG20', skill: SK.insight, group: GR.notice, name: 'Read the Feint', effect: 'senses',
    extra: { ownRule: 'WARNED_SHIFT', story: 'You have seen every trick before: a feint, a bluff, a fall that is not real, a retreat that is a trap. You meet each one as if you had been warned.',
      rule: `The owner answers every trick (a feint, a bluff, Play Dead, Draw Them In) as if it knew it: ${CONFIG.WARNED_SHIFT} tiers better on that roll (WARNED_SHIFT), the first time too.` } },
  // Missing 40 perks (LG4-LG19): some give +10 to a related skill; the rest change one of the skill's own rule numbers (placeholders)
  { id: PK.guarded_answer, ref: 'LG4', skill: SK.riposte, group: GR.defense, name: 'Guarded Answer', effect: 'defense',
    extra: { story: `Every answer starts with a guard: +10 ${skillName(SK.parry)}.`, rule: `+10 true skill in ${skillName(SK.parry)}.`, trueSkillTo: { [SK.parry]: 10 } } },
  { id: PK.dancers_feet, ref: 'LG6', skill: SK.blade_dance, group: GR.defense, name: "Dancer's Feet", effect: 'defense',
    extra: { story: `The dance is mostly not being there: +10 ${skillName(SK.dodge)}.`, rule: `+10 true skill in ${skillName(SK.dodge)}.`, trueSkillTo: { [SK.dodge]: 10 } } },
  { id: PK.deep_reserves, ref: 'LG8', skill: SK.resolve, group: GR.will, name: 'Deep Reserves', effect: 'health',
    extra: { ownRule: 'DEEP_RESERVES_MULT', story: `There is more of you to wear down: your ${skillName(SK.endurance)}, ${skillName(SK.stamina)} and ${skillName(SK.resolve)} each count a fifth more toward health, stamina and morale.`,
      rule: `Each point of ${skillName(SK.endurance)}, ${skillName(SK.stamina)} and ${skillName(SK.resolve)} counts ×${CONFIG.DEEP_RESERVES_MULT} toward the bar it fills: health (HP_PER_END), the stamina bar (STAMINA_PER_POINT) and max morale (MORALE_PER_RESOLVE). DEEP_RESERVES_MULT, placeholder.` } },
  { id: PK.silver_tongue, ref: 'LG10', skill: SK.persuasion, group: GR.influence, name: 'Silver Tongue', effect: 'speech',
    extra: { story: `Convincing and deceiving are the same craft: +10 ${skillName(SK.falsehood)}.`, rule: `+10 true skill in ${skillName(SK.falsehood)}.`, trueSkillTo: { [SK.falsehood]: 10 } } },
  { id: PK.unseen_strike, ref: 'LG11', skill: SK.combat_stealth, group: GR.stealth, name: 'Unseen Strike', effect: 'attack',
    extra: { ownRule: 'AWARENESS_DEFENSE', story: `Whoever does not see you coming barely defends: a target unaware of you defends at −${-CONFIG.AWARENESS_DEFENSE[CONFIG.AWARENESS_STEP.unaware + 1]}%, and one only suspicious of you at −${-CONFIG.AWARENESS_DEFENSE[CONFIG.AWARENESS_STEP.suspicious + 1]}%.`,
      rule: `A defense roll against the owner's attack takes the awareness modifier one step further on its table (AWARENESS_DEFENSE ${CONFIG.AWARENESS_DEFENSE.join(', ')}, % of the defender's average roll): ${CONFIG.AWARENESS_DEFENSE[CONFIG.AWARENESS_STEP.unaware + 1]}% when the defender is unaware of the owner, ${CONFIG.AWARENESS_DEFENSE[CONFIG.AWARENESS_STEP.suspicious + 1]}% when it is only suspicious. Never Flat-Footed still cancels it.` } },
  { id: PK.fear_bites_deeper, ref: 'LG12', skill: SK.intimidation, group: GR.influence, name: 'Fear Bites Deeper', effect: 'speech',
    extra: { ownRule: 'FEAR_BITES_MULT', story: 'Whatever fear you cause sinks in further: others lose a fifth more morale to you.',
      rule: `Morale others lose to the owner (its auras, Battle Cry, Dreaded on Sight) is ×${CONFIG.FEAR_BITES_MULT} (FEAR_BITES_MULT, placeholder).` } },
  { id: PK.shadow_work, ref: 'LG14', skill: SK.sneaking, group: GR.stealth, name: 'Shadow Work', effect: 'stealth',
    extra: { story: `Getting close unseen is half the job: +5 ${skillName(SK.combat_stealth)}, +5 ${skillName(SK.vanishing)}.`, rule: `+5 true skill in ${skillName(SK.combat_stealth)} and +5 in ${skillName(SK.vanishing)}.`, trueSkillTo: { [SK.combat_stealth]: 5, [SK.vanishing]: 5 } } },
  { id: PK.thick_of_it, ref: 'LG15', skill: SK.vanishing, group: GR.stealth, name: 'In the Thick of It', effect: 'stealth',
    extra: { ownRule: 'VANISH_NEAR_SHIFT', story: 'You can slip away from someone trading blows with you as easily as from anyone else.',
      rule: `Vanishing within ${CONFIG.VANISH_NEAR_M} m of a foe fighting the owner takes no ${CONFIG.VANISH_NEAR_SHIFT} tier shift (VANISH_NEAR_SHIFT).` } },
  { id: PK.free_movement, ref: 'LG16', skill: SK.light_armor, group: GR.defense, name: 'Free Movement', effect: 'defense',
    extra: { story: `Light armor moves with you: +10 ${skillName(SK.dodge)}.`, rule: `+10 true skill in ${skillName(SK.dodge)}.`, trueSkillTo: { [SK.dodge]: 10 } } },
  { id: PK.deeper_soak, ref: 'LG18', skill: SK.heavy_armor, group: GR.defense, name: 'Deeper Soak', effect: 'defense',
    extra: { ownRule: 'DEEPER_SOAK_MULT', story: 'You know how to let plate take the blow: your heavy armor stops half again as much of every hit.',
      rule: `Worn heavy armor's flat soak (its reduction per hit) is ×${CONFIG.DEEPER_SOAK_MULT} on the owner (DEEPER_SOAK_MULT, placeholder); its multiplier is unchanged.` } },
  { id: PK.covered_joints, ref: 'LG24', skill: SK.medium_armor, group: GR.defense, name: 'Covered Joints', effect: 'defense',
    extra: { ownRule: 'COVERED_JOINTS', story: 'You wear your armor so the gaps are never where a blade looks for them: every blow at you has to find a way past it.',
      rule: `An attack at a part the owner's worn armor covers (any weight) takes ${CONFIG.COVERED_JOINTS} on its roll (COVERED_JOINTS, placeholder). An attack that is not aimed takes ${CONFIG.COVERED_JOINTS} × the share of the owner's hit chances its armor covers; one aimed at a bare part takes nothing.` } },
  { id: PK.honest_face, ref: 'LG19', skill: SK.falsehood, group: GR.influence, name: 'Honest Face', effect: 'speech',
    extra: { story: `People believe a face like yours, whatever it says: +10 ${skillName(SK.persuasion)}.`, rule: `+10 true skill in ${skillName(SK.persuasion)}.`, trueSkillTo: { [SK.persuasion]: 10 } } },
  // CN8 (D-260): a payoff perk on Intimidation 120 (Battle Cry holds 140), with the 120 boosts like any other
  { id: PK.chorus, ref: 'CN8', skill: SK.intimidation, group: GR.influence, name: 'Chorus', effect: 'speech', milestone: 120,
    extra: { story: 'Every way you have learned to strike fear joins the one voice: your auras reach further for every shout perk you own.',
      rule: `The owner's engagement auras (Dread Presence and any later one) reach further: each shout piece (perks tagged shout in src/library/perkThemes.ts, Chorus included) adds ${CONFIG.CHORUS_REACH_M} m in full (CONFIG.CHORUS_REACH_M), and the base reach (AURA_REACH_M × √(aura skill ÷ AURA_REACH_SKILL), ${CONFIG.AURA_REACH_M} m at ${CONFIG.AURA_REACH_SKILL}) grows by the payoff share of those pieces, ${CONFIG.PAYOFF_SHARE * 100}% × pieces^${CONFIG.PAYOFF_EXP} (placeholders). At ${CONFIG.AURA_REACH_SKILL}, Chorus alone: ${+(CONFIG.AURA_REACH_M * (1 + payoffShare(1)) + 1 * CONFIG.CHORUS_REACH_M).toFixed(1)} m; with three shout pieces: ${+(CONFIG.AURA_REACH_M * (1 + payoffShare(3)) + 3 * CONFIG.CHORUS_REACH_M).toFixed(1)} m.` } },
];

/** SH1-SH4: the 40 and 80 perks give +5 to their own skill and +1 to every skill sharing a group; the 120 perk gives HIGH_PERK_SHARE
 * of it instead, and HIGH_PERK_SPREAD of it to every skill sharing a group in place of the +1 (the share already covers the group).
 * Shares read true skill without shares (trueSkill in src/ruleset/perks.ts) */
const own = (r: Row) => r.milestone === 120
  ? { short: `+${CONFIG.HIGH_PERK_SHARE * 100}% ${skillName(r.skill)}, +${CONFIG.HIGH_PERK_SPREAD * 100}% ${GROUP_NAMES[r.group]}`,
    rule: `+${CONFIG.HIGH_PERK_SHARE * 100}% of the owner's true ${skillName(r.skill)} (HIGH_PERK_SHARE, placeholder) as true skill in ${skillName(r.skill)}. +${CONFIG.HIGH_PERK_SPREAD * 100}% of the owner's true ${skillName(r.skill)} (HIGH_PERK_SPREAD, placeholder) as true skill in every skill of group ${groupName(r.group)}. Shares read true skill without shares; several on one skill add in full.` }
  : { short: `+5 ${skillName(r.skill)}, +1 ${GROUP_NAMES[r.group]}`,
    rule: `+5 true skill in ${skillName(r.skill)}. +1 true skill in every skill of group ${groupName(r.group)}.` };

export const BOOST_PERKS: PerkWriteup[] = ROWS.map((r) => ({
  id: r.id, ref: r.ref, name: r.name, skill: r.skill, place: '40',
  ladder: { skill: r.skill, milestone: r.milestone ?? 40 }, effect: r.effect,
  ...(r.milestone === 120 ? { shareOwn: CONFIG.HIGH_PERK_SHARE, shareGroup: CONFIG.HIGH_PERK_SPREAD } : { trueSkill: 5, functionBoost: 1 }),
  ...(r.extra.numbers ? { numbers: r.extra.numbers } : {}), ...(r.extra.numbersFor ? { numbersFor: r.extra.numbersFor } : {}), ...(r.extra.numbersForAttack ? { numbersForAttack: r.extra.numbersForAttack } : {}), ...(r.extra.trueSkillTo ? { trueSkillTo: r.extra.trueSkillTo } : {}), ...(r.extra.ownRule ? { ownRule: r.extra.ownRule } : {}),
  story: `${own(r).short}. ${r.extra.story}`,
  rules: {
    kind: 'Always on', trigger: 'Always.', conditions: [],
    effect: `${own(r).rule} ${r.extra.rule}`,
    lasts: 'Always.',
  },
}));
