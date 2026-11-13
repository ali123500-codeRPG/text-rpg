// Essence IDs (growth proposal, EG1): every essence row's ID is fixed (type prefix ES + a number), never its name. Code refers
// to rows through ES; data and saves store the ID. Never reuse or renumber an ID.
export const ES = { gel_patience: 'ES1', gate_habit: 'ES2', street_instinct: 'ES3', hard_won_habit: 'ES4', haggler_ear: 'ES5', tavern_brawler: 'ES6' } as const;
