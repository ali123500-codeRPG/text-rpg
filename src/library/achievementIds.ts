import type { AchievementRule } from '../types';
import { CONFIG } from '../config';

// Achievement IDs: every achievement's ID is a fixed number, never its name, so renaming one touches only the
// library achievements table. Code refers to achievements through ACH; data and saves store the number (as a string key).
// Never reuse or renumber an ID; a new achievement takes the next free number.
export const ACH = {
  first_defeat_body_type: '1', defeats_10_body_type: '2', defeats_100_body_type: '3',
  first_defeat_race: '4', defeats_10_race: '5', defeats_100_race: '6',
  defeats_10: '7', defeats_100: '8', defeats_1000: '9',
  mastery_50: '10', mastery_100: '11', mastery_150: '12',
  unaware_1: '13', unaware_10: '14', unaware_100: '15',
  yielded_1: '16', yielded_10: '17', yielded_50: '18',
  crits_10: '19', crits_100: '20', crits_1000: '21',
  beyond_1: '22', beyond_2: '23', beyond_3: '24',
  beyond_group_1: '25', beyond_group_2: '26', beyond_group_3: '27',
  flawless_1: '28', flawless_10: '29', flawless_50: '30',
  outnumbered_1: '31', outnumbered_10: '32',
  brink_1: '33', brink_5: '34',
  crippled_1: '35', crippled_10: '36',
  zones_50: '37', zones_250: '38', zones_1000: '39',
  deals_1: '40', deals_10: '41', deals_100: '42',
  days_7: '43', days_30: '44', days_100: '45',
  class_unlock: '46', defeats_250: '47',
} as const;
/** what each achievement rule counts, for display; the count is AchievementDef.count */
export const ACH_RULE_TEXT: Record<AchievementRule, string> = {
  defeats: 'defeats', mastery: 'true skill in all three skills of a tree', unaware_defeats: 'foes defeated while unaware of you',
  yielded: 'foes who surrendered or broke while fighting you', crits: 'rolls at Critical Success or better with a skill of the group',
  beyond_crit: 'step(s) past Critical Success on a roll', crippled_defeats: 'foes defeated while one of your parts is Crippled',
  zones: 'different zones entered', deals: 'deals struck with you', days: 'game days survived', class_unlock: 'class unlocked',
  flawless: 'fights won without losing HP, after at least one defense roll', outnumbered: `fights won against ${CONFIG.OUTNUMBERED_FOES}+ foes at once, with no one on your side`,
  brink: 'fights survived after reaching Critical health (once per fight)',
};
/** the tree mastery achievement for an All-XXX step */
export const MASTERY_ACH: Record<number, string> = { 50: ACH.mastery_50, 100: ACH.mastery_100, 150: ACH.mastery_150 };
