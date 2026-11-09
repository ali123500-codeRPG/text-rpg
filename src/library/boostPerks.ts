// 40 perks: the 40 milestone of each skill ("40 milestone perks: options" F1–F5, P1–P19). Every 40
// perk gives +5 true skill in its own skill, +1 true skill in its own skill and every other skill sharing one of its
// groups (docs/skill-tags.md; "+1 function (including itself)"; groups F1), so +6 in its own skill, and ONE more number: a number of the skill itself (`numbers`), or +10 true skill spent on
// skills that work well with it (`trueSkillTo`). 40/80/120 perks have no conditions. The 20/60/100/140 perks carry the
// rules changes. Names are placeholders. Story and Rules are written from the same row, so they always match.
import type { BoostNumbers, PerkEffect, PerkWriteup, SkillGroup } from '../types';
import { GROUP_NAMES, groupName } from './functionNames';
import { skillName } from './skillNames';
import { SK } from './skillIds';
import { GR } from './functionIds';

type Row = {
  id: string; ref: string; skill: string; name: string; effect: PerkEffect;
  /** display name of the skill, and its group key: every skill of that group, itself included, gets +1 */
  group: SkillGroup;
  extra: { story: string; rule: string; numbers?: BoostNumbers; trueSkillTo?: Record<string, number> };
};

