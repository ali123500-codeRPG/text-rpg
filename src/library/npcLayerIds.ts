// NPC layer IDs (NG1, NG20): NPC roles (RO) and themes (TH) are library tables keyed by a fixed type prefix plus a number,
// never their names. Code refers to rows through RO and TH; data, saves and the Weaver's cast use the ID. Never reuse or
// renumber an ID. (Body-part roles keep RL; these are what an NPC does for a living.)
export const RO = {
  soldier: 'RO1', skirmisher: 'RO2', brute: 'RO3', shooter: 'RO4', sneak: 'RO5', watcher: 'RO6', talker: 'RO7', worker: 'RO8', beast: 'RO9', // RO10 (Child) retired: no children in the game
  hunter: 'RO11', healer: 'RO12', leader: 'RO13', knight: 'RO14', // NR4, NR6, NR8, NR13
  smith: 'RO15', // D-89 RP16: mends gear at a forge
} as const;
export const TH = { village_folk: 'TH1', town_watch: 'TH2', road_bandits: 'TH3', wild_beasts: 'TH4',
  town_folk: 'TH5', travellers: 'TH6', lords_household: 'TH7', monsters: 'TH8' } as const; // NR16
/** NR37: beast prefixes, a stronger or different kind of the same beast (shown in its name: a dire wolf) */
export const PF = { dire: 'PF1' } as const;
/** NR17: hook kinds, why a real person stands in a place (rosters by settlement size) */
export const HK = { leader: 'HK1', service: 'HK2', face: 'HK3', threat: 'HK4', rival: 'HK5', trader: 'HK6', watch: 'HK7', seat: 'HK8', warden: 'HK9' } as const;
/** NR27 (D-308): group recipes, cast as one entry and spawned as a leader and followers */
export const GP = { pedlar: 'GP1', traveller: 'GP2', caravan: 'GP3', pilgrims: 'GP4', bandit_gang: 'GP5', watch_patrol: 'GP6', watch_post: 'GP7',
  wolf_pack: 'GP8', boar: 'GP9', bear: 'GP10', hunter: 'GP11', dog: 'GP12', slimes: 'GP13' } as const;
