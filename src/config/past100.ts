import type { Past100Key } from '../scales';

/** the one ladder past 100 (names in scales.ts PAST_100): task grades (DIFFICULTY), NPC rank anchors (RANK_ROWS) and equip
 * needs (EQUIP_NEED) all read these numbers, so a step moves everywhere at once (placeholders); past Divine each step adds
 * PAST_100_STEP (Divine+, Divine++ …) */
export const PAST_100: Record<Past100Key, number> = { beyond: 150, mythic: 200, transcendent: 300, divine: 400 };
export const PAST_100_STEP = 100;