const ROWS: Row[] = [
  // P1: Ali picked b (R5), so the aim half stays with Precise, the banked higher perk
  { id: 'keen_edge', ref: 'P1', skill: SK.melee_light, group: GR.melee, name: 'Keen Edge', effect: 'attack',
    extra: { story: 'Your blade has learned where flesh is softest: +10 to hit with light weapons.', rule: `+10 on attack rolls with skill ${skillName(SK.melee_light)}.`, numbers: { hitAdd: 10 } } },
  { id: 'guard_drill', ref: 'P2', skill: SK.melee_medium, group: GR.melee, name: 'Guard Drill', effect: 'defense',
    extra: { story: 'Every guard you hold makes the next one harder to break: +10 Block.', rule: `+10 true skill in ${skillName(SK.block)}.`, trueSkillTo: { [SK.block]: 10 } } },
  { id: 'heavy_hand', ref: 'P3', skill: SK.melee_heavy, group: GR.melee, name: 'Heavy Hand', effect: 'attack',
    extra: { story: 'Armor dents, bones give: your heavy weapons hit 20% harder.', rule: `Damage of an attack with skill ${skillName(SK.melee_heavy)} is ×1.2, before armor.`, numbers: { damageMult: 1.2 } } },
  { id: 'sharp_eyes', ref: 'P4', skill: SK.ranged_light, group: GR.ranged, name: 'Sharp Eyes', effect: 'senses',
    extra: { story: `Nothing escapes the archer's eye: +10 ${skillName(SK.eyesight)}.`, rule: `+10 true skill in ${skillName(SK.eyesight)}.`, trueSkillTo: { [SK.eyesight]: 10 } } },
  { id: 'steady_draw', ref: 'P5', skill: SK.ranged_medium, group: GR.ranged, name: 'Steady Draw', effect: 'attack',
    extra: { story: 'Steady hands, a heavier bite: +5 to hit with medium ranged weapons, and they hit 10% harder.', rule: `+5 on attack rolls with skill ${skillName(SK.ranged_medium)}, and its damage is ×1.1, before armor.`, numbers: { hitAdd: 5, damageMult: 1.1 } } },
  { id: 'armor_piercer', ref: 'P6', skill: SK.ranged_heavy, group: GR.ranged, name: 'Armor Piercer', effect: 'attack',
    extra: { story: 'Steel plate is just a suggestion to your bolts: it stops 2 less of each hit.', rule: `On a hit with skill ${skillName(SK.ranged_heavy)}, each armor the hit passes (worn and natural) reduces the damage by 2 less (never below 0).`, numbers: { armorPierce: 2 } } },
  { id: 'street_fighter', ref: 'P7', skill: SK.unarmed_strike, group: GR.melee, name: 'Street Fighter', effect: 'attack',
    extra: { story: 'Fists taught you that anything in reach is a weapon: +10 Improvisation.', rule: `+10 true skill in ${skillName(SK.unarmed_improvised)}.`, trueSkillTo: { [SK.unarmed_improvised]: 10 } } },
  { id: 'iron_grip', ref: 'P8', skill: SK.unarmed_grapple, group: GR.melee, name: 'Iron Grip', effect: 'attack',
    extra: { story: 'Once you take hold, struggling only tires them out: +10 on every grapple roll, breaking free included.', rule: `+10 on every roll with skill ${skillName(SK.unarmed_grapple)} (grapple attacks, and both sides of a break-free contest).`, numbers: { rollAdd: 10 } } },
  { id: 'brawlers_eye', ref: 'P9', skill: SK.unarmed_improvised, group: GR.melee, name: "Brawler's Eye", effect: 'attack',
    extra: { story: `A brawler sees the opening before the punch: +5 ${skillName(SK.unarmed_strike)}, +5 ${skillName(SK.eyesight)}.`, rule: `+5 true skill in ${skillName(SK.unarmed_strike)} and +5 in ${skillName(SK.eyesight)}.`, trueSkillTo: { [SK.unarmed_strike]: 5, [SK.eyesight]: 5 } } },
  { id: 'light_feet', ref: 'P10', skill: SK.dodge, group: GR.defense, name: 'Light Feet', effect: 'defense',
    extra: { story: 'Feet that never get hit never make a sound: +10 Sneaking.', rule: `+10 true skill in ${skillName(SK.sneaking)}.`, trueSkillTo: { [SK.sneaking]: 10 } } },
  { id: 'braced', ref: 'P11', skill: SK.block, group: GR.defense, name: 'Take the Hit', effect: 'health',
    extra: { story: 'Every blow you stop leaves you harder: +10 Endurance.', rule: `+10 true skill in ${skillName(SK.endurance)}.`, trueSkillTo: { [SK.endurance]: 10 } } },
  { id: 'quick_mend', ref: 'P12', skill: SK.endurance, group: GR.health, name: 'Fast Healer', effect: 'health',
    extra: { story: 'Your flesh knits itself shut, twice as fast as it has any right to.', rule: `Natural recovery (the hourly healing row read from ${skillName(SK.endurance)}) is ×2.`, numbers: { recoveryMult: 2 } } },
  { id: 'marksmans_eye', ref: 'P13', skill: SK.eyesight, group: GR.notice, name: "Marksman's Eye", effect: 'attack',
    extra: { story: 'What your eye finds, your arrow follows: +5 Light ranged, +5 Medium ranged.', rule: `+5 true skill in ${skillName(SK.ranged_light)} and +5 in ${skillName(SK.ranged_medium)}.`, trueSkillTo: { [SK.ranged_light]: 5, [SK.ranged_medium]: 5 } } },
  { id: 'soft_step', ref: 'P14', skill: SK.earshot, group: GR.notice, name: 'Soft Step', effect: 'senses',
    extra: { story: 'You know what every footstep sounds like, so yours make none: +10 Sneaking.', rule: `+10 true skill in ${skillName(SK.sneaking)}.`, trueSkillTo: { [SK.sneaking]: 10 } } },
];

export const BOOST_PERKS: PerkWriteup[] = ROWS.map((r) => ({
  id: r.id, ref: r.ref, name: r.name, skill: r.skill, place: '40',
  ladder: { skill: r.skill, milestone: 40 }, effect: r.effect, trueSkill: 5, functionBoost: 1,
  ...(r.extra.numbers ? { numbers: r.extra.numbers } : {}), ...(r.extra.trueSkillTo ? { trueSkillTo: r.extra.trueSkillTo } : {}),
  story: `+5 ${skillName(r.skill)}, +1 ${GROUP_NAMES[r.group]}. ${r.extra.story}`,
  rules: {
    kind: 'Always on', trigger: 'Always.', conditions: [],
    effect: `+5 true skill in ${skillName(r.skill)}. +1 true skill in every skill of group ${groupName(r.group)}. ${r.extra.rule}`,
    lasts: 'Always.',
  },
}));
