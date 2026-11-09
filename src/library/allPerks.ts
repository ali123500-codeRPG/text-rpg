// All-50 perks (Ali, 08/11/2026, All-50 doc https://claude.ai/artifact/R5CirgnTX2vwoG4tPp8oxR). A tree's All-50 is a
// bundle of parts, granted for free when every skill of the tree reaches 50 true skill (G1–G8). Each part is its own perk
// (so code checks hasPerk on the part) with a Story and an exact Rules view, like the ladder perks. A part is granted
// only once it is built (BUILT_PERKS). Names: "<tree> All-50: <name>" (G5); All-50 and 100+ names may be dramatic.
import type { PerkWriteup } from '../types';

/** a tree's All-50 bundle: its name and its parts, in the doc's order */
export type AllBundle = { treeId: string; step: 50; name: string; parts: string[] };

export const ALL_BUNDLES: AllBundle[] = [
  { treeId: 'melee', step: 50, name: 'Warborn', parts: ['opening_strike', 'counter', 'fighters_frame', 'steady_guard'] }, // Weapon Drill dropped (Round 3)
  { treeId: 'ranged', step: 50, name: 'Death from Afar', parts: ['unerring', 'volley', 'past_the_cover', 'hunters_eye'] },
  { treeId: 'unarmed', step: 50, name: 'Open Hand', parts: ['hard_to_hold', 'iron_knuckles', 'bare_handed_guard'] },
  { treeId: 'defense', step: 50, name: 'The Unbroken', parts: ['second_wind', 'dodgy', 'thick_hide'] },
  { treeId: 'perception', step: 50, name: 'Nothing Escapes', parts: ['spotter', 'curiouser', 'night_eyes'] }, // Light Sleeper parked (Ali, 09/11/2026)
  { treeId: 'stealth', step: 50, name: 'One with the Dark', parts: ['strike_and_fade', 'child_of_night', 'hushed_steps'] },
  { treeId: 'speech', step: 50, name: 'Silver Voice', parts: ['soft_landing', 'easy_speaker', 'silver_words'] }, // Read Them parked; Silver Words picked in Round 4 (Ali, 09/11/2026)
];

const part = (treeId: string, p: Omit<PerkWriteup, 'skill' | 'place' | 'allStep'>): PerkWriteup =>
  ({ ...p, skill: treeId, place: 'all50', allStep: { treeId, step: 50 } });

