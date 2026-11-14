// 40 perks: the 40 milestone of each skill ("40 milestone perks: options" F1–F5, P1–P19). Every 40
// perk gives +5 true skill in its own skill, +1 true skill in its own skill and every other skill sharing one of its
// groups (docs/skill-tags.md; the group, not the function: LF1), so +6 in its own skill, and ONE more number: a number of the skill itself (`numbers`), or +10 true skill spent on
// skills that work well with it (`trueSkillTo`). 40/80/120 perks have no conditions. The 20/60/100/140 perks carry the
// rules changes. Names are placeholders. Story and Rules are written from the same row, so they always match.
import type { BoostNumbers, PerkEffect, PerkWriteup, SkillGroup } from '../types';
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
  extra: { story: string; rule: string; numbers?: BoostNumbers; trueSkillTo?: Record<string, number> };
};

const ROWS: Row[] = [
  // P1: option b (R5), so the aim half stays with Precise, the banked higher perk
  { id: PK.keen_edge, ref: 'P1', skill: SK.melee_light, group: GR.melee, name: 'Keen Edge', effect: 'attack',
    extra: { story: 'Your blade has learned where flesh is softest: +10 to hit with light weapons.', rule: `+10 on attack rolls with skill ${skillName(SK.melee_light)}.`, numbers: { hitAdd: 10 } } },
  { id: PK.guard_drill, ref: 'P2', skill: SK.melee_medium, group: GR.melee, name: 'Guard Drill', effect: 'defense',
    extra: { story: 'Every guard you hold makes the next one harder to break: +10 Parry.', rule: `+10 true skill in ${skillName(SK.parry)}.`, trueSkillTo: { [SK.parry]: 10 } } },
  { id: PK.heavy_hand, ref: 'P3', skill: SK.melee_heavy, group: GR.melee, name: 'Heavy Hand', effect: 'attack',
    extra: { story: 'Armor dents, bones give: your heavy weapons hit 20% harder.', rule: `Damage of an attack with skill ${skillName(SK.melee_heavy)} is ×1.2, before armor.`, numbers: { damageMult: 1.2 } } },
  { id: PK.sharp_eyes, ref: 'P4', skill: SK.ranged_light, group: GR.ranged, name: 'Sharp Eyes', effect: 'senses',
    extra: { story: `Nothing escapes the archer's eye: +10 ${skillName(SK.eyesight)}.`, rule: `+10 true skill in ${skillName(SK.eyesight)}.`, trueSkillTo: { [SK.eyesight]: 10 } } },
  { id: PK.steady_draw, ref: 'P5', skill: SK.ranged_medium, group: GR.ranged, name: 'Steady Draw', effect: 'attack',
    extra: { story: 'Steady hands, a heavier bite: +5 to hit with medium ranged weapons, and they hit 10% harder.', rule: `+5 on attack rolls with skill ${skillName(SK.ranged_medium)}, and its damage is ×1.1, before armor.`, numbers: { hitAdd: 5, damageMult: 1.1 } } },
  { id: PK.armor_piercer, ref: 'P6', skill: SK.ranged_heavy, group: GR.ranged, name: 'Armor Piercer', effect: 'attack',
    extra: { story: 'Steel plate is just a suggestion to your bolts: it stops 2 less of each hit.', rule: `On a hit with skill ${skillName(SK.ranged_heavy)}, each armor the hit passes (worn and natural) reduces the damage by 2 less (never below 0).`, numbers: { armorPierce: 2 } } },
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
    extra: { story: 'Your flesh knits itself shut, twice as fast as it has any right to.', rule: `Natural recovery (the hourly healing row read from ${skillName(SK.endurance)}) is ×2.`, numbers: { recoveryMult: 2 } } },
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
  // CN8 (D-260): a payoff perk on Intimidation 120 (Battle Cry holds 140), with the 120 boosts like any other
  { id: PK.chorus, ref: 'CN8', skill: SK.intimidation, group: GR.influence, name: 'Chorus', effect: 'speech', milestone: 120,
    extra: { story: 'Every way you have learned to strike fear joins the one voice: your auras reach further for every shout perk you own.',
      rule: `The owner's engagement auras (Dread Presence and any later one) reach further: each shout piece (perks tagged shout in src/library/perkThemes.ts, Chorus included) adds ${CONFIG.CHORUS_REACH_M} m in full (CONFIG.CHORUS_REACH_M), and the base reach (AURA_REACH_M, ${CONFIG.AURA_REACH_M} m) grows by the payoff share of those pieces, ${CONFIG.PAYOFF_SHARE * 100}% × pieces^${CONFIG.PAYOFF_EXP} (placeholders). Chorus alone: ${+(CONFIG.AURA_REACH_M * (1 + payoffShare(1)) + 1 * CONFIG.CHORUS_REACH_M).toFixed(1)} m; with three shout pieces: ${+(CONFIG.AURA_REACH_M * (1 + payoffShare(3)) + 3 * CONFIG.CHORUS_REACH_M).toFixed(1)} m.` } },
];

/** SH1-SH4: the 40 and 80 perks give +5 to their own skill; the 120 perk gives HIGH_PERK_SHARE of it instead, and HIGH_PERK_SPREAD of
 * it to every skill sharing a group on top of the +1. Shares read true skill without shares (trueSkill in src/ruleset/perks.ts) */
const own = (r: Row) => r.milestone === 120
  ? { short: `+${CONFIG.HIGH_PERK_SHARE * 100}% ${skillName(r.skill)}, +1 and +${CONFIG.HIGH_PERK_SPREAD * 100}% ${GROUP_NAMES[r.group]}`,
    rule: `+${CONFIG.HIGH_PERK_SHARE * 100}% of the owner's true ${skillName(r.skill)} (HIGH_PERK_SHARE, placeholder) as true skill in ${skillName(r.skill)}. +1 true skill, and +${CONFIG.HIGH_PERK_SPREAD * 100}% of the owner's true ${skillName(r.skill)} (HIGH_PERK_SPREAD, placeholder), in every skill of group ${groupName(r.group)}. Shares read true skill without shares; several on one skill add in full.` }
  : { short: `+5 ${skillName(r.skill)}, +1 ${GROUP_NAMES[r.group]}`,
    rule: `+5 true skill in ${skillName(r.skill)}. +1 true skill in every skill of group ${groupName(r.group)}.` };

export const BOOST_PERKS: PerkWriteup[] = ROWS.map((r) => ({
  id: r.id, ref: r.ref, name: r.name, skill: r.skill, place: '40',
  ladder: { skill: r.skill, milestone: r.milestone ?? 40 }, effect: r.effect, functionBoost: 1,
  ...(r.milestone === 120 ? { shareOwn: CONFIG.HIGH_PERK_SHARE, shareGroup: CONFIG.HIGH_PERK_SPREAD } : { trueSkill: 5 }),
  ...(r.extra.numbers ? { numbers: r.extra.numbers } : {}), ...(r.extra.trueSkillTo ? { trueSkillTo: r.extra.trueSkillTo } : {}),
  story: `${own(r).short}. ${r.extra.story}`,
  rules: {
    kind: 'Always on', trigger: 'Always.', conditions: [],
    effect: `${own(r).rule} ${r.extra.rule}`,
    lasts: 'Always.',
  },
}));
