// NPC layer IDs (NG1, NG20): NPC roles (RO) and themes (TH) are library tables keyed by a fixed type prefix plus a number,
// never their names. Code refers to rows through RO and TH; data, saves and the Weaver's cast use the ID. Never reuse or
// renumber an ID. (Body-part roles keep RL; these are what an NPC does for a living.)
export const RO = {
  soldier: 'RO1', skirmisher: 'RO2', brute: 'RO3', shooter: 'RO4', sneak: 'RO5', watcher: 'RO6', talker: 'RO7', worker: 'RO8', beast: 'RO9',
} as const;
export const TH = { village_folk: 'TH1', town_watch: 'TH2', road_bandits: 'TH3', wild_beasts: 'TH4' } as const;
