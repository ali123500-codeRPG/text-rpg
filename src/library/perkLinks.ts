// Linked perks: owning every perk of a set either grants one more perk ('grant': the set stays) or merges the set
// into one perk ('merge': the set goes dormant and the merged perk replaces it). The linked perk lasts while the set
// is owned. src/ruleset/perkLinks.ts applies the table. A new link is one row; its perk is a write-up with place 'linked'.
import { PK } from './perkIds';
import { LK } from './tableIds';

export type PerkLink = { id: string; needs: string[]; kind: 'grant' | 'merge'; perk: string };
export const PERK_LINKS: PerkLink[] = [
  { id: LK.crushing_presence, needs: [PK.dread_presence, PK.overwhelm], kind: 'grant', perk: PK.crushing_presence },
];
