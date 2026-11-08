// All-50 perks (Ali, 08/11/2026, All-50 doc https://claude.ai/artifact/R5CirgnTX2vwoG4tPp8oxR). A tree's All-50 is a
// bundle of parts, granted for free when every skill of the tree reaches 50 true skill (G1–G8). Each part is its own perk
// (so code checks hasPerk on the part) with a Story and an exact Rules view, like the ladder perks. A part is granted
// only once it is built (BUILT_PERKS). Names: "<tree> All-50: <name>" (G5); All-50 and 100+ names may be dramatic.
import type { PerkWriteup } from '../types';

/** a tree's All-50 bundle: its name and its parts, in the doc's order */
export type AllBundle = { treeId: string; step: 50; name: string; parts: string[] };

export const ALL_BUNDLES: AllBundle[] = [
  { treeId: 'melee', step: 50, name: 'Warborn', parts: ['weapon_drill', 'counter', 'fighters_frame'] },
  { treeId: 'ranged', step: 50, name: 'Death from Afar', parts: ['volley', 'past_the_cover', 'hunters_eye'] },
  { treeId: 'unarmed', step: 50, name: 'Open Hand', parts: [] }, // round 2 parts await Ali's answers
  { treeId: 'defense', step: 50, name: 'The Unbroken', parts: ['second_wind', 'dodgy'] },
  { treeId: 'perception', step: 50, name: 'Nothing Escapes', parts: ['curiouser'] },
  { treeId: 'stealth', step: 50, name: 'One with the Dark', parts: ['strike_and_fade', 'child_of_night', 'hushed_steps'] },
  { treeId: 'speech', step: 50, name: 'Silver Voice', parts: ['easy_speaker'] },
];

const part = (treeId: string, p: Omit<PerkWriteup, 'skill' | 'place' | 'allStep'>): PerkWriteup =>
  ({ ...p, skill: treeId, place: 'all50', allStep: { treeId, step: 50 } });

