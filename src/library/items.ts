// Items, their kit and weapon modes, gear types and item families (Part 5). prototypeLibrary() in data.ts reads them
// from here.
import { AM, DU, GC, GT, HL, IF } from './tableIds';
import { TR } from './treeIds';
import { CONFIG } from '../config';
import type { ArmorWeightKey } from '../scales';
import { armReachM, HUMANOID_SIZE } from './bodySize';
import type { AttackMode, ItemDef, ItemEffect } from '../types';
import { ROLLED_SKILL, SK } from './skillIds';
import { ACH } from './achievementIds';
import { FN } from './functionIds';
import { PK } from './perkIds';
import { BREAK_TOOL_TAG, CRUDE_KIT_TAG, IT } from './itemIds';
import { armorMultiplier, armorStop, shieldPool } from './gearScale';

/** SZ8: what a standard Humanoid's arm reaches past its body (0.625 m); a held weapon's library reach is this plus its length */
const STD_ARM_M = armReachM(HUMANOID_SIZE);
/** SZ8: a mode wielded in a grip: its own length past the hand; its library reach is the standard Humanoid's */
export const held = (lengthM: number) => ({ lengthM, reachM: STD_ARM_M + lengthM, reach: STD_ARM_M + lengthM });
/** a humanoid's fists: as far as the arm (SZ8); also the bare-hands mode of a body with no natural attacks (ruleset/gear UNARMED_MODE) */
export const FISTS: AttackMode = { id: AM.punch, tree: 'unarmed', class: 'punch', skill: SK.unarmed_strike, ...held(0), grips: 0, name: 'fists' };
/** a weapon mode; a typed piece's non-thrown modes take their reach from its gear type (typed below), so they state none */
const mode = (m: Partial<import('../types').AttackMode> & Pick<import('../types').AttackMode, 'id' | 'tree' | 'class' | 'grips'>) => ({ ...m, ...(m.reachM === undefined ? {} : { reach: m.reachM }) });
/** IR23: gear types. A melee type has its length past the hand (SZ8: it reaches the wielder's arm plus that; a standard
 * person's arm is 0.625 m, so a dagger reaches 0.925 m); a bow's or crossbow's reach is its effective range against a man,
 * not its longest shot; armor covers the parts its real garment covers most of (IR8). Every piece of the type takes the
 * type's number (pieces round to it). Thrown range stays CONFIG.THROW_M. */
export const GEAR_TYPES: Record<string, { id: string; name: string; reachM?: number; lengthM?: number; covers?: string[] }> = Object.fromEntries(([
  [GT.knife, 'Knife', { lengthM: 0.3 }], // dagger: a 30 cm blade
  [GT.short, 'Short', { lengthM: 0.6 }], // short sword, hand axe, cudgel
  [GT.sword, 'Sword', { lengthM: 0.9 }], // arming sword; longsword blade 80-110 cm (Wikipedia "Longsword"), rapier 104 cm (Wikipedia "Rapier")
  [GT.great, 'Great', { lengthM: 1.6 }], // two-handed greatsword and greataxe
  [GT.pole, 'Pole', { lengthM: 2.1 }], // spear
  [GT.short_bow, 'Short bow', 50], [GT.flatbow, 'Flatbow', 60], [GT.recurve, 'Recurve', 70], [GT.longbow, 'Longbow', 90],
  [GT.warbow, 'Warbow', 150], // Mary Rose bows; Barnabe Rich: 200 paces (153 m) for most archers (Wikipedia "English longbow")
  [GT.crossbow_light, 'Light crossbow', 60], [GT.crossbow_stirrup, 'Stirrup crossbow', 70], [GT.crossbow_heavy, 'Heavy crossbow', 80],
  [GT.cuirass, 'Cuirass', ['general']], // a torso garment (Wikipedia "Cuirass", "Brigandine", "Jack of plate")
  [GT.coat, 'Coat', ['general', 'left_arm', 'right_arm']], // sleeved: gambeson, hauberk (Wikipedia "Gambeson", "Hauberk")
  [GT.half_suit, 'Half suit', ['general', 'left_arm', 'right_arm', 'left_leg', 'right_leg']], // breastplate with arm and leg plates
  [GT.full_harness, 'Full harness', ['general', 'left_arm', 'right_arm', 'left_leg', 'right_leg', 'head', 'neck']], // a full harness came with its helmet (Wikipedia "Plate armour")
  [GT.helmet, 'Helmet', ['head']], [GT.helmet_neck, 'Helmet with neck', ['head', 'neck']],
  [GT.fist, 'Fist', { lengthM: 0 }], // gauntlets: a punch reaches as far as the arm
] as [string, string, number | string[] | { lengthM: number }][]).map(([id, name, v]) => [id, { id, name, ...(Array.isArray(v) ? { covers: v } : typeof v === 'number' ? { reachM: v } : v) }]));
/** IR30-IR33: item families. A Mundane piece takes every number from its level, class and type (IR31); a special family
 * stands on a Mundane base and adds its own extras, grown its own way (IR33). Relics are parked (D-167). */
