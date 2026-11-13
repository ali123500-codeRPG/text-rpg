// HF15, HF18–HF24: unique NPCs. A unique template holds one saved character's whole sheet (UniqueSheet), spawned exactly as
// saved at full health, at most once per world. Hall of fame heroes come back as echoes: they keep their sheet,
// achievements and scars, never learn anything new (D-243), and all their gear is soulbound copies. Their coin and
// carried goods stay behind (HF24 c). The heroes themselves are rows in src/library/uniques.ts.
import type { Actor, GameState, ItemDef, ItemInstance, NpcTemplate, UniqueSheet } from '../types';
import { CONFIG } from '../config';
import { getLibrary, itemDef } from './index';
import { ageYears } from '../ruleset/age';

/** HF24 c: what an echo keeps: what it fights, guards and works with; coin, consumables and other goods stay behind */
const GEAR_KINDS: ItemDef['kind'][] = ['weapon', 'shield', 'armor', 'accessory', 'tool'];

/** a full pool again: an echo comes back whole (HF5), its gear too */
function freshPools(state: GameState | null, inst: ItemInstance): ItemInstance['pools'] {
  const d = itemDef(state, inst.itemId);
  if (d.shield) return { shield: 100 };
  if (d.armor?.pools) return Object.fromEntries(Object.keys(d.armor.pools).map((k) => [k, 100]));
  return undefined;
}

/** HF3, HF18: the sheet an echo of `a` keeps, from its story's last save. `id` is the unique template's id: items made in
 * that story (its blueprints) travel with the sheet under `<id>_<item id>`, so they never clash with another story's. */
export function echoSheet(state: GameState, a: Actor, id: string, past: string): UniqueSheet {
  const lib = getLibrary();
  const itemDefs: ItemDef[] = [];
  const own = (itemId: string): string => {
    if (lib.items[itemId]) return itemId;
    const newId = `${id}_${itemId}`;
    if (!itemDefs.some((d) => d.id === newId)) itemDefs.push({ ...structuredClone(itemDef(state, itemId)), id: newId });
    return newId;
  };
  const gear = a.core.inventory.filter((i) => GEAR_KINDS.includes(itemDef(state, i.itemId).kind)).map((i, n): ItemInstance => {
    const pools = freshPools(state, i);
    return { id: `g${n + 1}`, itemId: own(i.itemId), ...(i.qty ? { qty: i.qty } : {}), ...(i.equippedIn ? { equippedIn: [...i.equippedIn] } : {}), ...(pools ? { pools } : {}), soulbound: true };
  });
  const years = ageYears(state, a);
  const pr = a.progression;
  return {
    origin: 'echo',
    name: a.names.current,
    ...(a.pronouns ? { pronouns: a.pronouns } : {}),
    ...(a.appearance ? { appearance: a.appearance } : {}),
    classes: structuredClone(a.core.classes),
    skills: structuredClone(a.core.skills),
    perks: structuredClone(a.core.perks),
    personality: structuredClone(a.core.personality ?? { nerve: 0, traits: {}, values: [] }),
    standingDefense: a.core.standingDefense,
    ...(years !== undefined ? { ageDays: Math.round(years * CONFIG.YEAR_DAYS) } : {}),
    gear,
    ...(itemDefs.length ? { itemDefs } : {}),
    achievements: structuredClone(pr?.achievements ?? []),
    ...(pr?.title ? { title: pr.title } : {}),
    ...(pr?.essences?.length ? { essences: structuredClone(pr.essences) } : {}),
    past,
  };
}

/** HF15: a unique template from a saved sheet. The template's other fields are what a reader of templates expects (its race,
 * first current class, level); a unique is never rolled from them. */
export function uniqueTemplate(id: string, raceId: string, label: string, sheet: UniqueSheet): NpcTemplate {
  const cur = sheet.classes.find((c) => c.state === 'current') ?? sheet.classes[0];
  return {
    id, raceId, ...(cur ? { classId: cur.classId } : {}), generation: 'unique', unique: sheet,
    minimums: {}, level: sheet.classes.reduce((n, c) => n + c.level, 0), bonusPoints: 0, focus: [],
    resolve: 0, personality: sheet.personality, control: 'agent', label, notable: true,
  };
}

/** HF11: the unique is already in this world, alive or dead: it appears at most once per world */
export const uniqueInWorld = (state: GameState, templateId: string): boolean =>
  state.actors.some((a) => a.core.templateId === templateId && a.core.generation === 'unique');

/** D-243: an echo never learns: no marks, gains, XP, achievements or scars */
export const isEcho = (a: Actor): boolean => a.core.origin === 'echo';

/** HF18: only the item's owner may use a soulbound item */
export const soulboundElsewhere = (inst: ItemInstance, a: Actor): boolean => !!inst.soulbound && inst.boundTo !== a.id;
