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
  class_tiers_2: 'AC55', class_tiers_4: 'AC56', class_tiers_all: 'AC57',
  char_level_10: 'AC58',
  brink_3: 'AC59', unaware_50: 'AC60',
  held_line_1: 'AC61', held_line_10: 'AC62',
  quests_1: 'AC63', quests_5: 'AC64', quests_10: 'AC65', quests_25: 'AC66', quests_50: 'AC67', quests_abandoned_5: 'AC68',
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
  class_max: 'classes at their top level', class_max_tiers: 'class tiers with a class at its top level',
  char_level: 'character levels, again at every multiple',
};
/** the tree mastery achievement for an All-XXX step */
export const MASTERY_ACH: Record<number, string> = { 50: ACH.mastery_50, 100: ACH.mastery_100, 150: ACH.mastery_150 };