export const ALL_PARTS: PerkWriteup[] = [
  // ---- Combat – Arms ----
  part('melee', { id: 'opening_strike', ref: 'T1a', name: 'Opening Strike', effect: 'attack',
    story: 'You always make the first blow count. Your first melee attack on each foe in a fight lands one outcome better.',
    rules: { kind: 'Always on', trigger: 'The owner makes a melee attack.', conditions: ['It is the owner\'s first melee attack on that foe in this engagement (Ali, 09/11/2026: per foe per engagement).'],
      effect: 'Tier shift +1 on the attack roll. The defense roll still happens.', lasts: 'That attack.', cooldown: 'Once per foe per engagement.' } }),
  part('melee', { id: 'counter', ref: 'T1c', name: 'Counter', effect: 'defense',
    story: 'A clumsy swing is an invitation. When a melee attack on you goes badly wrong, you strike back at once.',
    rules: { kind: 'Always on', trigger: 'A melee attack on the owner is resolved.',
      conditions: ['The attack roll ends in Critical Failure or worse (Ali, 08/11/2026).', 'The attack was not itself a free attack.', 'The owner is active, in the attacker\'s zone, and its default mode at that range is melee or unarmed.', 'Once per turn.'],
      effect: 'The owner makes one attack at the attacker at once, with that mode. It does not use the owner\'s action.', lasts: 'That attack.' } }),
  part('melee', { id: 'fighters_frame', ref: 'T1d', name: "Fighter's Frame", effect: 'defense',
    story: 'A body hardened by a thousand bouts. Melee blows on you land a tenth lighter.',
    rules: { kind: 'Always on', trigger: 'A melee or unarmed attack hits the owner.', conditions: ['The attack mode is not ranged.'],
      effect: 'The hit\'s damage before armor is ×0.9 (CONFIG.FIGHTERS_FRAME_MULT, placeholder).', lasts: 'Always.' } }),
  part('melee', { id: 'steady_guard', ref: 'T1e', name: 'Steady Guard', effect: 'defense',
    story: 'Your blade knows where the blow will land. Your Block is 5 higher, and 5 higher again when you block with a melee weapon.',
    rules: { kind: 'Always on', trigger: 'Always; and the owner makes a Block roll.', conditions: ['The extra +5 needs the block to be made with a melee weapon, not a shield.'],
      effect: '+5 true skill in Block (Ali, 09/11/2026). Block rolls made with a melee weapon also get +5 effective skill (CONFIG.STEADY_GUARD, placeholder).', lasts: 'Always.' },
    trueSkillTo: { block: 5 } }),
  // ---- Combat – Ranged ----
  part('ranged', { id: 'unerring', ref: 'T2a', name: 'Unerring', effect: 'attack',
    story: 'Your first shot comes before they are ready. The first time you shoot in a fight, at a foe who hasn\'t moved yet, it is harder to avoid.',
    rules: { kind: 'Always on', trigger: 'The owner makes a ranged attack.',
      conditions: ['It is the owner\'s first ranged attack in this engagement.', 'The target hasn\'t acted yet in its engagement (it has none, or it began this turn and the target hasn\'t had its action).'],
      effect: 'Tier shift −1 on the target\'s defense roll. No roll is skipped (Ali, 08/11/2026).', lasts: 'That attack.', cooldown: 'Once per engagement.' } }),
  part('ranged', { id: 'volley', ref: 'T2b', name: 'Volley', effect: 'attack',
    story: 'One shot is never the last. Once a fight, after a ranged hit, your next shot is already on its way to another foe.',
    rules: { kind: 'Automatic', trigger: 'The owner\'s ranged attack hits.',
      conditions: ['Once per engagement.', 'Not after a free attack.', 'Code picks at random among actors already hostile to the owner that the owner is aware of and the weapon reaches; none, no shot (Ali, 08/11/2026).'],
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
  // ---- Combat – Unarmed ----
  part('unarmed', { id: 'hard_to_hold', ref: 'T3a', name: 'Hard to Hold', effect: 'defense',
    story: 'Hands never stay on you for long. Your rolls to break a hold land one outcome better.',
    rules: { kind: 'Always on', trigger: 'The owner, held, tries to break free (its grapple roll in the break-free contest).', conditions: [],
      effect: 'Tier shift +1 on that roll.', lasts: 'That roll.' } }),
  part('unarmed', { id: 'iron_knuckles', ref: 'T3d', name: 'Iron Knuckles', effect: 'attack',
    story: 'Your hands are weapons now. Your unarmed hits deal a tenth more damage.',
    rules: { kind: 'Always on', trigger: 'The owner hits with an unarmed mode (punch, grapple, slam and the rest).', conditions: [],
      effect: 'The hit\'s damage before armor is ×1.1 (CONFIG.IRON_KNUCKLES_MULT, placeholder).', lasts: 'Always.' } }),
  part('unarmed', { id: 'bare_handed_guard', ref: 'T3d2', name: 'Bare-Handed Guard', effect: 'defense',
    story: 'With nothing in your hands, nothing slows you. Your Dodge is 5 higher, and 5 higher again while you hold no weapon.',
    rules: { kind: 'Always on', trigger: 'Always; and the owner makes a Dodge roll.', conditions: ['The extra +5 needs the owner to hold no item with a weapon mode.'],
      effect: '+5 true skill in Dodge (Ali, 09/11/2026). While holding no weapon, Dodge rolls also get +5 effective skill (CONFIG.BARE_HANDED_GUARD, placeholder).', lasts: 'Always.' },
    trueSkillTo: { dodge: 5 } }),
  // ---- Combat – Defense ----
  part('defense', { id: 'second_wind', ref: 'T4b', name: 'Second Wind', effect: 'health',
    story: 'When the blood starts to run, you find more in you. Once a fight, at your first serious wound, you shake one off.',
    rules: { kind: 'Automatic', trigger: 'An attack leaves the owner at Wounded or worse on the health track.', conditions: ['Once per engagement.', 'The owner is not down (Incapacitated or worse).'],
      effect: 'The owner\'s health lost drops to the top of the level one better (Wounded to Injured: 45% lost). Body parts are unchanged.', lasts: 'Permanent (it is healing).', cooldown: 'Once per engagement.' } }),
  part('defense', { id: 'dodgy', ref: 'T4d', name: 'Dodgy', effect: 'defense',
    story: 'You are never quite where they aim. Attacks on you lose 5 skill.',
    rules: { kind: 'Always on', trigger: 'An attack roll is made against the owner.', conditions: [],
      effect: 'That attack roll gets −5 effective skill (a foe_perk modifier, CONFIG.DODGY_SKILL, placeholder).', lasts: 'That roll.' } }),
  part('defense', { id: 'thick_hide', ref: 'T4e', name: 'Thick Hide', effect: 'health',
    story: 'Blows that would cut others only bruise you. Every hit costs you a little less health.',
    rules: { kind: 'Always on', trigger: 'A hit damages the owner\'s body (not a shield).', conditions: [],
      effect: 'The health lost from that hit, after armor, is ×0.95 (CONFIG.THICK_HIDE_MULT, placeholder).', lasts: 'Always.' } }),
  // ---- Perception ----
  part('perception', { id: 'spotter', ref: 'T5b', name: 'Spotter', effect: 'senses',
    story: 'What you see, your people sense. Your band-mates beside you know something is there whenever you do.',
    rules: { kind: 'Always on', trigger: 'The end of each turn.', conditions: ['The owner is aware of an actor outside its band.', 'A band-mate is in the owner\'s zone and is less than suspicious of that actor.'],
      effect: 'That band-mate becomes suspicious of the actor (told by the owner), with its zone as last known.', lasts: 'Until the band-mate\'s belief changes on its own.' } }),
  part('perception', { id: 'curiouser', ref: 'T5d', name: 'Curiouser and Curiouser', effect: 'senses',
    story: 'Once you notice something, you notice everything. A good Eyesight or Earshot roll counts one outcome better.',
    rules: { kind: 'Always on', trigger: 'The owner makes an Eyesight or Earshot roll.', conditions: ['The roll ends in Success or better.'],
      effect: 'Tier shift +1 on that roll. In a contest it wins more close calls: a tie becomes a win, a loss a tie.', lasts: 'That roll.' } }),
  part('perception', { id: 'night_eyes', ref: 'T5e', name: 'Night Eyes', effect: 'senses',
    story: 'The dark hides little from you. Light counts one step brighter when you look.',
    rules: { kind: 'Always on', trigger: 'The owner makes an Eyesight roll.', conditions: [],
      effect: 'The light there is read one step brighter (dark as dim, dim as bright). The mirror of Child of Night.', lasts: 'That roll.' } }),
  // ---- Stealth – Conventional ----
  part('stealth', { id: 'strike_and_fade', ref: 'T6a', name: 'Strike and Fade', effect: 'stealth',
    story: 'They see the blow, never the hand. Right after you strike from hiding, you try to vanish again.',
    rules: { kind: 'Automatic', trigger: 'The owner attacks while stealthy.', conditions: ['The owner is still active after the attack.'],
      effect: 'The owner is stealthy again and vanishes in place: each observer makes a Vanishing contest against the owner, as a Vanish does, which can break the sight of those who see the owner. It does not use the owner\'s action or move.', lasts: 'That contest.' } }),
  part('stealth', { id: 'child_of_night', ref: 'T6c', name: 'Child of Night', effect: 'stealth',
    story: 'The dark knows you. Light counts one step darker for all your stealth.',
    rules: { kind: 'Always on', trigger: 'The owner makes a roll of a stealth skill (Sneaking, Combat Stealth, Vanishing).', conditions: [],
      effect: 'The light there is read one step darker (bright as dim, dim as dark).', lasts: 'That roll.' } }),
  part('stealth', { id: 'hushed_steps', ref: 'T6d', name: 'Hushed Steps', effect: 'stealth',
    story: 'Even your mistakes are quiet. Against someone who can only hear you, a Sneaking slip that only just fails still counts as a success.',
    rules: { kind: 'Always on', trigger: 'The owner makes a Sneaking roll in a stealth contest.', conditions: ['The observer perceives the owner by sound (hearing), not sight.', 'The roll ends in a Near Miss.'],
      effect: 'Tier shift +1 on that roll, so it counts as a Success. Only Failure or worse is heard.', lasts: 'That roll.',
      open: 'Renamed from the doc\'s "Light Feet", which is already a 40 perk.' } }),
  // ---- Speech ----
  part('speech', { id: 'soft_landing', ref: 'T7a', name: 'Soft Landing', effect: 'speech',
    story: 'Even your stumbles sound reasonable. A speech roll that goes wrong counts one outcome better.',
    rules: { kind: 'Always on', trigger: 'The owner makes a Persuasion, Intimidation or Barter roll.', conditions: ['The roll ends in a Near Miss or worse (Ali, 09/11/2026).'],
      effect: 'Tier shift +1 on that roll.', lasts: 'That roll.' } }),
  part('speech', { id: 'easy_speaker', ref: 'T7d', name: 'Easy Speaker', effect: 'speech',
    story: 'Words slide off you. When someone tries to talk you round, your answer lands one outcome better.',
    rules: { kind: 'Always on', trigger: 'The owner answers a speech contest: someone speaks to it with Persuasion, Intimidation or Barter.', conditions: [],
      effect: 'Tier shift +1 on the owner\'s answering roll (Ali, 09/11/2026, option a).', lasts: 'That roll.',
      open: 'Only the player starts speech contests today, so this helps NPC owners. When NPCs speak to the player with a roll (OQ-29), it covers the player too.' } }),
  part('speech', { id: 'silver_words', ref: 'T7e', name: 'Silver Words', effect: 'speech',
    story: 'You know which words land. +5 to Persuasion, Intimidation and Barter.',
    rules: { kind: 'Always on', trigger: 'Always.', conditions: [],
      effect: '+5 true skill in Persuasion, Intimidation and Barter (Ali, 09/11/2026, Round 4 option a; the twin of Hunter\'s Eye).', lasts: 'Always.' },
    trueSkillTo: { persuasion: 5, intimidation: 5, barter: 5 } }),
];
