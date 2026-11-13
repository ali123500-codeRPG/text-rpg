// Personality line prototype: the names tables.
// Standalone: nothing in src/ imports this folder. When Ali is happy with the approach, these rows move into
// src/library (personalityAxes, values, personalityTypes) and src/scales.ts, and line.ts replaces personalityText.
// Every table is keyed; display words and hints live only here.

export const AXES = ['honesty', 'pride', 'temper', 'sociability', 'discipline', 'curiosity'] as const;
export type Axis = (typeof AXES)[number];
export type Axes = Record<Axis, number>;

/** the word and a short behaviour hint for each end of each axis */
export const AXIS_ENDS: Record<Axis, { low: [string, string]; high: [string, string] }> = {
  honesty: { low: ['deceitful', 'bends the truth when it suits them'], high: ['honest', 'says what they think, keeps their word'] },
  pride: { low: ['humble', 'plays themself down, lets others shine'], high: ['proud', 'rates themself above others and says so'] },
  temper: { low: ['patient', 'slow to anger, lets slights pass'], high: ['quick to anger', 'flares up fast when crossed'] },
  sociability: { low: ['quiet', 'keeps to themself, says little'], high: ['talkative', 'chatters, makes friends easily, fills silences'] },
  discipline: { low: ['impulsive', 'acts first, thinks later'], high: ['disciplined', 'keeps to plans and habits, finishes what they start'] },
  curiosity: { low: ['set in their ways', 'sticks to what they know, distrusts the new'], high: ['curious', 'wants to know how things work, asks and pokes'] },
};

/** strength words by |points|, highest first (TRAIT_WORDS) */
export const TRAIT_WORDS: [number, string][] = [[70, 'very '], [40, ''], [20, 'a bit ']];

/**
 * Archetypes: a whole-profile target on the six axes (missing axes are 0) and a hint.
 * The character's archetype is the row with the smallest average gap; ties go to the earlier row.
 * Targets are placeholders.
 */
export const ARCHETYPES: { key: string; name: string; target: Partial<Axes>; hint: string }[] = [
  { key: 'ordinary', name: 'Ordinary', target: {}, hint: 'an everyday sort, nothing to extremes' },
  { key: 'prideful', name: 'Prideful', target: { pride: 70, temper: 20 }, hint: 'won\'t back down in front of others, takes insults personally' },
  { key: 'mature', name: 'Mature', target: { discipline: 60, temper: -40, honesty: 20 }, hint: 'thinks before acting, keeps a cool head, owns their mistakes' },
  { key: 'childish', name: 'Childish', target: { discipline: -70, temper: 30, sociability: 40, curiosity: 40 }, hint: 'acts on impulse, sulks when crossed' },
  { key: 'honourable', name: 'Honourable', target: { honesty: 70, pride: 40, discipline: 30 }, hint: 'keeps their word and answers any insult to their name' },
  { key: 'schemer', name: 'Schemer', target: { honesty: -60, discipline: 50, temper: -20, sociability: 20 }, hint: 'plans ahead, lies patiently, uses people' },
  { key: 'bully', name: 'Bully', target: { pride: 60, temper: 60, honesty: -30, curiosity: -20 }, hint: 'picks on the weak, backs down from the strong' },
  { key: 'busybody', name: 'Busybody', target: { sociability: 60, curiosity: 60, discipline: -20 }, hint: 'pokes into other people\'s business and passes on what they learn' },
  { key: 'free_spirit', name: 'Free spirit', target: { discipline: -60, sociability: 50 }, hint: 'lives for the moment, laughs off trouble, hates being tied down' },
];

/** a "but" needs at least this many points on the axis, and this gap from the archetype's target */
export const BUT_MIN = 20;
export const BUT_GAP = 40;
export const BUTS_SHOWN = 3;

