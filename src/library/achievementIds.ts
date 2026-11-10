import type { AchievementRule, AchievementTag } from '../types';
import { CONFIG } from '../config';

// Achievement IDs: every achievement's ID is fixed (type prefix AC + a number), never its name, so renaming one touches
// only the library achievements table. Code refers to achievements through ACH; data and saves store the ID.
// Never reuse or renumber an ID; a new achievement takes the next free number.
export const ACH = {
  first_defeat_body_type: 'AC1', defeats_10_body_type: 'AC2', defeats_100_body_type: 'AC3',
  first_defeat_race: 'AC4', defeats_10_race: 'AC5', defeats_100_race: 'AC6',
  defeats_10: 'AC7', defeats_100: 'AC8', defeats_1000: 'AC9',
  mastery_50: 'AC10', mastery_100: 'AC11', mastery_150: 'AC12',
  unaware_1: 'AC13', unaware_10: 'AC14', unaware_100: 'AC15',
  yielded_1: 'AC16', yielded_10: 'AC17', yielded_50: 'AC18',
  crits_10: 'AC19', crits_100: 'AC20', crits_1000: 'AC21',
  beyond_1: 'AC22', beyond_2: 'AC23', beyond_3: 'AC24',
  beyond_group_1: 'AC25', beyond_group_2: 'AC26', beyond_group_3: 'AC27',
  flawless_1: 'AC28', flawless_10: 'AC29', flawless_50: 'AC30',
  outnumbered_1: 'AC31', outnumbered_10: 'AC32',
  brink_1: 'AC33', brink_5: 'AC34',
  crippled_1: 'AC35', crippled_10: 'AC36',
  zones_50: 'AC37', zones_250: 'AC38', zones_1000: 'AC39',
  deals_1: 'AC40', deals_10: 'AC41', deals_100: 'AC42',
  days_7: 'AC43', days_30: 'AC44', days_100: 'AC45',
  class_unlock: 'AC46', defeats_250: 'AC47',
  class_max_1: 'AC48', class_max_3: 'AC49', class_max_5: 'AC50', class_max_10: 'AC51',
  class_max_tier_1: 'AC52', class_max_tier_2: 'AC53', class_max_tier_3: 'AC54',
  class_tiers_2: 'AC55', class_tiers_3: 'AC136', class_tiers_4: 'AC56', class_tiers_5: 'AC137', class_tiers_all: 'AC57',
  char_level_10: 'AC58',
  brink_3: 'AC59', unaware_50: 'AC60',
  held_line_1: 'AC61', held_line_10: 'AC62',
  quests_1: 'AC63', quests_5: 'AC64', quests_10: 'AC65', quests_25: 'AC66', quests_50: 'AC67', quests_abandoned_5: 'AC68',
  clean_10: 'AC69', clean_100: 'AC70', clean_1000: 'AC71', unseen_10: 'AC72', unseen_50: 'AC73', unseen_250: 'AC74',
  vanished_5: 'AC75', vanished_25: 'AC76', spotted_10: 'AC77', spotted_100: 'AC78', spotted_fn_1: 'AC79', spotted_fn_10: 'AC80',
  spotted_fn_100: 'AC81', speech_10: 'AC82', speech_100: 'AC83', speech_500: 'AC84', talked_down_1: 'AC85', talked_down_10: 'AC86',
  talked_down_50: 'AC87', outmatched_1: 'AC88', outmatched_10: 'AC89', outmatched_fn_1: 'AC90', outmatched_fn_10: 'AC91', enemy_friend_1: 'AC92',
  enemy_friend_5: 'AC93', no_blow_1: 'AC94', no_blow_10: 'AC95', bought_100: 'AC96', bought_1000: 'AC97', bought_10000: 'AC98',
  sold_100: 'AC99', sold_1000: 'AC100', sold_10000: 'AC101', mended_1: 'AC102', mended_10: 'AC103', mended_50: 'AC104',
  back_from_down_1: 'AC105', holds_10: 'AC106', holds_100: 'AC107', aimed_10: 'AC108', aimed_100: 'AC109', aimed_1000: 'AC110',
  aimed_size_10: 'AC111', aimed_size_100: 'AC112', quests_giver_5: 'AC113', quest_givers_10: 'AC114', quest_chain_1: 'AC115', quests_early_1: 'AC116',
  quests_unpaid_1: 'AC117',
  spar_1: 'AC118', spar_10: 'AC119', spar_25: 'AC120', spar_50: 'AC121', spar_200: 'AC122',
  cruel_spar_1: 'AC123', cruel_spar_10: 'AC124', cruel_spar_25: 'AC125', spar_losses_10: 'AC126',
  total_10: 'AC127', total_25: 'AC128', total_50: 'AC129', total_100: 'AC130', total_250: 'AC131',
  spar_losses_1: 'AC132', defeated_5: 'AC133', defeated_25: 'AC134', defeated_100: 'AC135',
} as const;
/** achievement tags (unordered categories, so the key is the ID); a row can carry several. Display names live only here. */
export const ACH_TAGS: Record<AchievementTag, string> = {
  combat: 'Combat', stealth: 'Stealth', social: 'Social', exploration: 'Exploration', survival: 'Survival', skill: 'Skill', progression: 'Progression',
};
/** what each achievement rule counts, for display; the count is AchievementDef.count */
export const ACH_RULE_TEXT: Record<AchievementRule, string> = {
  defeats: 'defeats', mastery: 'true skill in all three skills of a tree', unaware_defeats: 'foes defeated while unaware of you',
  yielded: 'foes who surrendered or broke while fighting you', crits: 'rolls at Critical Success or better with a skill of the group',
  beyond_crit: 'step(s) past Critical Success on a roll', crippled_defeats: 'foes defeated while one of your parts is Crippled',
  zones: 'different zones entered', deals: 'deals struck with you', days: 'game days survived', class_unlock: 'class unlocked',
  flawless: 'fights won without losing HP, after at least one defense roll', outnumbered: `fights won against ${CONFIG.OUTNUMBERED_FOES}+ foes at once, with no one on your side`,
  brink: 'fights survived after reaching Critical health (once per fight)',
  held_line: 'fights won beside at least one ally, while the foes outnumbered your side',
  quests_done: 'quests finished', quests_abandoned: 'quests you gave up',
  clean_defense: 'dodges or blocks that stopped a hit completely', unseen_moves: 'sneaks into a zone where someone was suspicious of you, and no one there saw you',
  vanished: 'vanishes that lost everyone who saw you', spotted: 'people you noticed while they were sneaking or hiding',
  speech_won: 'speech contests won with the skill', talked_down: 'foes talked out of hostility before any blow from you',
  outmatched: 'contests won against someone with higher true skill', enemy_to_friend: 'people once hostile to you who became friendly',
  won_without_blow: 'fights won without making an attack yourself', coin_spent: 'copper spent buying',
  coin_earned: 'copper earned selling', mended: 'Crippled parts healed back to Healthy', back_from_down: 'times back to Unhurt after going Down',
  holds: 'holds on a foe, or holds you broke free of', aimed_hits: 'aimed strikes that landed on the part you called',
  quests_for_giver: 'quests finished for the same person', quest_givers: 'different people you finished quests for',
  quest_chains: 'runs of follow-up quests finished from the first to the last', quests_early: 'quests finished before half their time ran out',
  quests_unpaid: 'quests finished for someone who promised no pay',
  class_max: 'classes at their top level', class_max_tiers: 'class tiers with a class at its top level',
  char_level: 'character levels, again at every multiple',
  spar_wins: 'spars won', cruel_spar_wins: 'cruel spars won (fought to Incapacitated)', spar_losses: 'spars lost', defeated: 'fights lost: you went Down, or got away while a foe still fought you',
  won_panicking: 'fights won while your morale is Panicking', morale_breaks: 'times your morale broke',
  achievements: 'other achievements earned (scars and these totals do not count; a replaced level still does)',
};
/** the tree mastery achievement for an All-XXX step */
export const MASTERY_ACH: Record<number, string> = { 50: ACH.mastery_50, 100: ACH.mastery_100, 150: ACH.mastery_150 };
