// Copies the picked icons out of the icon packages (dev dependencies) into src/ui/iconArt.ts as plain SVG text, so the
// page carries only the icons it uses and makes no network calls (IC1-IC5). Pick an icon by "<set>:<name>":
//   gi = game-icons.net (CC BY 3.0, credited on the GM page), fe = Fluent Emoji High Contrast (MIT).
// "<set>:<name>@<viewBox>" keeps only the icon's first shape, framed by that viewBox (a figure without its sign's frame).
// Both draw filled silhouettes in currentColor. Browse them at https://icon-sets.iconify.design/ (game-icons,
// fluent-emoji-high-contrast). Run: npm run icons
import { readFileSync, writeFileSync } from 'node:fs';

const SETS = { gi: 'game-icons', fe: 'fluent-emoji-high-contrast' };
const PICKS = {
  // items, one per kind of thing (items sharing a type share an icon, IC3)
  sword: 'gi:broadsword', dagger: 'gi:plain-dagger', axe: 'gi:battle-axe', spear: 'gi:barbed-spear', bow: 'fe:bow-and-arrow',
  crossbow: 'gi:crossbow', club: 'gi:wood-club', shield: 'fe:shield', tunic: 'gi:shirt', leather: 'gi:leather-armor',
  mail: 'gi:chain-mail', plate: 'gi:breastplate', ring: 'fe:ring', charm: 'gi:clover',
  picks: 'gi:lockpicks', potion: 'gi:standing-potion', bandage: 'gi:bandage-roll', pouch: 'gi:pouch-with-beads',
  coin: 'gi:two-coins', key: 'gi:key', pack: 'gi:knapsack', sack: 'gi:swap-bag', chest: 'gi:locked-chest', crate: 'gi:wooden-crate',
  // classes (and the Starts that begin in them)
  swordsman: 'gi:swordman', late_bloomer: 'gi:sprout', sword_dancer: 'gi:sword-spin', commoner: 'gi:farmer', a_nobody: 'gi:hood', a_somebody: 'gi:shouting',
  trader: 'gi:trade', merchant: 'gi:shop', guard: 'fe:guard', threadbounded: 'gi:sewing-string', blessed: 'gi:holy-symbol',
  // marks
  against_nature: 'gi:cracked-mask', free_action: 'fe:high-voltage',
  tagged: 'gi:price-tag', flawed: 'gi:broken-pottery', locked: 'gi:padlock', damaged: 'gi:hammer-break',
  class_start: 'gi:sprout', class_next: 'gi:upgrade', class_any: 'gi:crossroad',
  // Play header toggles (SD7)
  agent: 'gi:robot-golem', rolls: 'gi:dice-twenty-faces-twenty', narration: 'gi:open-book', sound: 'gi:speaker', sound_off: 'gi:speaker-off',
  // the Character page's ratings, keyed as RT (src/library/functionIds.ts)
  melee_strength: 'gi:biceps', ranged_strength: 'gi:high-shot', toughness: 'gi:heart-armor', agility: 'gi:acrobatic',
  presence: 'gi:crown', senses: 'gi:eye-target',
  // skills that have no item or class icon to share (SKILL_ICON in src/ui/itemIcons.ts)
  sk_ranged_light: 'gi:pocket-bow', sk_strike: 'gi:punch', sk_grapple: 'gi:grab', sk_improvised: 'gi:broken-bottle', sk_slam: 'gi:fist',
  sk_dodge: 'gi:dodging', sk_endurance: 'gi:heart-plus', sk_eyesight: 'gi:eyeball', sk_earshot: 'gi:sound-waves',
  sk_sneaking: 'gi:footsteps', sk_combat_stealth: 'gi:backstab', sk_vanishing: 'gi:invisible', sk_persuasion: 'gi:conversation',
  sk_intimidation: 'gi:enrage', sk_riposte: 'gi:sword-clash', sk_tremor: 'gi:quake-stomp', sk_falsehood: 'gi:duality-mask',
  sk_insight: 'gi:third-eye', sk_shrewd_dealing: 'gi:shaking-hands', sk_resolve: 'gi:mountain-climbing', sk_parry: 'gi:crossed-swords',
  sk_filching: 'gi:robber-hand', sk_stamina: 'gi:lungs', sk_bite: 'gi:fangs', sk_claws: 'gi:claw-slashes', sk_hooves_horns: 'gi:bull-horns',
  sk_tail: 'gi:spiked-tail', sk_scent: 'gi:nose-side', sk_hide: 'gi:animal-hide', sk_healing: 'gi:healing', sk_battle_sense: 'gi:radar-sweep',
  sk_command: 'gi:rally-the-troops', sk_fieldcraft: 'gi:compass', sk_stratagem: 'gi:chess-knight', sk_guile: 'gi:fox-head',
  // the map's settlements, one per site size (MAP-71)
  hamlet: 'gi:house', village: 'gi:village', town: 'gi:medieval-gate',
  // what someone on the map is, when nothing they hold or wear stands out (MAP-69): a person, each kind of beast, a slime;
  // someone not made out
  person: 'gi:person', someone: 'gi:hooded-figure', slime: 'gi:slime', dog: 'gi:sitting-dog', wolf: 'gi:wolf-head',
  bear: 'gi:bear-head', boar: 'gi:boar', horse: 'gi:horse-head', big_cat: 'gi:tiger-head', lion: 'gi:lion', hyena: 'gi:hyena-head',
  lizard: 'gi:gecko', snake: 'gi:snake', spider: 'gi:angular-spider', dragon: 'gi:wyvern', beast: 'gi:paw',
  // a plain person by what is seen of them (MAP-69, RM15 c): a man or a woman (the sign figures without their frame), an elder
  man: 'fe:mens-room@4.5 4.5 23 23', woman: 'fe:womens-room@4.5 4.5 23 23', elder: 'fe:person-with-white-cane',
};

const sets = {};
const lines = Object.entries(PICKS).map(([name, spec]) => {
  const [pick, crop] = spec.split('@'), [set, id] = pick.split(':');
  const pack = (sets[set] ??= JSON.parse(readFileSync(`node_modules/@iconify-json/${SETS[set]}/icons.json`, 'utf8')));
  const icon = pack.icons[id];
  if (!icon) throw new Error(`no icon ${pick}`);
  const body = crop ? `<g fill="currentColor">${icon.body.match(/<path[^>]*\/>/)[0]}</g>` : icon.body;
  const svg = `<svg viewBox="${crop ?? `0 0 ${icon.width ?? pack.width ?? 16} ${icon.height ?? pack.height ?? 16}`}" aria-hidden="true">${body}</svg>`;
  return `  ${name}: ${JSON.stringify(svg)}, // ${spec}`;
});
writeFileSync('src/ui/iconArt.ts', `// Generated by scripts/icons.mjs (npm run icons): edit the picks there, not this file.
// Icons from game-icons.net by Lorc, Delapouite and contributors (CC BY 3.0, https://creativecommons.org/licenses/by/3.0/),
// and Fluent Emoji High Contrast by Microsoft (MIT). See src/ui/assets/icons-LICENSE.txt.
export const ICON_ART = {
${lines.join('\n')}
} as const;
export type IconName = keyof typeof ICON_ART;
`);
console.log(`src/ui/iconArt.ts: ${lines.length} icons`);
