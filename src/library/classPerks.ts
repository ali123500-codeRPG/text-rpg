// Class-level perks (ClassDef.levelPerks): the perks a class grants at its levels. prototypeLibrary() in data.ts reads
// them from here.
import { FR, PA } from './tableIds';
import { CONFIG } from '../config';
import type { PerkDef } from '../types';
import { SK } from './skillIds';
import { CL } from './classIds';
import { GD } from './godIds';
import { PK } from './perkIds';

/** class-level perks (ClassDef.levelPerks), granted by a class at a level */
export const CLASS_PERKS: Record<string, PerkDef> = {
  [PK.past_the_pain]: {
    id: PK.past_the_pain, name: 'Past the Pain', built: true,
    story: 'Ten foes went down while one of your limbs hung useless. You stopped noticing.',
    rules: { kind: 'passive', trigger: 'the owner earns Bones Heal Later', conditions: [], effect: 'one Crippled part of the owner (the first in body order) gives no role penalty to rolls', lasts: 'always' },
  },
  [PK.nobody_special]: {
    id: PK.nobody_special, name: 'Nobody Special', built: true, classLevel: { classId: CL.commoner, level: 5 },
    story: 'Five seasons of ordinary work, and nobody noticed you. That can be a start.',
    perkPoints: 1,
    rules: { kind: 'passive', trigger: 'the owner gains this perk at Commoner class level 5', conditions: [], effect: '+1 perk point', lasts: 'once' },
  },
  [PK.known_at_every_stall]: {
    id: PK.known_at_every_stall, name: 'Known at Every Stall', built: false, classLevel: { classId: CL.trader, level: 5 },
    story: 'Every stallholder knows your face and your prices. Time for a shop of your own.',
    rules: { kind: 'passive', trigger: 'the owner gains this perk at Trader class level 5', conditions: [], effect: 'none yet: a new Trader capstone is still to be designed (D-358)', lasts: 'always' },
  },
  [PK.every_fall_a_lesson]: {
    id: PK.every_fall_a_lesson, name: 'Every Fall a Lesson', built: true, classLevel: { classId: CL.a_nobody, level: 15 },
    story: 'You learned more from losing than most learn from winning.',
    rules: { kind: 'passive', trigger: 'the owner loses a contest or a defended attack by exactly one tier step', conditions: [], effect: 'the skill the owner rolled (and the skill asked for, when a stand-in rolled) is marked, even when the other side is outside the learning window', lasts: 'always' },
  },
  [PK.as_far_as_the_road_goes]: {
    id: PK.as_far_as_the_road_goes, name: 'As Far as the Road Goes', built: true, classLevel: { classId: CL.late_bloomer, level: 20 },
    story: 'You were never meant for one path, so you follow each one as far as it goes.',
    rules: { kind: 'passive', trigger: 'the owner reaches a 60, 80, 100, 120 or 140 milestone in any skill', conditions: [], effect: 'the perk there opens as soon as true skill reaches it, without the earlier ladder perks in that skill it normally needs', lasts: 'always' },
  },
  [PK.write_your_own_ending]: {
    id: PK.write_your_own_ending, name: 'Write Your Own Ending', built: true, classLevel: { classId: CL.late_bloomer, level: 20 },
    story: 'You were never meant for one path, so every path is yours.',
    rules: { kind: 'passive', trigger: 'the owner gains this perk', conditions: [], effect: 'every class in the library the owner does not have unlocks at class level 0, whether or not its unlock conditions are met', lasts: 'always' },
  },
  [PK.no_road_closed]: {
    id: PK.no_road_closed, name: 'No Road Closed', built: true, classLevel: { classId: CL.late_bloomer, level: 20 },
    story: 'You were never meant for one path, so no road is closed to you.',
    rules: { kind: 'passive', trigger: 'any check of whether the owner can use a skill tree or skill', conditions: [], effect: 'the access rules (Must, Either of, Blocked by) do not apply: every tree and skill is open, and its skills can be used, marked and raised', lasts: 'always' },
  },
  // DX1-DX5: essence extraction, a blessing of Imbra, minor goddess of essence manipulation (D-311; the blessed Start grants it), and the quirk it leaves.
  // NM2: the blessing works on the essence, a small foreign addition to someone's Thread; no god touches the Thread itself.
  [PK.extract_essence]: {
    id: PK.extract_essence, name: 'Extract Essence', built: true, blessing: { god: GD.imbra, tier: 'tier_5' },
    story: 'Imbra has shown you where an essence sits on someone, apart from what they are. With them beaten before you, down or surrendered, you can pry it off and keep it.',
    rules: { kind: 'Active (your action)', trigger: 'You take the action against someone within arm\'s reach.', conditions: ['They are Down, or have surrendered.', 'Their essence is still theirs: it has not been rolled for, at a death or by an earlier pull.'],
      effect: 'No roll: their essence is offered to you, from their own list. Its grade comes from a quality roll that never fades it (below Success it is Common). They are left Hollowed.', lasts: 'once per person' },
  },
  // Imbra's Tier I blessing, given at Blessed by Imbra level 1 (ClassDef.levelBlessings)
  [PK.passing_glance]: {
    id: PK.passing_glance, name: 'A Passing Glance', built: true, blessing: { god: GD.imbra, tier: 'tier_1' }, essenceBoost: CONFIG.IMBRA_ESSENCE_BOOST,
    story: 'Imbra glanced your way once, not for long. Since then the essences you carry sit a little better on you, and give a little more.',
    rules: { kind: 'Always on (blessing)', trigger: 'Any use of true skill.', conditions: ['The owner holds an essence.'],
      effect: `The true skill every held essence gives is raised by ${CONFIG.IMBRA_ESSENCE_BOOST * 100}%.`, lasts: 'always' },
  },
  [PK.hollowed]: {
    id: PK.hollowed, name: 'Hollowed', built: true, quirk: true,
    story: 'Someone pried an essence off you and kept it. It tore some of you away with it, and the rest never sits quite right again.',
    rules: { kind: 'Always on (quirk)', trigger: 'Left by an essence extraction.', conditions: ['For good.'],
      effect: `Each of the taken essence's skills loses ${CONFIG.HOLLOWED_SHARE_MULT} times the essence's share of true skill, and every skill loses ${CONFIG.HOLLOWED_ALL_LOSS * 100}% of true skill.`, lasts: 'always' },
  },
  // a quirk no race, class or template has yet: the mechanism for a being that everyone fears or hates at first sight
  [PK.dreaded_on_sight]: {
    id: PK.dreaded_on_sight, name: 'Dreaded on Sight', built: true, quirk: true, onSight: { colder: 1, fear: FR.dreaded_sight },
    story: 'Something about you is wrong, and everyone feels it the moment they see you. Strangers stiffen, hands drift to weapons, and nobody is glad you came.',
    rules: { kind: 'Always on (quirk)', trigger: 'Anyone outside the owner\'s band sees the owner for the first time.', conditions: ['Once per person, for good.', 'The owner\'s bandmates are never affected.'],
      effect: 'They pay the fear "You set eyes on someone dreaded" (15 morale, scaled by their morale roll), in a fight or out of one. From then on their stance toward the owner reads one step colder than their band\'s (neutral becomes unfriendly, opposed becomes hostile), until play gives them a stance of their own toward the owner. The player holds no stances, so a player who sees the owner only pays the fear.', lasts: 'The colder stance lasts until that person\'s own stance toward the owner is set.' },
  },
  // the first essence trait (Tavern Brawler), and the first trade augment (D-276); a placeholder until the D-229 content round
  [PK.fists_do_the_talking]: {
    id: PK.fists_do_the_talking, name: 'Fists Do the Talking', built: true, augments: [{ from: SK.unarmed_strike, skill: SK.intimidation, kind: 'trade' }],
    story: 'Someone\'s brawls taught your fists to speak for you. Half your Strike now stands behind every threat you make, and your punches give that much up to do it.',
    rules: { kind: 'Always on (trait of the Tavern Brawler essence)', trigger: 'The owner makes an Intimidation roll, or a Strike roll.', conditions: ['The owner holds a Tavern Brawler essence.', 'The Unarmed tree is open to the owner.'],
      effect: 'Strike trades into Intimidation: every Intimidation roll adds the owner\'s true Strike × 0.5 (CONFIG.AUGMENT_TRADE_SHARE, placeholder) × its tier, and every Strike roll loses the same amount. Strike learns from the Intimidation rolls the way an augment does.', lasts: 'While a Tavern Brawler essence is held.' },
  },
  // SS10-SS12: sleep quirks, given by NPC templates through quirkTags (a rolled one per tag)
  [PK.heavy_sleeper]: {
    id: PK.heavy_sleeper, name: 'Heavy Sleeper', built: true, quirk: true, tags: ['sleep'],
    story: 'Once you are out, you are out. Shouting in the next room won\'t reach you; it takes a real racket, or a hand on your shoulder.',
    rules: { kind: 'Always on (quirk)', trigger: 'A noise reaches the sleeping owner.', conditions: [],
      effect: `The noise must be ${CONFIG.HEAVY_SLEEPER_STEPS} noise level louder than WAKE_NOISE (a shout) to wake the owner (CONFIG.HEAVY_SLEEPER_STEPS, placeholder). A blow still wakes them.`, lasts: 'Always.' },
  },
  [PK.insomniac]: {
    id: PK.insomniac, name: 'Insomniac', built: true, quirk: true, tags: ['sleep'], sleepClear: CONFIG.INSOMNIAC_CLEAR,
    story: 'You lie awake long after everyone else is snoring, and wake before you are rested. Sleep pays back your debt a quarter slower.',
    rules: { kind: 'Always on (quirk)', trigger: 'The owner sleeps.', conditions: [],
      effect: `Sleep clears sleep debt ×${CONFIG.INSOMNIAC_CLEAR} (sleepClear, CONFIG.INSOMNIAC_CLEAR, placeholder), with the bed and worn armour multipliers.`, lasts: 'Always.' },
  },
  [PK.blade_against_blade]: {
    id: PK.blade_against_blade, name: 'Blade Against Blade', built: true, classLevel: { classId: CL.swordsman, level: 1 },
    story: 'Every parry now carries the answer inside it. The Swordsman drills have begun.',
    rules: { kind: 'passive', trigger: 'the owner reaches Swordsman class level 1', conditions: [], effect: 'opens the Swordsman tree: the Riposte skill', lasts: 'always' },
  },
  [PK.first_steps_of_the_dance]: {
    id: PK.first_steps_of_the_dance, name: 'First Steps of the Dance', built: true, classLevel: { classId: CL.sword_dancer, level: 1 },
    story: 'The step and the cut become one motion. The Sword-dancer drills have begun.',
    rules: { kind: 'passive', trigger: 'the owner reaches Sword-dancer class level 1', conditions: [], effect: 'opens the Sword-dancer tree: the Blade Dance skill', lasts: 'always' },
  },
  [PK.late_bloom]: {
    id: PK.late_bloom, name: 'Late Bloom', built: true, classLevel: { classId: CL.a_somebody, level: 1 }, improveRolls: { belowShare: CONFIG.LATE_BLOOM_SHARE, rolls: 2 },
    story: 'The skills you left behind catch up fast once people start watching.',
    rules: { kind: 'passive', trigger: 'an improvement roll for a marked skill', conditions: [`the skill's raw value is below ${CONFIG.LATE_BLOOM_SHARE} × the owner's highest raw skill (CONFIG.LATE_BLOOM_SHARE, placeholder)`], effect: 'roll twice; each roll that passes adds its own gain', lasts: 'always' },
  },
  [PK.any_road_will_do]: { // UL1: Unwritten Legend's own level 1 perk (UL2: Quick Study stays A Nobody's)
    id: PK.any_road_will_do, name: 'Any Road Will Do', built: true, classLevel: { classId: CL.late_bloomer, level: 1 }, standIn: { add: CONFIG.UL_STAND_IN_ADD },
    story: 'No one showed you the way, so every way works for you.',
    rules: { kind: 'passive', trigger: 'any roll where another skill stands in for the one asked for', conditions: [], effect: `the stand-in share of every function is +${CONFIG.UL_STAND_IN_ADD} (CONFIG.UL_STAND_IN_ADD, placeholder), within 0 to 1`, lasts: 'always' },
  },
  [PK.quick_study]: {
    id: PK.quick_study, name: 'Quick Study', built: true, personality: { [PA.curiosity]: CONFIG.ACH_PERSONALITY_STEP }, classLevel: { classId: CL.a_nobody, level: 1 }, improveRolls: { below: 15, rolls: 2 },
    story: 'You came to this late, and it shows in how fast you learn. A skill you have barely touched improves twice as readily.',
    rules: { kind: 'passive', trigger: 'an improvement roll for a marked skill', conditions: ['the skill\'s raw value is below 15'], effect: 'roll twice; each roll that passes adds its own gain', lasts: 'always' },
  },
  [PK.always_yours]: {
    id: PK.always_yours, name: 'What Was Always Yours', built: true, classLevel: { classId: CL.threadbounded, level: 1 }, grantsThreadboundItem: { minRank: 'rank_4' },
    story: 'Something was tied to you before you can remember. It has never once left your side for long.',
    rules: { kind: 'passive', trigger: 'the owner gains this perk', conditions: ['a Threadbound item of Rank IV or higher is not yet in the world'], effect: 'the owner gets one such item at random, bound to them and worn', lasts: 'once' },
  },
  // D-218: the Varo's Loop's abilities, given while its owner carries it and holds the achievement its grant names.
  // The passives widen the event roll both ways and never move its middle; the two actives fire by themselves on essence quality rolls.
  [PK.loose_odds]: {
    id: PK.loose_odds, name: 'Loose Odds', built: true, eventEdges: 5,
    story: 'Fate already turned on you once. Now it turns more easily, either way.',
    rules: { kind: 'passive', trigger: 'the owner\'s event roll', conditions: ['the owner carries the Varo\'s Loop and has earned Fate Meant It as a Curse'], effect: 'the 5 naturals just inside each critical range shift a tier outward: with no tiers opened, 91–95 raise a tier and 06–10 drop one; each opened tier moves them 5 further in', lasts: 'while carried' },
  },
  [PK.twin_abyss]: {
    id: PK.twin_abyss, name: 'Twin Abyss', built: true, tierUnlocks: [{ roll: 'event', side: 'up', steps: 1 }, { roll: 'event', side: 'down', steps: 1 }],
    story: 'You have seen how bad it gets. The Loop promises it can get better by as much.',
    rules: { kind: 'passive', trigger: 'the owner\'s event roll', conditions: ['the owner carries the Varo\'s Loop and has earned Fate Has a Sense of Humour'], effect: 'one more tier opens past Critical Success and one below Critical Failure', lasts: 'while carried' },
  },
  [PK.call_the_toss]: {
    id: PK.call_the_toss, name: 'Call the Toss', built: true, essenceAuto: { kind: 'farther', cooldownMin: 1440 },
    story: 'When something offers you a piece of itself, the Loop calls the toss for you. Whatever it gives will not be ordinary.',
    rules: { kind: 'active', trigger: 'the owner\'s essence quality roll, by itself once the cooldown has passed', conditions: ['the owner carries the Varo\'s Loop and has earned Fortune\'s Favourite Accident', 'All or Nothing is not firing on the same roll'], effect: 'the roll uses two dice and keeps the one farther from the middle (50.5)', lasts: 'that roll', cooldown: 'Once per game day.' },
  },
  [PK.pull_to_the_edges]: {
    id: PK.pull_to_the_edges, name: 'Pull to the Edges', built: true, eventSpread: 1.5,
    story: 'Nothing that happens around you is merely fine any more.',
    rules: { kind: 'passive', trigger: 'the owner\'s event roll', conditions: ['the owner carries the Varo\'s Loop and has earned Cursed by Coincidence'], effect: 'the die counts 1.5 times as far from the middle (50.5) for the margin; modifiers and the natural edges are unchanged', lasts: 'while carried' },
  },
  [PK.all_or_nothing]: {
    id: PK.all_or_nothing, name: 'All or Nothing', built: true, essenceAuto: { kind: 'all_or_nothing', cooldownMin: 10080 },
    story: 'When something offers you a piece of itself, the Loop stakes everything. You get the rarest it has, or nothing at all.',
    rules: { kind: 'active', trigger: 'the owner\'s essence quality roll, by itself once the cooldown has passed', conditions: ['the owner carries the Varo\'s Loop and has earned The Joke Is on Fate'], effect: 'the roll is Critical Success on 51–100 and Critical Failure on 01–50 (a rare essence or none); it fires before Call the Toss, and only one fires per roll', lasts: 'that roll', cooldown: 'Once per 7 game days.' },
  },
  [PK.further_still]: {
    id: PK.further_still, name: 'Further Still', built: true, tierUnlocks: [{ roll: 'event', side: 'up', steps: 1 }, { roll: 'event', side: 'down', steps: 1 }],
    story: 'Fate keeps finding new ways to laugh at you. You have started laughing back.',
    rules: { kind: 'passive', trigger: 'the owner\'s event roll', conditions: ['the owner carries the Varo\'s Loop and has earned Fate\'s Favourite Punchline'], effect: 'one more tier opens past Critical Success and one below Critical Failure (on top of Twin Abyss)', lasts: 'while carried' },
  },
};
