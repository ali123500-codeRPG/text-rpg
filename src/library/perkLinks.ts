// Linked perks: owning every perk of a set either grants one more perk ('grant': the set stays) or merges the set
// into one perk ('merge': the set goes dormant and the merged perk replaces it). The linked perk lasts while the set
// is owned. src/ruleset/perkLinks.ts applies the table. A new link is one row; its perk is a write-up with place 'linked'.
import { PK } from './perkIds';
import { LK } from './tableIds';

export type PerkLink = { id: string; needs: string[]; kind: 'grant' | 'merge'; perk: string };
export const PERK_LINKS: PerkLink[] = [
  { id: LK.crushing_presence, needs: [PK.dread_presence, PK.overwhelm], kind: 'grant', perk: PK.crushing_presence },
  { id: LK.ghost_blade, needs: [PK.hidden_strike, PK.strike_and_fade], kind: 'grant', perk: PK.ghost_blade },
  { id: LK.combination, needs: [PK.set_them_up, PK.one_two], kind: 'grant', perk: PK.combination },
  { id: LK.blind_spot, needs: [PK.dirt_in_the_eyes, PK.melt_away], kind: 'grant', perk: PK.blind_spot },
  { id: LK.bulwark, needs: [PK.shield_wall, PK.cover_ally], kind: 'grant', perk: PK.bulwark },
];