export const ITEM_FAMILIES: Record<string, { id: string; name: string; rule: string }> = Object.fromEntries(([
  [IF.mundane, 'Mundane', 'Every number comes from its level (need) through one factor each, plus its gear class and gear type; nothing is set by hand. A minted piece stays Mundane: its quality adds factor × need × quality.'],
  [IF.threadbound, 'Threadbound', 'One of a kind, bound to its owner; its abilities open through achievements and grow by its Rank.'],
  [IF.relic, 'Relic', 'A unique piece that is not Threadbound (parked, D-167).'],
] as [string, string, string][]).map(([id, name, rule]) => [id, { id, name, rule }]));
/** IR30: the family of an equipment piece: Threadbound if it is one, else Mundane for any piece with an equipment level */
const familyOf = (d: ItemDef): string | undefined => d.family ?? (d.threadbound ? IF.threadbound : d.level ? IF.mundane : undefined);
/** IR23: fill a typed piece's reach (non-thrown modes) and coverage from its gear type; IR30: name its family */
function typed(d: ItemDef): ItemDef {
  const f = familyOf(d);
  if (f) d.family = f;
  const t = d.gearType ? GEAR_TYPES[d.gearType] : undefined;
  if (!t) return d;
  if (d.weapon && t.reachM !== undefined) d.weapon.modes = d.weapon.modes.map((m) => (m.thrown ? m : { ...m, reachM: t.reachM!, reach: t.reachM! }));
  if (d.weapon && t.lengthM !== undefined) d.weapon.modes = d.weapon.modes.map((m) => (m.thrown ? m : { ...m, ...held(t.lengthM!) }));
  if (d.armor && t.covers) d.armor = { ...d.armor, covers: [...t.covers] };
  return d;
}
const KIT = (skill = '$mode'): ItemEffect => ({ kind: 'skill', skill, value: 25, active: 'held', scope: 'withItem', kit: true });
/** Improvised weapons: a melee strike and a throw (like throwing a vase), both rolled with
 * Improvisation. Unarmed skills stand in for both (its own function); Arms skills also stand in for the strike,
 * Ranged skills for the throw. */
const IMPROVISED_MODES = (cls: 'light' | 'medium' | 'heavy', grips: 1 | 2) => [
  mode({ id: AM.strike, tree: 'melee', class: cls, skill: SK.unarmed_improvised, ...held(0.5), grips, hitAdj: CONFIG.IMPROVISED_HIT_ADJ, standInFns: [FN.arms] }),
  mode({ id: AM.throw, tree: 'ranged', class: cls, skill: SK.unarmed_improvised, reachM: CONFIG.THROW_M.improvised, grips, thrown: true, hitAdj: CONFIG.IMPROVISED_HIT_ADJ, standInFns: [FN.ranged] }),
];
/** QE4/QE5, D-368: armor stops ARMOR_FACTOR × need × ARMOR_WEIGHT_SOAK[weight]; a shield's pool is POOL_BASE + POOL_FACTOR × need (gear stats scale with need);
 * a Crude piece (need 0) stops nothing: its multiplier is 1 */
