// All-50 perks (All-50 doc https://claude.ai/artifact/R5CirgnTX2vwoG4tPp8oxR). Each skill has its own All-50 part
// (SKILL_PARTS), and each tree has one passive that fits it (ALL_BUNDLES). Once enough skills of a tree reach 50 true
// skill (CONFIG.ALL_STEP_SKILLS by the tree's rating: never, 3, 2 or 1), the tree's passive and those skills' parts
// are granted free; each further skill of the tree that reaches 50 then adds its own part. A skill's part belongs to the skill, not the tree, so a skill that moves to another tree
// takes its part along. A tree with fewer skills than that never earns its All-50. Each part is its own perk
// (so code checks hasPerk on the part) with a Story and an exact Rules view, like the ladder perks. A part is granted
// only once it is built (BUILT_PERKS). Names: "<tree> All-50: <name>" (G5); All-50 and 100+ names may be dramatic.
import { TR } from './treeIds';
import { PA } from './tableIds';
import { FN } from './functionIds';
import type { PerkWriteup } from '../types';
import { SK } from './skillIds';
import { PK } from './perkIds';
import { CONFIG } from '../config';

/** a tree's All-50: its name and its passive (the skills' parts are in SKILL_PARTS) */
export type AllBundle = { treeId: string; step: number; name: string; passive?: string };

export const ALL_BUNDLES: AllBundle[] = [
  { treeId: TR.melee, step: 50, name: 'Warborn', passive: PK.fighters_frame }, // Weapon Drill dropped (Round 3)
  { treeId: TR.ranged, step: 50, name: 'Death from Afar', passive: PK.hunters_eye },
  { treeId: TR.unarmed, step: 50, name: 'Open Hand', passive: PK.bare_handed_guard },
  { treeId: TR.defense, step: 50, name: 'The Unbroken', passive: PK.thick_hide },
  { treeId: TR.fortitude, step: 50, name: 'Hard to Kill', passive: PK.last_to_fall },
  { treeId: TR.perception, step: 50, name: 'Nothing Escapes', passive: PK.curiouser }, // Light Sleeper parked (D-190)
  { treeId: TR.stealth, step: 50, name: 'One with the Dark', passive: PK.child_of_night },
  { treeId: TR.speech, step: 50, name: 'Silver Voice', passive: PK.silver_words }, // Read Them parked (D-191)
  // All-100 and All-150 work like the All-50: a tree passive plus each skill's part (STEP_PARTS) at that step
  { treeId: TR.perception, step: 150, name: 'Nothing Unwitnessed' }, // no passive yet; Every Sense One is Eyesight's and Earshot's part
];

/** each skill's All-50 part, whatever tree the skill sits in (a skill with none yet brings nothing).
 * No part yet: Insight (parked), Intimidation, Stamina and the one-skill trees. */
export const SKILL_PARTS: Record<string, string> = {
  [SK.melee_light]: PK.counter, [SK.melee_medium]: PK.steady_guard, [SK.melee_heavy]: PK.opening_strike,
  [SK.ranged_light]: PK.unerring, [SK.ranged_medium]: PK.volley, [SK.ranged_heavy]: PK.past_the_cover,
  [SK.unarmed_strike]: PK.iron_knuckles, [SK.unarmed_grapple]: PK.hard_to_hold, [SK.unarmed_improvised]: PK.junk_arsenal,
  [SK.dodge]: PK.dodgy, [SK.parry]: PK.against_the_grain, [SK.block]: PK.iron_rim, [SK.endurance]: PK.second_wind, [SK.resolve]: PK.grit, [SK.stamina]: PK.second_breath,
  [SK.eyesight]: PK.night_eyes, [SK.earshot]: PK.know_the_step, // Spotter parked (D-192)
  [SK.sneaking]: PK.hushed_steps, [SK.combat_stealth]: PK.strike_and_fade, [SK.vanishing]: PK.misdirection, // Fade Back parked (D-232)
  [SK.persuasion]: PK.soft_landing, [SK.barter]: PK.easy_speaker,
};

/** each skill's part at each All-X step: All-50 parts above; none at 100 or 150 yet */
export const STEP_PARTS: Record<number, Record<string, string>> = {
  50: SKILL_PARTS, 100: {},
  150: { [SK.eyesight]: PK.one_sense, [SK.earshot]: PK.one_sense }, // one part shared by both senses: either at 150 brings it
};

