// 40 perks: the 40 milestone of each skill (Ali, 08/11/2026, "40 milestone perks: options" F1–F5, P1–P19). Every 40
// perk gives +5 true skill in its own skill, +1 true skill in every other skill sharing one of its functions
// (docs/skill-tags.md), and ONE more number: a number of the skill itself (`numbers`), or +10 true skill spent on
// skills that work well with it (`trueSkillTo`). 40/80/120 perks have no conditions. The 20/60/100/140 perks carry the
// rules changes. Names are placeholders. Story and Rules are written from the same row, so they always match.
import type { BoostNumbers, PerkEffect, PerkWriteup } from '../types';

type Row = {
  id: string; ref: string; skill: string; name: string; effect: PerkEffect;
  /** display name of the skill, then the skills sharing a function with it (they get +1) */
  label: string; siblings: string[];
  extra: { story: string; rule: string; numbers?: BoostNumbers; trueSkillTo?: Record<string, number> };
};

const ROWS: Row[] = [
  // P1: Ali picked b (R5), so the aim half stays with Precise, the banked higher perk
  { id: 'keen_edge', ref: 'P1', skill: 'melee_light', label: 'Light weapons', siblings: ['Medium weapons', 'Heavy weapons'], name: 'Keen Edge', effect: 'attack',
    extra: { story: 'Your light weapons find their mark: +10 to hit with them.', rule: '+10 on attack rolls with skill melee_light.', numbers: { hitAdd: 10 } } },
  { id: 'guard_drill', ref: 'P2', skill: 'melee_medium', label: 'Medium weapons', siblings: ['Light weapons', 'Heavy weapons'], name: 'Guard Drill', effect: 'defense',
    extra: { story: 'Your blocks get better too: +10 Block.', rule: '+10 true skill in block.', trueSkillTo: { block: 10 } } },
  { id: 'heavy_hand', ref: 'P3', skill: 'melee_heavy', label: 'Heavy weapons', siblings: ['Light weapons', 'Medium weapons'], name: 'Heavy Hand', effect: 'attack',
    extra: { story: 'Your heavy weapons hit 20% harder.', rule: 'Damage of an attack with skill melee_heavy is ×1.2, before armor.', numbers: { damageMult: 1.2 } } },
  { id: 'sharp_eyes', ref: 'P4', skill: 'ranged_light', label: 'Light ranged', siblings: ['Medium ranged', 'Heavy ranged'], name: 'Sharp Eyes', effect: 'senses',
    extra: { story: 'You spot more: +10 Sight.', rule: '+10 true skill in sight.', trueSkillTo: { sight: 10 } } },
  { id: 'steady_draw', ref: 'P5', skill: 'ranged_medium', label: 'Medium ranged', siblings: ['Light ranged', 'Heavy ranged'], name: 'Steady Draw', effect: 'attack',
    extra: { story: 'A little of both: +5 to hit with medium ranged weapons, and they hit 10% harder.', rule: '+5 on attack rolls with skill ranged_medium, and its damage is ×1.1, before armor.', numbers: { hitAdd: 5, damageMult: 1.1 } } },
  { id: 'armor_piercer', ref: 'P6', skill: 'ranged_heavy', label: 'Heavy ranged', siblings: ['Light ranged', 'Medium ranged'], name: 'Armor Piercer', effect: 'attack',
    extra: { story: 'Your bolts punch through armor: it stops 2 less of each hit.', rule: 'On a hit with skill ranged_heavy, each armor the hit passes (worn and natural) reduces the damage by 2 less (never below 0).', numbers: { armorPierce: 2 } } },
  { id: 'street_fighter', ref: 'P7', skill: 'unarmed_strike', label: 'Strike', siblings: ['Grapple', 'Improvisation'], name: 'Street Fighter', effect: 'attack',
    extra: { story: 'Anything in reach becomes a weapon: +10 Improvisation.', rule: '+10 true skill in unarmed_improvised.', trueSkillTo: { unarmed_improvised: 10 } } },
  { id: 'iron_grip', ref: 'P8', skill: 'unarmed_grapple', label: 'Grapple', siblings: ['Strike', 'Improvisation'], name: 'Iron Grip', effect: 'attack',
    extra: { story: 'Your holds are harder to escape: +10 on every grapple roll, breaking free included.', rule: '+10 on every roll with skill unarmed_grapple (grapple attacks, and both sides of a break-free contest).', numbers: { rollAdd: 10 } } },
  { id: 'brawlers_eye', ref: 'P9', skill: 'unarmed_improvised', label: 'Improvisation', siblings: ['Strike', 'Grapple'], name: "Brawler's Eye", effect: 'attack',
    extra: { story: 'Your fists and your eyes sharpen: +5 Strike, +5 Sight.', rule: '+5 true skill in unarmed_strike and +5 in sight.', trueSkillTo: { unarmed_strike: 5, sight: 5 } } },
  { id: 'light_feet', ref: 'P10', skill: 'dodge', label: 'Dodge', siblings: ['Block'], name: 'Light Feet', effect: 'defense',
    extra: { story: 'Quick feet are quiet feet: +10 Sneaking.', rule: '+10 true skill in sneaking.', trueSkillTo: { sneaking: 10 } } },
  { id: 'braced', ref: 'P11', skill: 'block', label: 'Block', siblings: ['Dodge'], name: 'Braced', effect: 'health',
    extra: { story: 'Taking blows hardens you: +10 Endurance.', rule: '+10 true skill in endurance.', trueSkillTo: { endurance: 10 } } },
  { id: 'quick_mend', ref: 'P12', skill: 'endurance', label: 'Endurance', siblings: [], name: 'Quick Mend', effect: 'health',
    extra: { story: 'Your body heals twice as fast on its own.', rule: 'Natural recovery (the hourly healing row read from endurance) is ×2.', numbers: { recoveryMult: 2 } } },
  { id: 'marksmans_eye', ref: 'P13', skill: 'sight', label: 'Sight', siblings: ['Hearing'], name: "Marksman's Eye", effect: 'attack',
    extra: { story: 'A good eye guides your shots: +5 Light ranged, +5 Medium ranged.', rule: '+5 true skill in ranged_light and +5 in ranged_medium.', trueSkillTo: { ranged_light: 5, ranged_medium: 5 } } },
  { id: 'soft_step', ref: 'P14', skill: 'hearing', label: 'Hearing', siblings: ['Sight'], name: 'Soft Step', effect: 'senses',
    extra: { story: 'Knowing what others hear, you move quieter: +10 Sneaking.', rule: '+10 true skill in sneaking.', trueSkillTo: { sneaking: 10 } } },
];

const sib = (r: Row) => (r.siblings.length ? ` and +1 in ${r.siblings.join(', ')}` : '');
export const BOOST_PERKS: PerkWriteup[] = ROWS.map((r) => ({
  id: r.id, ref: r.ref, name: r.name, skill: r.skill, place: '40',
  ladder: { skill: r.skill, milestone: 40 }, effect: r.effect, trueSkill: 5, functionBoost: 1,
  ...(r.extra.numbers ? { numbers: r.extra.numbers } : {}), ...(r.extra.trueSkillTo ? { trueSkillTo: r.extra.trueSkillTo } : {}),
  story: `+5 ${r.label}${sib(r)}. ${r.extra.story}`,
  rules: {
    kind: 'Always on', trigger: 'Always.', conditions: [],
    effect: `+5 true skill in ${r.skill}. +1 true skill in every other skill sharing a function with it${r.siblings.length ? ` (${r.siblings.join(', ')})` : ' (none today)'}. ${r.extra.rule}`,
    lasts: 'Always.',
  },
}));
