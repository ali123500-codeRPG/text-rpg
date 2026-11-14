// Where an item sits on its owner (ItemInstance.equippedIn): a grip part ('grip:<part>', FR2), the armor slot, an
// accessory slot ('acc:<n>') or the pack. This file alone spells the slot names, so the rest of the code asks it.
// It imports nothing, so any file can use it (src/ruleset/body.ts included, which gear.ts imports).
type Slotted = { equippedIn?: readonly string[] };

const GRIP = 'grip:', ACC = 'acc:', ARMOR = 'armor';
/** the slot of a grip part */
export const gripSlot = (part: string) => `${GRIP}${part}`;
/** the slot of the nth accessory place (0 first) */
export const accSlot = (n: number) => `${ACC}${n}`;
export const isGripSlot = (s: string) => s.startsWith(GRIP);
export const isAccSlot = (s: string) => s.startsWith(ACC);
/** held: in a grip */
export const isHeld = (i: Slotted) => !!i.equippedIn?.some(isGripSlot);
/** worn: armor or an accessory */
export const isWorn = (i: Slotted) => !!i.equippedIn?.some((s) => s === ARMOR || isAccSlot(s));
/** in the armor slot */
export const inArmorSlot = (i: Slotted) => !!i.equippedIn?.includes(ARMOR);
/** the armor worn among these items, if any */
export const wornArmor = <T extends Slotted>(items: readonly T[]): T | undefined => items.find(inArmorSlot);
/** the grip parts holding the item */
export const gripsOf = (i: Slotted) => (i.equippedIn ?? []).filter(isGripSlot).map((s) => s.slice(GRIP.length));