const part = (treeId: string, p: Omit<PerkWriteup, 'skill' | 'place' | 'allStep'>): PerkWriteup =>
  ({ ...p, skill: treeId, place: 'all50', allStep: { treeId, step: 50 } });

export const ALL_PARTS: PerkWriteup[] = [
  // ---- Combat – Arms ----
  part(TR.melee, { id: PK.opening_strike, ref: 'T1a', name: 'Opening Strike', effect: 'attack',
    story: 'You always make the first blow count. Your first melee attack on each foe in a fight lands one outcome better.',
    rules: { kind: 'Always on', trigger: 'The owner makes a melee attack.', conditions: ['It is the owner\'s first melee attack on that foe in this engagement.'],
      effect: 'Tier shift +1 on the attack roll.', lasts: 'That attack.', cooldown: 'Once per foe per engagement.' } }),
  part(TR.melee, { id: PK.counter, ref: 'T1c', name: 'Counter', effect: 'defense',
    story: 'A clumsy swing is an invitation. When a melee attack on you goes badly wrong, you strike back at once.',
    rules: { kind: 'Always on', trigger: 'A melee attack on the owner is resolved.',
      conditions: ['The attack roll ends in Critical Failure or worse.', 'The attack was not itself a free attack.', 'The owner is active, in the attacker\'s zone, and its default mode at that range is melee or unarmed.'],
      effect: 'The owner makes one attack at the attacker at once, with that mode. It does not use the owner\'s action.', lasts: 'That attack.' } }),
  part(TR.melee, { id: PK.fighters_frame, ref: 'T1d', name: "Fighter's Frame", effect: 'defense',
    story: 'A body hardened by a thousand bouts. Melee blows that get past your armor cost you a tenth less health.',
    rules: { kind: 'Always on', trigger: 'A melee or unarmed attack damages the owner\'s body (not a shield).', conditions: ['The attack mode is not ranged.'],
      effect: `The health lost from that hit, after armor, is ×${CONFIG.FIGHTERS_FRAME_MULT} (CONFIG.FIGHTERS_FRAME_MULT, placeholder).`, lasts: 'Always.' } }),
  part(TR.melee, { id: PK.steady_guard, ref: 'T1e', name: 'Steady Guard', effect: 'defense',
    story: 'Your blade knows where the blow will land. Your Parry is 5 higher, and 5 higher again when you parry with a medium weapon.',
    rules: { kind: 'Always on', trigger: 'Always; and the owner makes a Parry roll.', conditions: ['The extra +5 needs the parry to be made with a medium melee weapon.'],
      effect: `+5 true skill in Parry. Parry rolls made with a medium melee weapon also get +${CONFIG.STEADY_GUARD} effective skill (CONFIG.STEADY_GUARD, placeholder).`, lasts: 'Always.' },
    trueSkillTo: { [SK.parry]: 5 } }),
  // ---- Combat – Ranged ----
  part(TR.ranged, { id: PK.unerring, ref: 'T2a', name: 'Unerring', effect: 'attack',
    story: 'Your first shot comes before they are ready. The first time you shoot in a fight, at a foe who hasn\'t moved yet, it is harder to avoid.',
    rules: { kind: 'Always on', trigger: 'The owner makes a ranged attack.',
      conditions: ['It is the owner\'s first ranged attack in this engagement.', 'The target hasn\'t acted yet in its engagement (it has none, or it began this turn and the target hasn\'t had its action).'],
      effect: 'Tier shift −1 on the target\'s defense roll.', lasts: 'That attack.', cooldown: 'Once per engagement.' } }),
  part(TR.ranged, { id: PK.volley, ref: 'T2b', name: 'Volley', effect: 'attack',
    story: 'One shot is never the last. Once a fight, after a ranged hit, your next shot is already on its way to another foe.',
    rules: { kind: 'Automatic', trigger: 'The owner\'s ranged attack hits.',
      conditions: ['Once per engagement.', 'Not after a free attack.', 'Code picks at random among actors already hostile to the owner that the owner is aware of and the weapon reaches; none, no shot.'],
      effect: 'The owner makes one more ranged attack at that target with the same weapon. It does not use the owner\'s action.', lasts: 'That attack.', cooldown: 'Once per engagement.' } }),
  part(TR.ranged, { id: PK.past_the_cover, ref: 'T2c', name: 'Past the Cover', effect: 'attack',
    story: 'Cover only hides most of a body. Cover counts one step lighter against your ranged attacks.',
    rules: { kind: 'Always on', trigger: 'The owner makes a ranged attack.', conditions: [],
      effect: 'The target zone\'s cover is read one step lighter (heavy as some, some as none).', lasts: 'That attack.' } }),
  part(TR.ranged, { id: PK.hunters_eye, ref: 'T2d', name: "Hunter's Eye", effect: 'senses',
    story: 'An archer lives by the eye: +10 to every skill you see with.',
    rules: { kind: 'Always on', trigger: 'Always.', conditions: [],
      effect: '+10 true skill in every skill with the sight function.', lasts: 'Always.' },
    fnSkill: { fn: FN.sight, add: 10 } }),
  // ---- Combat – Unarmed ----
  part(TR.unarmed, { id: PK.hard_to_hold, ref: 'T3a', name: 'Hard to Hold', effect: 'defense',
    story: 'Hands never stay on you for long. Your rolls to break a hold land one outcome better.',
    rules: { kind: 'Always on', trigger: 'The owner, held, tries to break free (its grapple roll in the break-free contest).', conditions: [],
      effect: 'Tier shift +1 on that roll.', lasts: 'That roll.' } }),
  part(TR.unarmed, { id: PK.iron_knuckles, ref: 'T3d', name: 'Iron Knuckles', effect: 'attack',
    story: 'Your hands are weapons now. Your unarmed hits deal a tenth more damage.',
    rules: { kind: 'Always on', trigger: 'The owner hits with an unarmed mode (punch, grapple, slam and the rest).', conditions: [],
      effect: `The hit's damage before armor is ×${CONFIG.IRON_KNUCKLES_MULT} (CONFIG.IRON_KNUCKLES_MULT, placeholder).`, lasts: 'Always.' } }),
  part(TR.unarmed, { id: PK.junk_arsenal, ref: 'T3e', name: 'Junk Arsenal', effect: 'attack',
    story: 'A chair leg, a bottle, a tankard: in your hands they all hurt. Your improvised weapons hit a fifth harder.',
    rules: { kind: 'Always on', trigger: 'The owner hits with an improvised weapon (an attack that rolls Improvisation, or a throw that blends it in).', conditions: [],
      effect: `The hit's damage before armor is ×${CONFIG.JUNK_ARSENAL_MULT} (CONFIG.JUNK_ARSENAL_MULT, placeholder).`, lasts: 'Always.' } }),
  part(TR.unarmed, { id: PK.bare_handed_guard, ref: 'T3d2', name: 'Bare-Handed Guard', effect: 'defense',
    story: 'With nothing in your hands, nothing slows you. Your Dodge is 5 higher, and 5 higher again while you hold no weapon.',
    rules: { kind: 'Always on', trigger: 'Always; and the owner makes a Dodge roll.', conditions: ['The extra +5 needs the owner to hold no item with a weapon mode.'],
      effect: `+5 true skill in Dodge. While holding no weapon, Dodge rolls also get +${CONFIG.BARE_HANDED_GUARD} effective skill (CONFIG.BARE_HANDED_GUARD, placeholder).`, lasts: 'Always.' },
    trueSkillTo: { [SK.dodge]: 5 } }),
  // ---- Combat – Defense ----
  part(TR.defense, { id: PK.second_wind, ref: 'T4b', name: 'Second Wind', effect: 'health',
    story: 'When the blood starts to run, you find more in you. Once a fight, at your first serious wound, you shake one off.',
    rules: { kind: 'Automatic', trigger: 'An attack leaves the owner at Wounded or worse on the health track.', conditions: ['Once per engagement.', 'The owner is not down (Incapacitated or worse).'],
      effect: 'The owner\'s health lost drops to the top of the level one better (Wounded to Injured: 45% lost). Body parts are unchanged.', lasts: 'Permanent (it is healing).', cooldown: 'Once per engagement.' } }),
  part(TR.fortitude, { id: PK.last_to_fall, ref: 'T4f', name: 'Last to Fall', effect: 'health',
    story: 'The worse it gets, the steadier you are. Once you are badly hurt, fear takes a quarter less out of you.',
    rules: { kind: 'Always on', trigger: 'The owner loses morale.', conditions: ['The owner is at Wounded or worse on the health track.'],
      effect: `The morale lost is ×${CONFIG.LAST_TO_FALL_MULT} (CONFIG.LAST_TO_FALL_MULT, placeholder).`, lasts: 'Always.' } }),
  part(TR.defense, { id: PK.dodgy, ref: 'T4d', name: 'Dodgy', effect: 'defense',
    story: 'You are never quite where they aim. Attacks on you lose 10 skill.',
    rules: { kind: 'Always on', trigger: 'An attack roll is made against the owner.', conditions: [],
      effect: `That attack roll gets −${CONFIG.DODGY_SKILL} effective skill (a foe_perk modifier, CONFIG.DODGY_SKILL, placeholder).`, lasts: 'That roll.' } }),
  part(TR.defense, { id: PK.thick_hide, ref: 'T4e', name: 'Thick Hide', effect: 'health',
    story: 'Blows that would cut others only bruise you. Every hit lands a little lighter, before your armor takes its share.',
    rules: { kind: 'Always on', trigger: 'A hit lands on the owner\'s body (not a shield).', conditions: [],
      effect: `The hit's damage before armor is ×${CONFIG.THICK_HIDE_MULT} (CONFIG.THICK_HIDE_MULT, placeholder).`, lasts: 'Always.' } }),
  part(TR.defense, { id: PK.against_the_grain, ref: 'T4g', name: 'Against the Grain', effect: 'defense',
    story: 'A heavy blade is no harder to turn than any other. Heavy weapons lose their edge against your parry.',
    rules: { kind: 'Always on', trigger: 'The owner parries a heavy melee weapon.', conditions: [],
      effect: `The heavy-weapon gap shift (−${-CONFIG.HEAVY_VS_BLOCK_GAP}, HEAVY_VS_BLOCK_GAP) is not applied to the owner's parries. Blocks still take it.`, lasts: 'Always.' } }),
  part(TR.defense, { id: PK.iron_rim, ref: 'T4h', name: 'Iron Rim', effect: 'defense',
    story: 'Your shield is bound to last. It wears down a quarter slower than anyone else\'s.',
    rules: { kind: 'Always on', trigger: 'A blow lands on the owner\'s shield.', conditions: [],
      effect: `The damage the shield's pool takes is ×${CONFIG.IRON_RIM_MULT} (CONFIG.IRON_RIM_MULT, placeholder). Shield Breaker's ×${CONFIG.SHIELD_BREAKER_MULT} still applies on top.`, lasts: 'Always.' } }),
  part(TR.fortitude, { id: PK.grit, ref: 'T4i', name: 'Grit', effect: 'health',
    story: 'A hard body makes a hard mind. A quarter of your Endurance adds to every Resolve roll, morale rolls included, and both skills learn from them.',
    rules: { kind: 'Always on', trigger: 'The owner makes a Resolve roll (a morale roll, or an answer to an aura).', conditions: ['The Fortitude tree is open to the owner.'],
      effect: `Endurance augments Resolve: the roll adds the owner's true Endurance × ${CONFIG.GRIT_SHARE} (CONFIG.GRIT_SHARE, placeholder) × its tier, the way a skill augment does, and Endurance can learn from the roll the same way.`, lasts: 'Always.' },
    augments: [{ from: SK.endurance, skill: SK.resolve, share: CONFIG.GRIT_SHARE }] }),
  part(TR.fortitude, { id: PK.second_breath, ref: 'SS8', name: 'Second Breath', effect: 'health',
    story: 'Just when your lungs give out, they find more. Once a fight, when your breath runs out, half of it comes back at once.',
    rules: { kind: 'Automatic', trigger: 'A strain cost would empty the owner\'s short-term line.', conditions: ['Once per engagement.', 'The owner is in an engagement.'],
      effect: `The line refills to ${CONFIG.SECOND_BREATH_PCT}% at once (CONFIG.SECOND_BREATH_PCT, placeholder) and the rest of the cost is paid from it; no strain spills into sleep debt that time.`, lasts: 'Permanent (it is recovery).', cooldown: 'Once per engagement.' } }),
  // ---- Perception ----
  // Spotter is parked (D-192): no skill carries it in SKILL_PARTS, so it is never granted
  part(TR.perception, { id: PK.spotter, ref: 'T5b', name: 'Spotter', effect: 'senses',
    story: 'What you see, your people sense. Your band-mates who can hear your call or see your signal know something is there whenever you do.',
    rules: { kind: 'Always on', trigger: 'The end of each turn.', conditions: ['The owner is aware of an actor outside its band.', 'A band-mate hears the owner\'s normal voice clearly or makes out its hand sign (close visibility), and is less than suspicious of that actor.'],
      effect: 'That band-mate becomes suspicious of the actor (told by the owner), with its zone as last known.', lasts: 'Until the band-mate\'s belief changes on its own.' } }),
  part(TR.perception, { id: PK.curiouser, personality: { [PA.curiosity]: CONFIG.ACH_PERSONALITY_STEP }, ref: 'T5d', name: 'Curiouser and Curiouser', effect: 'senses',
    story: 'Once you notice something, you notice everything. A good sight or hearing roll counts one outcome better.',
    rules: { kind: 'Always on', trigger: 'The owner makes a sight or hearing roll (any skill with that function; Tremor adds to every hearing roll).', conditions: ['The roll ends in Success or better.'],
      effect: 'Tier shift +1 on that roll. In a contest it wins more close calls: a tie becomes a win, a loss a tie.', lasts: 'That roll.' } }),
  part(TR.perception, { id: PK.one_sense, ref: 'T5-150', name: 'Every Sense One', effect: 'senses',
    story: 'Your senses have run together. What you see, you hear, and what you hear, you see: a voice in the dark has a face, and a figure across the yard has a voice.',
    rules: { kind: 'Always on', trigger: 'The owner perceives an event, or makes a sight or hearing roll.', conditions: ['The All-150 part of both Eyesight and Earshot: granted with the Perception All-150 when either of them is at 150.'],
      effect: 'The owner perceives every event as well as the better of its sight and its hearing would allow, and by both senses at once: whatever it hears, it sees as clearly (who and what), and whatever it sees, it hears (spoken words included). Every sight or hearing roll (by function) uses the best of the owner\'s sight and hearing skills, so light only matters when a sight skill is the one rolling.',
      lasts: 'Always.' } }),
  part(TR.perception, { id: PK.know_the_step, ref: 'T5f', name: 'Know the Step', effect: 'senses',
    story: 'A cough, a gait, the way a voice drops. You know the people you have met by sound alone.',
    rules: { kind: 'Always on', trigger: 'The owner hears someone it can\'t see (sound only).', conditions: ['The owner knows that someone\'s name.'],
      effect: 'The owner learns who it is: the heard event and any words spoken name them, as if seen.', lasts: 'That event.' } }),
  part(TR.perception, { id: PK.night_eyes, ref: 'T5e', name: 'Night Eyes', effect: 'senses',
    story: 'The dark hides little from you. Light counts one step brighter when you look.',
    rules: { kind: 'Always on', trigger: 'The owner makes an Eyesight roll.', conditions: [],
      effect: 'The light there is read one step brighter (dark as dim, dim as bright). The mirror of Child of Night.', lasts: 'That roll.' } }),
  // ---- Stealth – Conventional ----
  part(TR.stealth, { id: PK.strike_and_fade, ref: 'T6a', name: 'Strike and Fade', effect: 'stealth',
    story: 'They see the blow, never the hand. Right after you strike from hiding, you try to vanish again.',
    rules: { kind: 'Automatic', trigger: 'The owner attacks while stealthy.', conditions: ['The owner is still active after the attack.'],
      effect: 'The owner is stealthy again and vanishes in place: each observer makes a Vanishing contest against the owner, as a Vanish does, which can break the sight of those who see the owner. It does not use the owner\'s action or move.', lasts: 'That contest.' } }),
  part(TR.stealth, { id: PK.child_of_night, ref: 'T6c', name: 'Child of Night', effect: 'stealth',
    story: 'The dark knows you. Light counts one step darker for all your stealth.',
    rules: { kind: 'Always on', trigger: 'The owner makes a roll of a stealth skill (Sneaking, Combat Stealth, Vanishing).', conditions: [],
      effect: 'The light there is read one step darker (bright as dim, dim as dark).', lasts: 'That roll.' } }),
  part(TR.stealth, { id: PK.hushed_steps, ref: 'T6d', name: 'Hushed Steps', effect: 'stealth',
    story: 'Even your mistakes are quiet. Against someone who can only hear you, a Sneaking slip that only just fails still counts as a success.',
    rules: { kind: 'Always on', trigger: 'The owner makes a Sneaking roll in a stealth contest.', conditions: ['The observer perceives the owner by sound (hearing), not sight.', 'The roll ends in a Near Miss.'],
      effect: 'Tier shift +1 on that roll, so it counts as a Success. Only Failure or worse is heard.', lasts: 'That roll.',
      open: 'Renamed from the doc\'s "Light Feet", which is already a 40 perk.' } }),
  part(TR.stealth, { id: PK.misdirection, ref: 'T6e', name: 'Misdirection', effect: 'stealth',
    story: '"Look over there!" and you are gone. A quarter of your Lying adds to every Vanishing roll, and both skills learn from it.',
    rules: { kind: 'Always on', trigger: 'The owner makes a Vanishing roll.', conditions: ['The Trickery tree is open to the owner.'],
      effect: `Lying augments Vanishing: the roll adds the owner's true Lying × ${CONFIG.MISDIRECTION_SHARE} (CONFIG.MISDIRECTION_SHARE, placeholder) × its tier, the way a skill augment does, and Lying can learn from the roll the same way.`, lasts: 'Always.' },
    augments: [{ from: SK.lying, skill: SK.vanishing, share: CONFIG.MISDIRECTION_SHARE }] }),
  // Fade Back is parked (D-232): no skill carries it in SKILL_PARTS and it is not built, so it is never granted
  part(TR.stealth, { id: PK.fade_back, ref: 'T6f', name: 'Fade Back', effect: 'stealth',
    story: 'The blow passes where you were, and so do you. Once a fight, a clean dodge lets you vanish on the spot.',
    rules: { kind: 'Automatic', trigger: 'The owner dodges an attack.', conditions: ['The dodge wins by a gap of +3 or better.', 'Once per engagement.'],
      effect: 'The owner vanishes in place for free right after: each observer makes a Vanishing contest against the owner, as a Vanish does. It does not use the owner\'s action or move.', lasts: 'That contest.', cooldown: 'Once per engagement.',
      open: 'Parked (D-232): the Vanishing part offered beside Misdirection in PT12.' } }),
  // ---- Speech ----
  part(TR.speech, { id: PK.soft_landing, ref: 'T7a', name: 'Soft Landing', effect: 'speech',
    story: 'Even your stumbles sound reasonable. A speech roll that goes wrong counts one outcome better.',
    rules: { kind: 'Always on', trigger: 'The owner makes a Persuasion, Intimidation or Barter roll.', conditions: ['The roll ends in a Near Miss or worse.'],
      effect: 'Tier shift +1 on that roll.', lasts: 'That roll.' } }),
  part(TR.speech, { id: PK.easy_speaker, ref: 'T7d', name: 'Easy Speaker', effect: 'speech',
    story: 'Words slide off you. When someone tries to talk you round, your answer lands one outcome better.',
    rules: { kind: 'Always on', trigger: 'The owner answers a speech contest: someone speaks to it with Persuasion, Intimidation or Barter.', conditions: [],
      effect: 'Tier shift +1 on the owner\'s answering roll, the player\'s too when an NPC speaks to them with a roll (OQ-29).', lasts: 'That roll.' } }),
  part(TR.speech, { id: PK.silver_words, ref: 'T7e', name: 'Silver Words', effect: 'speech',
    story: 'You know which words land. +5 to Persuasion, Intimidation and Barter.',
    rules: { kind: 'Always on', trigger: 'Always.', conditions: [],
      effect: '+5 true skill in Persuasion, Intimidation and Barter.', lasts: 'Always.' },
    trueSkillTo: { [SK.persuasion]: 5, [SK.intimidation]: 5, [SK.barter]: 5 } }),
];

// a passive carries its tree; a skill's part carries its skill and step (src/library/data.ts fills in the skill's current tree).
// A part shared by several skills names the first.
for (const p of ALL_PARTS) {
  const b = ALL_BUNDLES.find((x) => x.passive === p.id);
  const at = (Object.entries(STEP_PARTS) as [string, Record<string, string>][]).flatMap(([step, m]) => Object.keys(m).filter((k) => m[k] === p.id).map((skill) => ({ step: +step as AllBundle['step'], skill })))[0];
  if (b) Object.assign(p, { skill: b.treeId, allStep: { treeId: b.treeId, step: b.step } });
  else if (at) Object.assign(p, { allStep: { treeId: p.allStep!.treeId, step: at.step, skill: at.skill } });
}