const ARMOR = (w: ArmorWeightKey, level: string) => ({ reduction: armorStop(w, CONFIG.EQUIP_NEED[level]), multiplier: armorMultiplier(w, CONFIG.EQUIP_NEED[level]), weight: w });
const POOL = (level: string) => ({ pool: shieldPool(CONFIG.EQUIP_NEED[level]) });
/** LG23 a: worn armor's cost to Dodge and Parry alike, sized by the piece's weight and need (ruleset/gear effectValue) */
const WEIGHT = (): ItemEffect[] => [SK.dodge, SK.parry].map((skill) => ({ kind: 'skill', skill, value: 0, active: 'worn', scope: 'any', armorWeight: true }));
/** AX1/AX2: an accessory's skill bonus while worn, sized by the item's equipment level (ruleset/gear effectValue) */
const ACC = (skill: string): ItemEffect => ({ kind: 'skill', skill, value: 0, active: 'worn', scope: 'any', byLevel: true });
/** AX4 c: a charmed ring's skill weights by tree (placeholders): fighting and senses most, other common trees next, the rest 1 */
const RING_WEIGHTS: Record<string, number> = { [TR.melee]: 3, [TR.ranged]: 3, [TR.unarmed]: 3, [TR.defense]: 3, [TR.perception]: 3,
  [TR.fortitude]: 2, [TR.armor]: 2, [TR.stealth]: 2, [TR.speech]: 2, [TR.trickery]: 2 };

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(([
  { id: IT.dagger, edge: true, level: 'common', gearClass: GC.melee_light, gearType: GT.knife, tags: ['starter'], kind: 'weapon', name: 'dagger', look: 'a plain dagger', bulk: 1, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.slash, tree: 'melee', class: 'light', grips: 1 }), mode({ id: AM.throw, tree: 'ranged', class: 'light', reachM: CONFIG.THROW_M.knife, grips: 1, thrown: true })] } },
  { id: IT.arming_sword, edge: true, level: 'fine', gearClass: GC.melee_medium, gearType: GT.sword, tags: ['starter'], kind: 'weapon', name: 'arming sword', look: 'a straight arming sword', bulk: 2, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.cut, tree: 'melee', class: 'medium', grips: 1 })] } },
  { id: IT.greataxe, edge: true, level: 'superior', gearClass: GC.melee_heavy, gearType: GT.great, kind: 'weapon', name: 'greataxe', look: 'a heavy two-handed axe', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.chop, tree: 'melee', class: 'heavy', grips: 2 })] } },
  // IC4, IC6 a: two spears. The spear thrusts and throws in one grip, so it can go beside a shield; the war spear takes both grips, not thrown
  { id: IT.spear, level: 'fine', gearClass: GC.melee_medium, gearType: GT.pole, tags: ['starter'], kind: 'weapon', name: 'spear', look: 'an ash-shafted spear', bulk: 3, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.thrust, tree: 'melee', class: 'medium', grips: 1 }), mode({ id: AM.throw, tree: 'ranged', class: 'medium', reachM: CONFIG.THROW_M.spear, grips: 1, thrown: true })] } },
  { id: IT.war_spear, level: 'common', gearClass: GC.melee_heavy, gearType: GT.pole, kind: 'weapon', name: 'war spear', look: 'a long, heavy-headed spear for both hands', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.thrust, tree: 'melee', class: 'heavy', grips: 2 })] } },
  { id: IT.shortbow, level: 'common', gearClass: GC.ranged_light, gearType: GT.short_bow, tags: ['starter'], kind: 'weapon', shotTime: DU.bow_light, name: 'shortbow', look: 'a short hunting bow', bulk: 2, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'light', grips: 2 })] } },
  { id: IT.longbow, level: 'fine', gearClass: GC.ranged_medium, gearType: GT.longbow, tags: ['starter'], kind: 'weapon', shotTime: DU.bow_medium, name: 'longbow', look: 'a tall longbow', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'medium', grips: 2 })] } },
  { id: IT.crossbow, level: 'superior', gearClass: GC.ranged_heavy, gearType: GT.crossbow_heavy, kind: 'weapon', shotTime: DU.crossbow_shot, spanTime: DU.span_crossbow, name: 'crossbow', look: 'a heavy crossbow', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'heavy', grips: 2 })] } },
  { id: IT.basket_hilt_sword, edge: true, level: 'fine', gearClass: GC.melee_medium, gearType: GT.sword, kind: 'weapon', name: 'basket-hilted sword', look: 'a sword with a caged steel hilt', bulk: 2, grips: 1,
    effects: [KIT()], // IR31: Mundane, so no hand-set Parry bonus
    weapon: { modes: [mode({ id: AM.cut, tree: 'melee', class: 'medium', grips: 1 })] } },
  { id: IT.hidden_blade, edge: true, level: 'fine', gearClass: GC.melee_light, gearType: GT.knife, kind: 'weapon', name: 'hidden blade', look: 'a slim blade', bulk: 1, grips: 1, concealed: true, hiddenAt: 'great_success', // SE9 placeholder
    effects: [KIT()],
    weapon: { modes: [mode({ id: AM.stab, tree: 'melee', class: 'light', grips: 1 })] } },
  // IR8: an armor piece covers a body part when its real garment covers most of it, with the source on the row
  // Crude gear: level Crude needs 0, stops nothing and costs no Dodge (placeholders). The clothes are in everyone's
  // starter kit; every other Crude piece (CRUDE_KIT_TAG) comes only for a skill the build put points in (starterKit).
  { id: IT.crude_clothes, level: 'crude', gearClass: GC.armor_light, gearType: GT.cuirass, tags: ['starter'], kind: 'armor', name: 'rough clothes', look: 'rough homespun clothes', bulk: 1, slot: 'armor',
    armor: ARMOR('light', 'crude') },
  { id: IT.cudgel, level: 'crude', gearClass: GC.melee_medium, gearType: GT.short, tags: [CRUDE_KIT_TAG], kind: 'weapon', name: 'cudgel', look: 'a knotted wooden cudgel', bulk: 2, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.club, tree: 'melee', class: 'medium', grips: 1 })] } },
  { id: IT.rusty_knife, edge: true, level: 'crude', gearClass: GC.melee_light, gearType: GT.knife, tags: [CRUDE_KIT_TAG], kind: 'weapon', name: 'rusty knife', look: 'a rusty knife', bulk: 1, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.slash, tree: 'melee', class: 'light', grips: 1 })] } },
  // CG4: one Crude piece for each gear class that had none (Improvised is exempt, as from the starter kit)
  { id: IT.splitting_maul, level: 'crude', gearClass: GC.melee_heavy, gearType: GT.great, tags: [CRUDE_KIT_TAG], kind: 'weapon', name: 'splitting maul', look: 'a heavy wood-splitting maul', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.club, tree: 'melee', class: 'heavy', grips: 2 })] } },
  { id: IT.stick_bow, level: 'crude', gearClass: GC.ranged_light, gearType: GT.short_bow, tags: [CRUDE_KIT_TAG], kind: 'weapon', shotTime: DU.bow_light, name: 'stick bow', look: 'a rough-cut stick bow', bulk: 2, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'light', grips: 2 })] } },
  { id: IT.green_wood_bow, level: 'crude', gearClass: GC.ranged_medium, gearType: GT.flatbow, tags: [CRUDE_KIT_TAG], kind: 'weapon', shotTime: DU.bow_medium, name: 'green-wood bow', look: 'a bow of unseasoned green wood', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'medium', grips: 2 })] } },
  { id: IT.rickety_crossbow, level: 'crude', gearClass: GC.ranged_heavy, gearType: GT.crossbow_light, tags: [CRUDE_KIT_TAG], kind: 'weapon', shotTime: DU.crossbow_shot, spanTime: DU.span_light, name: 'rickety crossbow', look: 'a rickety, much-mended crossbow', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'heavy', grips: 2 })] } },
  { id: IT.patched_mail, level: 'crude', gearClass: GC.armor_medium, gearType: GT.cuirass, tags: [CRUDE_KIT_TAG], kind: 'armor', name: 'patched mail shirt', look: 'a mail shirt patched with mismatched rings', bulk: 3, slot: 'armor',
    armor: ARMOR('medium', 'crude') },
  { id: IT.rusted_scale_coat, level: 'crude', gearClass: GC.armor_heavy, gearType: GT.coat, tags: [CRUDE_KIT_TAG], kind: 'armor', name: 'rusted scale coat', look: 'a coat of rusted, missing scales', bulk: 3, slot: 'armor',
    armor: ARMOR('heavy', 'crude') },
  { id: IT.plank_shield, level: 'crude', gearClass: GC.shield, tags: [CRUDE_KIT_TAG], kind: 'shield', name: 'plank shield', look: 'a shield of nailed planks', bulk: 2, grips: 1, effects: [KIT(SK.block)], shield: POOL('crude') },
  { id: IT.rag_wraps, level: 'crude', gearClass: GC.gauntlets, gearType: GT.fist, tags: [CRUDE_KIT_TAG], kind: 'weapon', name: 'rag hand wraps', look: 'rags wound tight round the hands', bulk: 1, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.punch, tree: 'unarmed', class: 'punch', skill: SK.unarmed_strike, grips: 1 })] } },
  { id: IT.gambeson, level: 'common', gearClass: GC.armor_light, gearType: GT.coat, tags: ['starter'], kind: 'armor', name: 'gambeson', look: 'a quilted gambeson', bulk: 2, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('light', 'common') } }, // IR8: a padded, sleeved jacket to the hips or thigh (Wikipedia "Gambeson")
  { id: IT.mail_hauberk, level: 'fine', gearClass: GC.armor_medium, gearType: GT.coat, tags: ['starter'], kind: 'armor', name: 'mail hauberk', look: 'a mail hauberk', bulk: 3, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('medium', 'fine') } }, // IR8: a sleeved mail shirt to mid-thigh (Wikipedia "Hauberk")
  { id: IT.plate_harness, level: 'superior', gearClass: GC.armor_heavy, gearType: GT.full_harness, kind: 'armor', name: 'plate harness', look: 'a full plate harness', bulk: 3, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('heavy', 'superior') } },
  { id: IT.round_shield, level: 'common', gearClass: GC.shield, tags: ['starter'], kind: 'shield', name: 'round shield', look: 'a painted round shield', bulk: 2, grips: 1, effects: [KIT(SK.block)], shield: POOL('common') },
  // Starter pairs: every gear class but improvised has a Common (need 25) and a Fine (need 50) starter piece;
  // creation gives the highest one met per class (starterKit). Superior and Masterwork gear stays out of the kit.
  { id: IT.short_sword, edge: true, level: 'fine', gearClass: GC.melee_light, gearType: GT.short, tags: ['starter'], kind: 'weapon', name: 'short sword', look: 'a short, broad-bladed sword', bulk: 1, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.stab, tree: 'melee', class: 'light', grips: 1 })] } },
  { id: IT.hand_axe, edge: true, level: 'common', gearClass: GC.melee_medium, gearType: GT.short, tags: ['starter'], kind: 'weapon', name: 'hand axe', look: 'a bearded hand axe', bulk: 2, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.chop, tree: 'melee', class: 'medium', grips: 1 })] } },
  { id: IT.woodsman_axe, edge: true, level: 'common', gearClass: GC.melee_heavy, gearType: GT.sword, tags: ['starter'], kind: 'weapon', name: "woodsman's axe", look: 'a long-hafted felling axe', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.chop, tree: 'melee', class: 'heavy', grips: 2 })] } },
  { id: IT.greatsword, edge: true, level: 'fine', gearClass: GC.melee_heavy, gearType: GT.great, tags: ['starter'], kind: 'weapon', name: 'greatsword', look: 'a two-handed sword', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.cut, tree: 'melee', class: 'heavy', grips: 2 })] } },
  { id: IT.recurve_bow, level: 'fine', gearClass: GC.ranged_light, gearType: GT.recurve, tags: ['starter'], kind: 'weapon', shotTime: DU.bow_light, name: 'recurve bow', look: 'a horn-backed recurve bow', bulk: 2, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'light', grips: 2 })] } },
  { id: IT.flatbow, level: 'common', gearClass: GC.ranged_medium, gearType: GT.flatbow, tags: ['starter'], kind: 'weapon', shotTime: DU.bow_medium, name: 'flatbow', look: 'a plain flat-limbed bow', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'medium', grips: 2 })] } },
  { id: IT.light_crossbow, level: 'common', gearClass: GC.ranged_heavy, gearType: GT.crossbow_light, tags: ['starter'], kind: 'weapon', shotTime: DU.crossbow_shot, spanTime: DU.span_light, name: 'light crossbow', look: 'a light crossbow', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'heavy', grips: 2 })] } },
  { id: IT.stirrup_crossbow, level: 'fine', gearClass: GC.ranged_heavy, gearType: GT.crossbow_stirrup, tags: ['starter'], kind: 'weapon', shotTime: DU.crossbow_shot, spanTime: DU.span_stirrup, name: 'stirrup crossbow', look: 'a crossbow with a foot stirrup', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'heavy', grips: 2 })] } },
  { id: IT.boiled_leather, level: 'fine', gearClass: GC.armor_light, gearType: GT.cuirass, tags: ['starter'], kind: 'armor', name: 'boiled leather', look: 'a cuirass of hardened leather', bulk: 2, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('light', 'fine') } }, // IR8: a cuirass guards the torso only (Wikipedia "Cuirass")
  { id: IT.brigandine, level: 'common', gearClass: GC.armor_medium, gearType: GT.cuirass, tags: ['starter'], kind: 'armor', name: 'brigandine', look: 'a riveted brigandine', bulk: 3, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('medium', 'common') } }, // IR8: a plated cloth garment over the torso (Wikipedia "Brigandine")
  { id: IT.lamellar_coat, level: 'common', gearClass: GC.armor_heavy, gearType: GT.coat, tags: ['starter'], kind: 'armor', name: 'lamellar coat', look: 'a coat of laced lamellar plates', bulk: 3, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('heavy', 'common') } }, // IR8: a laced-plate coat with shoulder and upper-arm guards; its skirt covers the thigh, not most of the leg (Wikipedia "Lamellar armour")
  { id: IT.half_plate, level: 'fine', gearClass: GC.armor_heavy, gearType: GT.half_suit, tags: ['starter'], kind: 'armor', name: 'half plate', look: 'a breastplate with arm and leg plates', bulk: 3, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('heavy', 'fine') } }, // IR8: breastplate with arm and leg plates, as its look says
  { id: IT.kite_shield, level: 'fine', gearClass: GC.shield, tags: ['starter'], kind: 'shield', name: 'kite shield', look: 'a tall kite shield', bulk: 3, grips: 1, effects: [KIT(SK.block)], shield: POOL('fine') },
  // IR2 Superior (need 75): the best real pieces. Reach is the blade plus a 0.7 m arm, as the dagger's 1.0 m is.
  { id: IT.rapier, edge: true, level: 'superior', gearClass: GC.melee_light, gearType: GT.sword, kind: 'weapon', name: 'rapier', look: 'a long, slender rapier with a swept hilt', bulk: 2, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.stab, tree: 'melee', class: 'light', grips: 1 })] } }, // blade 104 cm on average, one-handed (Wikipedia "Rapier")
  { id: IT.longsword, edge: true, level: 'superior', gearClass: GC.melee_medium, gearType: GT.sword, kind: 'weapon', name: 'longsword', look: 'a long, two-handed sword with a cruciform hilt', bulk: 2, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.cut, tree: 'melee', class: 'medium', grips: 2 })] } }, // blade 80-110 cm, mostly two-handed (Wikipedia "Longsword")
  { id: IT.turkish_bow, level: 'superior', gearClass: GC.ranged_light, gearType: GT.recurve, kind: 'weapon', shotTime: DU.bow_light, name: 'Turkish composite bow', look: 'a short, sharply recurved bow of horn, wood and sinew', bulk: 2, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'light', grips: 2 })] } }, // placeholder: no war range given; its flight records (434 m) pass the English bows' (315 m Finsbury mark) (Wikipedia "Turkish archery", "English longbow")
  { id: IT.warbow, level: 'superior', gearClass: GC.ranged_medium, gearType: GT.warbow, kind: 'weapon', shotTime: DU.bow_medium, name: 'warbow', look: 'a tall yew warbow of enormous draw', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'medium', grips: 2 })] } }, // Mary Rose bows, 100-185 lbf; Barnabe Rich: 200 paces (153 m) for most archers (Wikipedia "English longbow")
  { id: IT.jack_of_plates, level: 'superior', gearClass: GC.armor_light, gearType: GT.cuirass, kind: 'armor', name: 'jack of plates', look: 'a canvas jack quilted over small iron plates', bulk: 2, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('light', 'superior') } }, // IR8: iron squares sewn between canvas, about 7.7 kg, a torso garment (Wikipedia "Jack of plate")
  { id: IT.coat_of_plates, level: 'superior', gearClass: GC.armor_medium, gearType: GT.coat, kind: 'armor', name: 'coat of plates with mail', look: 'a riveted coat of plates over a sleeved mail shirt', bulk: 3, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('medium', 'superior') } }, // IR8: plates over the torso, worn with mail (Wikipedia "Coat of plates"); the mail's sleeves cover the arms (Wikipedia "Hauberk")
  { id: IT.heater_shield, level: 'superior', gearClass: GC.shield, kind: 'shield', name: 'heater shield', look: 'a flat-topped heater shield', bulk: 2, grips: 1, effects: [KIT(SK.block)], shield: POOL('superior') }, // smaller and lighter than the kite shield (Wikipedia "Heater shield")
  // IR2 Masterwork (need 100): made past any real smith, so tagged 'fantasy'. Each keeps its real form's reach and coverage;
  // only its level makes it stronger. Names are placeholders.
  { id: IT.peerless_rapier, edge: true, level: 'masterwork', gearClass: GC.melee_light, gearType: GT.sword, tags: ['fantasy'], kind: 'weapon', name: 'peerless rapier', look: 'a rapier of impossible craft', bulk: 2, grips: 1, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.stab, tree: 'melee', class: 'light', grips: 1 })] } },
  { id: IT.peerless_longsword, edge: true, level: 'masterwork', gearClass: GC.melee_medium, gearType: GT.sword, tags: ['fantasy'], kind: 'weapon', name: 'peerless longsword', look: 'a longsword of impossible craft', bulk: 2, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.cut, tree: 'melee', class: 'medium', grips: 2 })] } },
  { id: IT.peerless_greatsword, edge: true, level: 'masterwork', gearClass: GC.melee_heavy, gearType: GT.great, tags: ['fantasy'], kind: 'weapon', name: 'peerless greatsword', look: 'a greatsword of impossible craft', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.cut, tree: 'melee', class: 'heavy', grips: 2 })] } },
  { id: IT.peerless_composite_bow, level: 'masterwork', gearClass: GC.ranged_light, gearType: GT.recurve, tags: ['fantasy'], kind: 'weapon', shotTime: DU.bow_light, name: 'peerless composite bow', look: 'a composite bow of impossible craft', bulk: 2, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'light', grips: 2 })] } },
  { id: IT.peerless_warbow, level: 'masterwork', gearClass: GC.ranged_medium, gearType: GT.warbow, tags: ['fantasy'], kind: 'weapon', shotTime: DU.bow_medium, name: 'peerless warbow', look: 'a warbow of impossible craft', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'medium', grips: 2 })] } },
  { id: IT.peerless_crossbow, level: 'masterwork', gearClass: GC.ranged_heavy, gearType: GT.crossbow_heavy, tags: ['fantasy'], kind: 'weapon', shotTime: DU.crossbow_shot, spanTime: DU.span_crossbow, name: 'peerless crossbow', look: 'a steel-bowed crossbow of impossible craft', bulk: 3, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.shoot, tree: 'ranged', class: 'heavy', grips: 2 })] } },
  { id: IT.peerless_jack, level: 'masterwork', gearClass: GC.armor_light, gearType: GT.cuirass, tags: ['fantasy'], kind: 'armor', name: 'peerless jack', look: 'a jack of plates of impossible craft', bulk: 2, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('light', 'masterwork') } },
  { id: IT.peerless_coat_of_plates, level: 'masterwork', gearClass: GC.armor_medium, gearType: GT.coat, tags: ['fantasy'], kind: 'armor', name: 'peerless coat of plates', look: 'a coat of plates over mail, of impossible craft', bulk: 3, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('medium', 'masterwork') } },
  { id: IT.peerless_plate, level: 'masterwork', gearClass: GC.armor_heavy, gearType: GT.full_harness, tags: ['fantasy'], kind: 'armor', name: 'peerless plate harness', look: 'a plate harness of impossible craft', bulk: 3, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('heavy', 'masterwork') } },
  { id: IT.peerless_heater, level: 'masterwork', gearClass: GC.shield, tags: ['fantasy'], kind: 'shield', name: 'peerless heater shield', look: 'a heater shield of impossible craft', bulk: 2, grips: 1, effects: [KIT(SK.block)], shield: POOL('masterwork') },
  // IR21: helmets, armor pieces of their weight's class covering the head (type Helmet, or Helmet with neck), worn beside any
  // body piece that leaves those parts bare (IR19). Masterwork ones are tagged 'fantasy' (IR2).
  { id: IT.arming_cap, level: 'common', gearClass: GC.armor_light, gearType: GT.helmet, kind: 'armor', name: 'arming cap', look: 'a quilted linen cap', bulk: 1, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('light', 'common') } }, // a padded cap, worn alone or under a helm (Wikipedia "Arming cap")
  { id: IT.leather_cap, level: 'fine', gearClass: GC.armor_light, gearType: GT.helmet, kind: 'armor', name: 'leather cap', look: 'a cap of hardened leather', bulk: 1, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('light', 'fine') } }, // a hardened-leather skull cap (Wikipedia "Leather helmet")
  { id: IT.secret, level: 'superior', gearClass: GC.armor_light, gearType: GT.helmet, kind: 'armor', name: 'secret', look: 'a soft hat over a hidden iron skull', bulk: 1, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('light', 'superior') } }, // an iron skull cap worn under a hat (Wikipedia "Secret (helmet)")
  { id: IT.peerless_cap, level: 'masterwork', gearClass: GC.armor_light, gearType: GT.helmet, tags: ['fantasy'], kind: 'armor', name: 'peerless cap', look: 'a leather cap of impossible craft', bulk: 1, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('light', 'masterwork') } },
  { id: IT.mail_coif, level: 'common', gearClass: GC.armor_medium, gearType: GT.helmet_neck, kind: 'armor', name: 'mail coif', look: 'a hood of riveted mail', bulk: 1, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('medium', 'common') } }, // a mail hood over head and neck (Wikipedia "Coif")
  { id: IT.kettle_hat, level: 'fine', gearClass: GC.armor_medium, gearType: GT.helmet, kind: 'armor', name: 'kettle hat', look: 'a broad-brimmed steel hat', bulk: 1, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('medium', 'fine') } }, // an open, brimmed steel hat (Wikipedia "Kettle hat")
  { id: IT.sallet, level: 'superior', gearClass: GC.armor_medium, gearType: GT.helmet, kind: 'armor', name: 'sallet', look: 'a swept steel sallet', bulk: 1, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('medium', 'superior') } }, // a steel helmet with a long tail over the nape (Wikipedia "Sallet")
  { id: IT.peerless_sallet, level: 'masterwork', gearClass: GC.armor_medium, gearType: GT.helmet, tags: ['fantasy'], kind: 'armor', name: 'peerless sallet', look: 'a sallet of impossible craft', bulk: 1, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('medium', 'masterwork') } },
  { id: IT.nasal_helm, level: 'common', gearClass: GC.armor_heavy, gearType: GT.helmet, kind: 'armor', name: 'nasal helm', look: 'a conical helm with a nose guard', bulk: 1, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('heavy', 'common') } }, // a conical steel helm with a nasal bar (Wikipedia "Nasal helmet")
  { id: IT.bascinet, level: 'fine', gearClass: GC.armor_heavy, gearType: GT.helmet_neck, kind: 'armor', name: 'bascinet', look: 'a visored bascinet with a mail aventail', bulk: 1, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('heavy', 'fine') } }, // a steel bascinet; its mail aventail hangs over the neck (Wikipedia "Bascinet")
  { id: IT.great_helm, level: 'superior', gearClass: GC.armor_heavy, gearType: GT.helmet, kind: 'armor', name: 'great helm', look: 'a flat-topped great helm with eye slits', bulk: 1, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('heavy', 'superior') } }, // a closed steel helm over the whole head (Wikipedia "Great helm")
  { id: IT.peerless_great_helm, level: 'masterwork', gearClass: GC.armor_heavy, gearType: GT.helmet, tags: ['fantasy'], kind: 'armor', name: 'peerless great helm', look: 'a great helm of impossible craft', bulk: 1, slot: 'armor', effects: WEIGHT(),
    armor: { ...ARMOR('heavy', 'masterwork') } },
  // IR25-IR29: gauntlets are an unarmed weapon (gear class Gauntlets, asking Unarmed strike): a pair held in both grips, so a
  // gauntleted hand holds nothing else. A punch with them is still a punch (15 damage, +10 hit); the kit bonus adds to the roll (IR26 b).
  { id: IT.leather_gloves, level: 'common', gearClass: GC.gauntlets, gearType: GT.fist, tags: ['starter'], kind: 'weapon', name: 'leather gloves', look: 'a pair of stout leather gloves', bulk: 1, grips: 2, effects: [KIT()], // leather gloves, worn under or without armour (Wikipedia "Gauntlet (glove)")
    weapon: { modes: [mode({ id: AM.punch, tree: 'unarmed', class: 'punch', skill: SK.unarmed_strike, grips: 1 })] } },
  { id: IT.mail_mittens, level: 'fine', gearClass: GC.gauntlets, gearType: GT.fist, tags: ['starter'], kind: 'weapon', name: 'mail mittens', look: 'a pair of riveted mail mittens', bulk: 1, grips: 2, effects: [KIT()], // mail mittens (mufflers), extending the hauberk's sleeves (Wikipedia "Gauntlet (glove)")
    weapon: { modes: [mode({ id: AM.punch, tree: 'unarmed', class: 'punch', skill: SK.unarmed_strike, grips: 1 })] } },
  { id: IT.plate_gauntlets, level: 'superior', gearClass: GC.gauntlets, gearType: GT.fist, kind: 'weapon', name: 'plate gauntlets', look: 'a pair of fingered plate gauntlets', bulk: 1, grips: 2, effects: [KIT()], // articulated steel plate over each finger (Wikipedia "Gauntlet (glove)")
    weapon: { modes: [mode({ id: AM.punch, tree: 'unarmed', class: 'punch', skill: SK.unarmed_strike, grips: 1 })] } },
  { id: IT.peerless_gauntlets, level: 'masterwork', gearClass: GC.gauntlets, gearType: GT.fist, tags: ['fantasy'], kind: 'weapon', name: 'peerless gauntlets', look: 'a pair of gauntlets of impossible craft', bulk: 1, grips: 2, effects: [KIT()],
    weapon: { modes: [mode({ id: AM.punch, tree: 'unarmed', class: 'punch', skill: SK.unarmed_strike, grips: 1 })] } },
  // D-218 Threadbound items: one of a kind; binds to the first who wears it (a charm: who carries it); its abilities open with its owner's achievements
  { id: IT.varos_loop, kind: 'misc', name: 'Varo\'s Loop', look: 'a small hoop of dark silver on a knotted cord, a charm worn smooth by fingers, stamped with the coin of Varo, god of extreme fortunes', bulk: 0, value: 400, boon: 20,
    threadbound: { rank: 'rank_4', grants: [
      { perk: PK.loose_odds, achievement: ACH.event_crit_1 }, { perk: PK.twin_abyss, achievement: ACH.event_crit_fail_1 },
      { perk: PK.call_the_toss, achievement: ACH.event_crit_2 }, { perk: PK.pull_to_the_edges, achievement: ACH.event_crit_fail_2 },
      { perk: PK.all_or_nothing, achievement: ACH.event_crit_3 }, { perk: PK.further_still, achievement: ACH.event_crit_fail_3 },
    ] } },
  // accessories: each gives a flat skill bonus while worn, sized by its equipment level (ACC: ACCESSORY_FACTOR × EQUIP_NEED, AX1/AX2)
  { id: IT.spectacles, level: 'common', kind: 'accessory', fragility: 'fragile', name: 'spectacles', look: 'a pair of round glass lenses in a thin wire frame', bulk: 0, slot: 'accessory', visible: true,
    effects: [ACC(SK.eyesight)] },
  { id: IT.charmed_ring, level: 'common', kind: 'accessory', name: 'charmed ring', look: 'a thin band of worn brass, faintly warm to the touch', bulk: 0, slot: 'accessory', visible: true,
    effects: [{ ...ACC(ROLLED_SKILL), weights: RING_WEIGHTS }] },
  { id: IT.ear_cup, level: 'common', kind: 'accessory', name: 'ear cup', look: 'a small carved horn cup that hooks over the ear', bulk: 0, slot: 'accessory', visible: true,
    effects: [ACC(SK.earshot)] },
  { id: IT.amulet, level: 'common', kind: 'accessory', name: 'amulet', look: 'a smooth stone amulet on a leather cord', bulk: 0, slot: 'accessory', visible: true,
    effects: [ACC(SK.resolve)] },
  { id: IT.hooded_cloak, level: 'common', kind: 'accessory', fragility: 'sturdy', name: 'dark hooded cloak', look: 'a long dark wool cloak with a deep hood', bulk: 1, slot: 'accessory', visible: true,
    effects: [ACC(SK.sneaking)] },
  { id: IT.lucky_charm, kind: 'misc', fragility: 'delicate', name: 'lucky charm', look: 'a small knotted charm', bulk: 0,
    effects: [{ kind: 'rollMod', roll: 'event', value: 5, active: 'carried', scope: 'any' }] },
  { id: IT.lockpicks, kind: 'tool', name: 'lockpicks', look: 'a roll of lockpicks', bulk: 0, grips: 1,
    effects: [{ kind: 'skill', skill: SK.filching, value: 25, active: 'inUse', scope: 'withItem' }] }, // only while picking a lock with them
  // BW22 a: breaking tools. In use (held in both grips) each adds CONFIG.BREAK_TOOL_KG to the breaker's force (src/ruleset/breaking.ts)
  { id: IT.sledgehammer, kind: 'tool', name: 'sledgehammer', look: 'a long-hafted iron sledgehammer', bulk: 2, grips: 2, tags: [BREAK_TOOL_TAG] },
  { id: IT.pick, kind: 'tool', name: 'pick', look: 'a heavy iron pick on an ash haft', bulk: 2, grips: 2, tags: [BREAK_TOOL_TAG] },
  { id: IT.healing_draught, kind: 'consumable', name: 'healing draught', look: 'a stoppered vial', bulk: 1, value: 10, grips: 1, stackable: true, consumable: true, heal: HL.draught },
  // generic bases for minted items with no close match, and for scenario objects the player grabs (loot L2, L3)
  { id: IT.improvised_light, level: 'common', gearClass: GC.improvised, kind: 'weapon', name: 'improvised weapon', look: 'something small grabbed to fight with', bulk: 1, grips: 1, tags: ['improvised'],
    weapon: { modes: IMPROVISED_MODES('light', 1) } },
  { id: IT.improvised_medium, level: 'common', gearClass: GC.improvised, kind: 'weapon', name: 'improvised weapon', look: 'something grabbed to fight with', bulk: 2, grips: 1, tags: ['improvised'],
    weapon: { modes: IMPROVISED_MODES('medium', 1) } },
  { id: IT.improvised_heavy, level: 'common', gearClass: GC.improvised, kind: 'weapon', name: 'improvised weapon', look: 'something heavy grabbed to fight with', bulk: 3, grips: 2, tags: ['improvised'],
    weapon: { modes: IMPROVISED_MODES('heavy', 2) } },
  { id: IT.curio, kind: 'misc', fragility: 'delicate', name: 'curio', look: 'an odd little object', bulk: 1, value: 1 },
  { id: IT.bandage, kind: 'consumable', fragility: 'sturdy', name: 'bandage', look: 'a roll of linen bandage', bulk: 0, value: 2, stackable: true, consumable: true, heal: HL.bandage },
  { id: IT.key, kind: 'misc', fragility: 'unbreakable', name: 'key', look: 'an iron key', bulk: 0, value: 1 }, // BA3: opens the barriers its instance names
  // CT1: containers. A worn pack holds its wearer's stowed items (CT7); a chest or crate stands where it is put
  { id: IT.pack, kind: 'misc', name: 'pack', look: 'a canvas pack on shoulder straps', bulk: 2, value: 4, container: { worn: true, soft: true } },
  { id: IT.sack, kind: 'misc', name: 'sack', look: 'a tied hemp sack', bulk: 1, value: 1, container: { soft: true } },
  { id: IT.chest, kind: 'misc', name: 'chest', look: 'an iron-bound wooden chest', bulk: 3, value: 20, container: { fixed: true } },
  { id: IT.crate, kind: 'misc', name: 'crate', look: 'a nailed wooden crate', bulk: 3, value: 2, container: { fixed: true } },
  { id: IT.coin, kind: 'misc', fragility: 'unbreakable', name: 'coin', look: 'coins', bulk: 0, value: 1, stackable: true },
] as ItemDef[]).map((i) => [i.id, typed(i)]));