/** values, ranked by the character as drives; each has a hint */
export const VALUES: Record<string, string> = {
  duty: 'does what is expected of them, sees obligations through',
  wealth: 'wants money and fine things, counts the cost of everything',
  family: 'puts their own family first, protects and provides for them',
  faith: 'lives by their gods and their teachings',
  power: 'wants control over others and over events',
  freedom: 'hates being told what to do, chooses their own path',
  safety: 'avoids danger, wants things secure and settled',
  pleasure: 'lives for food, drink, fun and a good show',
  knowledge: 'studies, practises and seeks out learning',
  kindness: 'helps people in need, hates to see suffering',
  glory: 'wants great deeds and to be remembered for them',
  adventure: 'seeks out new places, thrills and challenges',
  reputation: 'cares what others think of them, guards their good name',
  humility: 'accepts their lot, asks for nothing, gives others the credit',
  nature: 'loves the wild, animals and growing things',
  justice: 'wants wrongs put right and the guilty punished',
  tolerance: 'accepts people who are different, hates prejudice',
  loyalty: 'stands by their friends and their own',
  courtesy: 'minds their manners, avoids giving offence',
  order: 'likes rules, routine and things in their place',
  propriety: 'keeps to what is proper for their place, and keeps private matters private',
  gratitude: 'repays kindness in kind or better, and offers to at once',
  desire: 'drawn to attractive people; notices them, flirts and chases romance',
};
export const DRIVES_SHOWN = 3;

/** Nerve: line from the nerve axis (lean 20), tier from raw Resolve; one hint per line */
export const NERVE_LEAN = 20;
export const NERVE_LINES: Record<'cautious' | 'steady' | 'daring', { tiers: string[]; hint: string }> = {
  cautious: { tiers: ['Skittish', 'Timid', 'Careful', 'Prudent', 'Cool-headed', 'Unflappable'], hint: 'keeps out of danger when they can' },
  steady: { tiers: ['Jittery', 'Settled', 'Steady', 'Stalwart', 'Unbreakable', 'Immovable'], hint: 'neither seeks nor flees danger' },
  daring: { tiers: ['Blustering', 'Brash', 'Spirited', 'Bold', 'Fearless', 'Death-defying'], hint: 'takes risks gladly' },
};
export const NERVE_TIER_FROM = [0, 20, 40, 60, 80, 100];
/** one "+" per this many Resolve past the top tier */
export const NERVE_PLUS_EVERY = 50;

/** what a tension row can test */
export interface Facts {
  nerveLine: 'cautious' | 'steady' | 'daring';
  resolve: number;
  axes: Axes;
  drives: string[];
  ageStage: 'child' | 'youth' | 'adult' | 'elder';
  /** best raw skill of any kind, best fighting skill, best skill that attacks */
  bestSkill: number;
  bestFight: number;
  bestAttack: number;
}

/** Tensions: two parts of a character that pull against each other. Shown in row order, at most TENSIONS_SHOWN. */
export const TENSIONS: { key: string; name: string; hint: string; when: (f: Facts) => boolean }[] = [
  { key: 'unshakeable_scatterbrained', name: 'unshakeable yet scatterbrained', hint: 'nothing frightens them, yet they can\'t keep to a plan',
    when: (f) => f.resolve >= 80 && f.axes.discipline <= -40 },
  { key: 'bold_unbacked', name: 'bold with nothing to back it', hint: 'laughs at danger, can\'t fight',
    when: (f) => f.nerveLine === 'daring' && f.bestFight < 20 },
  { key: 'old_head', name: 'old head on young shoulders', hint: 'talks and plans like a grown-up, though still a child',
    when: (f) => f.ageStage === 'child' && f.axes.discipline >= 40 },
  { key: 'wary_dangerous', name: 'wary but dangerous', hint: 'avoids danger, yet hits hard when pushed',
    when: (f) => f.nerveLine === 'cautious' && f.bestAttack >= 40 },
  { key: 'home_temptation', name: 'torn between home and temptation', hint: 'loves their own, yet can\'t resist a pretty face',
    when: (f) => f.drives.includes('desire') && (f.drives.includes('family') || f.drives.includes('loyalty')) },
  { key: 'talent_undisciplined', name: 'talent without discipline', hint: 'brilliant at their craft, careless at everything else',
    when: (f) => f.bestSkill >= 60 && f.axes.discipline <= -40 },
  { key: 'crooked_means', name: 'good ends, crooked means', hint: 'bends the truth to help the people they care about',
    when: (f) => f.axes.honesty <= -20 && (f.drives.includes('loyalty') || f.drives.includes('kindness')) },
];
export const TENSIONS_SHOWN = 2;