export const ALL_PARTS: PerkWriteup[] = [
  // ---- Combat – Arms ----
  part('melee', { id: 'weapon_drill', ref: 'T1b', name: 'Weapon Drill', effect: 'attack',
    story: 'Steel finds your hand on its own. Drawing, switching or picking up a melee weapon costs you no time.',
    rules: { kind: 'Always on', trigger: 'The owner draws, switches to or picks up a melee weapon.', conditions: ['The weapon has a melee mode.'],
      effect: 'That draw, switch or pick-up does not use the owner\'s action.', lasts: 'Always.' } }),
  part('melee', { id: 'counter', ref: 'T1c', name: 'Counter', effect: 'defense',
    story: 'A clumsy swing is an invitation. When a melee attack on you goes badly wrong, you strike back at once.',
    rules: { kind: 'Always on', trigger: 'A melee attack on the owner is resolved.',
      conditions: ['The attack roll ends in Critical Failure or worse (Ali, 08/11/2026).', 'The owner holds a melee weapon or can strike unarmed, and is active.', 'Once per turn.'],
      effect: 'The owner makes one melee attack at the attacker at once, with its current weapon. It does not use the owner\'s action.', lasts: 'That attack.' } }),
  part('melee', { id: 'fighters_frame', ref: 'T1d', name: "Fighter's Frame", effect: 'defense',
    story: 'A body hardened by a thousand bouts. Melee blows on you land a tenth lighter.',
    rules: { kind: 'Always on', trigger: 'A melee or unarmed attack hits the owner.', conditions: ['The attack mode is not ranged.'],
      effect: 'The hit\'s damage before armor is ×0.9 (CONFIG.FIGHTERS_FRAME_MULT, placeholder).', lasts: 'Always.' } }),
  // ---- Combat – Ranged ----
  part('ranged', { id: 'volley', ref: 'T2b', name: 'Volley', effect: 'attack',
    story: 'One shot is never the last. Once a fight, after a ranged hit, your next shot is already on its way to another foe.',
    rules: { kind: 'Automatic', trigger: 'The owner\'s ranged attack hits.',
      conditions: ['Once per engagement.', 'Code picks a target the owner sees that is already hostile to the owner; none, no shot (Ali, 08/11/2026).', 'The weapon can still shoot.'],
      effect: 'The owner makes one more ranged attack at that target with the same weapon. It does not use the owner\'s action.', lasts: 'That attack.', cooldown: 'Once per engagement.' } }),
  part('ranged', { id: 'past_the_cover', ref: 'T2c', name: 'Past the Cover', effect: 'attack',
    story: 'Cover only hides most of a body. Cover counts one step lighter against your ranged attacks.',
    rules: { kind: 'Always on', trigger: 'The owner makes a ranged attack.', conditions: [],
      effect: 'The target zone\'s cover is read one step lighter (heavy as some, some as none).', lasts: 'That attack.' } }),
  part('ranged', { id: 'hunters_eye', ref: 'T2d', name: "Hunter's Eye", effect: 'senses',
    story: 'An archer lives by the eye: +10 to every skill you see with.',
    rules: { kind: 'Always on', trigger: 'Always.', conditions: [],
      effect: '+10 true skill in every skill with the sight function (Ali, 08/11/2026: "+10 to sight, the function").', lasts: 'Always.' },
    fnSkill: { fn: 'sight', add: 10 } }),
  // ---- Combat – Defense ----
  part('defense', { id: 'second_wind', ref: 'T4b', name: 'Second Wind', effect: 'health',
    story: 'When the blood starts to run, you find more in you. Once a fight, at your first serious wound, you shake one off.',
    rules: { kind: 'Automatic', trigger: 'The owner\'s health track reaches Wounded or worse.', conditions: ['Once per engagement.', 'The owner is not downed.'],
      effect: 'The owner\'s health track moves one level better at once.', lasts: 'Permanent (it is healing).', cooldown: 'Once per engagement.' } }),
  part('defense', { id: 'dodgy', ref: 'T4d', name: 'Dodgy', effect: 'defense',
    story: 'You are never quite where they aim. Attacks on you lose 5 skill.',
    rules: { kind: 'Always on', trigger: 'An attack roll is made against the owner.', conditions: [],
      effect: 'That attack roll gets −5 effective skill (a foe_perk modifier, CONFIG.DODGY_SKILL, placeholder).', lasts: 'That roll.' } }),
  // ---- Perception ----
  part('perception', { id: 'curiouser', ref: 'T5d', name: 'Curiouser and Curiouser', effect: 'senses',
    story: 'Once you notice something, you notice everything. A good Eyesight or Earshot roll counts one outcome better.',
    rules: { kind: 'Always on', trigger: 'The owner makes an Eyesight or Earshot roll.', conditions: ['The roll ends in Success or better.'],
      effect: 'Tier shift +1 on that roll. In a contest it wins more close calls: a tie becomes a win, a loss a tie.', lasts: 'That roll.' } }),
  // ---- Stealth – Conventional ----
  part('stealth', { id: 'strike_and_fade', ref: 'T6a', name: 'Strike and Fade', effect: 'stealth',
    story: 'They see the blow, never the hand. Right after you strike from hiding, you try to vanish again.',
    rules: { kind: 'Automatic', trigger: 'The owner attacks from hiding (stealthy posture).', conditions: ['The owner is still active after the attack.'],
      effect: 'The owner makes a free Vanishing roll at once, contested as a Vanish. It does not use the owner\'s action.', lasts: 'That roll.' } }),
  part('stealth', { id: 'child_of_night', ref: 'T6c', name: 'Child of Night', effect: 'stealth',
    story: 'The dark knows you. Light counts one step darker for all your stealth.',
    rules: { kind: 'Always on', trigger: 'The owner makes a roll of a stealth skill (Sneaking, Combat Stealth, Vanishing).', conditions: [],
      effect: 'The light there is read one step darker (bright as dim, dim as dark).', lasts: 'That roll.' } }),
  part('stealth', { id: 'hushed_steps', ref: 'T6d', name: 'Hushed Steps', effect: 'stealth',
    story: 'Even your mistakes are quiet. A Sneaking slip that only just fails makes no sound.',
    rules: { kind: 'Always on', trigger: 'The owner\'s Sneaking roll is resolved.', conditions: ['The roll ends in a Near Miss.'],
      effect: 'The move makes no noise; only Failure or worse is heard.', lasts: 'That roll.',
      open: 'Renamed from the doc\'s "Light Feet", which is already a 40 perk.' } }),
  // ---- Speech ----
  part('speech', { id: 'easy_speaker', ref: 'T7d', name: 'Easy Speaker', effect: 'speech',
    story: 'Words slide off you. Threats and coaxing aimed at you land one outcome worse.',
    rules: { kind: 'Always on', trigger: 'An NPC makes a Persuasion or Intimidation roll at the owner.', conditions: [],
      effect: 'Tier shift −1 on that roll.', lasts: 'That roll.', needs: 'NPC speech aimed at the player.' } }),
];
