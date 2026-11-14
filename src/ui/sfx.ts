// The game's sound files (AU9, AU11): Kenney's public-domain (CC0) Interface Sounds, Impact Sounds and RPG Audio packs,
// trimmed and made mono MP3. Each key lists its variants; one is picked at random. `gain` balances them against each other
// (placeholders; the viewer's own volume slider sits on top). Sources and licence: assets/sfx/LICENSE.txt.
// `licensed`: BBC Sound Effects (personal use) and Sonniss files may not go in this public repository (AU12 a). They sit in
// the project files (audio/licensed/README.md) and are uploaded only to the private play page at these paths; where one is
// missing, the key falls back to its own files (or, with none, to a code-made sound in sound.ts).
import click from './assets/sfx/click.mp3';
import parry0 from './assets/sfx/parry_0.mp3';
import parry1 from './assets/sfx/parry_1.mp3';
import parry2 from './assets/sfx/parry_2.mp3';
import block0 from './assets/sfx/block_0.mp3';
import block1 from './assets/sfx/block_1.mp3';
import block2 from './assets/sfx/block_2.mp3';
import graze0 from './assets/sfx/graze_0.mp3';
import graze1 from './assets/sfx/graze_1.mp3';
import hit0 from './assets/sfx/hit_0.mp3';
import hit1 from './assets/sfx/hit_1.mp3';
import hit2 from './assets/sfx/hit_2.mp3';
import heavy0 from './assets/sfx/heavy_0.mp3';
import heavy1 from './assets/sfx/heavy_1.mp3';
import heavy2 from './assets/sfx/heavy_2.mp3';
import plate0 from './assets/sfx/plate_0.mp3';
import plate1 from './assets/sfx/plate_1.mp3';
import plate2 from './assets/sfx/plate_2.mp3';
import hurt0 from './assets/sfx/hurt_0.mp3';
import hurt1 from './assets/sfx/hurt_1.mp3';
import hurt2 from './assets/sfx/hurt_2.mp3';
import scenarioEnd from './assets/sfx/scenario_end.mp3';

export type SoundFile = { urls: string[]; licensed?: string[]; gain: number };
const FILES = {
  click: { urls: [click], gain: 0.35 }, // any clickable (Interface Sounds click_002)
  parry: { urls: [parry0, parry1, parry2], gain: 0.8 }, // steel turned aside (impact_metal_light)
  block: { urls: [block0, block1, block2], gain: 0.8 }, // taken on a shield (impact_wood_medium)
  graze: { urls: [graze0, graze1], gain: 0.7 }, // a blade that only grazed (knife_slice)
  hit: { urls: [hit0, hit1, hit2], gain: 0.8 }, // a full hit (impact_punch_medium)
  heavy: { urls: [heavy0, heavy1, heavy2], gain: 0.9 }, // a heavy hit (impact_punch_heavy)
  crush: { urls: [plate0, plate1, plate2], gain: 0.7 }, // laid over a heavy hit for a crushing one (impact_plate_heavy)
  hurt: { urls: [hurt0, hurt1, hurt2], gain: 0.9 }, // a blow landing on the player (impact_soft_heavy)
  // the scenario end (AU9: BBC's gong; Kenney's heavy bell where it is missing)
  scenario_end: { urls: [scenarioEnd], licensed: ['sfx/scenario_end.mp3'], gain: 0.6 },
  // the death scene (AU9: BBC's groan and body fall; a code-made falling tone where it is missing)
  death: { urls: [], licensed: ['sfx/death.mp3'], gain: 0.8 },
} satisfies Record<string, SoundFile>;
export type SoundKey = keyof typeof FILES;
export const SOUND_FILES: Record<SoundKey, SoundFile> = FILES;
