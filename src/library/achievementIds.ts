// Achievement IDs: every achievement's ID is a fixed number, never its name, so renaming one touches only the
// library achievements table. Code refers to achievements through ACH; data and saves store the number (as a string key).
// Never reuse or renumber an ID; a new achievement takes the next free number.
export const ACH = {
  first_defeat_body_type: '1', defeats_10_body_type: '2', defeats_100_body_type: '3',
  first_defeat_race: '4', defeats_10_race: '5', defeats_100_race: '6',
  defeats_10: '7', defeats_100: '8', defeats_1000: '9',
  mastery_50: '10', mastery_100: '11', mastery_150: '12',
} as const;
/** the tree mastery achievement for an All-XXX step */
export const MASTERY_ACH: Record<number, string> = { 50: ACH.mastery_50, 100: ACH.mastery_100, 150: ACH.mastery_150 };
