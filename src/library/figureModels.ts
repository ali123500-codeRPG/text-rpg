// BV10 a, BV12 b, BV15 a: which 3D figure each race shows, and the credit its model asks for. A figure is a file
// assets/figures/<key>.json, baked by scripts/figures.mjs (npm run figures) from the model in assets/figures/models, or
// from the body type's built shape (key shape_<body type>) when the race has no model. Files load only when shown.
import { BT, RC } from './raceIds';

export type FigureCredit = { title: string; author: string; licence: 'CC0' | 'CC-BY 4.0'; url: string };

/** model key → where it came from (CC-BY asks for this credit wherever the model is shown; CC0 asks for none, kept anyway) */
export const FIGURE_CREDITS: Record<string, FigureCredit> = {
  human_man: { title: 'Universal Base Characters', author: 'Quaternius', licence: 'CC0', url: 'https://quaternius.com' },
  human_woman: { title: 'Emma – Stylized Adventure Character', author: 'Sunny', licence: 'CC-BY 4.0', url: 'https://sketchfab.com/3d-models/790391aec68649dab097e5b83d0351a4' },
  wolf: { title: 'Ultimate Animated Animals: Wolf', author: 'Quaternius', licence: 'CC0', url: 'https://quaternius.com' },
  horse: { title: 'Ultimate Animated Animals: Horse', author: 'Quaternius', licence: 'CC0', url: 'https://quaternius.com' },
  dog: { title: 'Shiba Inu', author: 'Quaternius', licence: 'CC0', url: 'https://poly.pizza/m/y4wdQpg767' },
  boar: { title: 'Free Animal Pack: Boar', author: 'Gobkit', licence: 'CC0', url: 'https://gobkit.itch.io' },
  bear: { title: 'Realistic Animated Bear 3D Model', author: 'WildMesh 3D', licence: 'CC-BY 4.0', url: 'https://sketchfab.com/3d-models/bffc3c87d2d148ff8533e1cc8a11c9f1' },
  tiger: { title: 'Running Tiger', author: 'Amil (francescolima74)', licence: 'CC-BY 4.0', url: 'https://sketchfab.com/3d-models/fc2c7fd74dd04e39935803b884c77258' },
  lion: { title: 'Lion', author: 'doizy', licence: 'CC-BY 4.0', url: 'https://sketchfab.com/3d-models/79d5e1173bba4f2b80661620a2eca9bc' },
  leopard: { title: 'Leopard Animation Run', author: 'GremorySaiyan', licence: 'CC-BY 4.0', url: 'https://sketchfab.com/3d-models/5a36868106f843d4a24d87334f1550fe' },
  hyena: { title: 'Hyena', author: 'SleepyPineapple', licence: 'CC-BY 4.0', url: 'https://sketchfab.com/3d-models/86cdfbb9f1b74d01ab338d5fb3e13dab' },
  lizard: { title: 'Komodo', author: 'denys4624', licence: 'CC-BY 4.0', url: 'https://sketchfab.com/3d-models/a3bb3a390dd1466e9bbab4a994329d45' },
  crocodile: { title: 'Crocodile', author: 'rafaelrafi', licence: 'CC-BY 4.0', url: 'https://sketchfab.com/3d-models/2b7c0624091a4e7793e7b4748a61795c' },
  python: { title: 'Ball python', author: 'bluekiwi.dog', licence: 'CC-BY 4.0', url: 'https://sketchfab.com/3d-models/74166573c34c40bc977c7a8db5b92ff4' },
  spider: { title: 'Black giant spider', author: 'Josean_3dev', licence: 'CC-BY 4.0', url: 'https://sketchfab.com/3d-models/5ce2a6c5b4ba4b848bdbf915e65916cd' },
  dragon: { title: 'Low Poly Dragon (Rigged)', author: 'Yanez Designs', licence: 'CC-BY 4.0', url: 'https://sketchfab.com/3d-models/c23530e89e8e4f21b0682860c9b2235b' },
};

/** race → its model key; a race with men's and women's models picks by pronouns (she: woman; he or they: man) */
const RACE_MODEL: Record<string, string | { man: string; woman: string }> = {
  [RC.human]: { man: 'human_man', woman: 'human_woman' },
  [RC.elf]: { man: 'human_man', woman: 'human_woman' }, // no elf model yet: an elf is a human's size (SZ3)
  [RC.dog]: 'dog', [RC.wolf]: 'wolf', [RC.tiger]: 'tiger', [RC.bear]: 'bear', [RC.boar]: 'boar', [RC.horse]: 'horse',
  [RC.lizard]: 'lizard', [RC.python]: 'python', [RC.spider]: 'spider', [RC.lion]: 'lion', [RC.leopard]: 'leopard',
  [RC.hyena]: 'hyena', [RC.crocodile]: 'crocodile', [RC.dragon]: 'dragon',
  // RC.slime: its model's eyes were sculpted into it, so it shows the Amorphous built shape
};
/** body type → its built shape's key (a story body type falls back to the Humanoid's) */
const SHAPE: Record<string, string> = Object.fromEntries(Object.entries(BT).map(([name, id]) => [id, `shape_${name}`]));

/** the figure file a being shows: its race's model, else its body type's built shape */
export function figureKey(raceId: string | undefined, bodyTypeId: string, pronouns?: string): string {
  const m = raceId ? RACE_MODEL[raceId] : undefined;
  if (typeof m === 'string') return m;
  if (m) return pronouns === 'she' ? m.woman : m.man;
  return SHAPE[bodyTypeId] ?? SHAPE[BT.humanoid];
}
/** every figure file the game can load (the build copies these; a test checks each exists) */
export const FIGURE_KEYS: readonly string[] = [...new Set([...Object.keys(FIGURE_CREDITS), ...Object.values(SHAPE)])];
/** an upright figure (a person, or the Humanoid's built shape): faces the viewer and is sized by its height */
export const figureUpright = (key: string): boolean => key.startsWith('human_') || key === `shape_humanoid`;
