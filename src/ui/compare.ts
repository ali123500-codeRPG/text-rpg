// P1 gear compare: what equipping an item would change, against what the player has on now. It equips the item on a copy
// of the player and reads the same figures the Character page shows (standing attack and defense, Power), the reach the
// views give, the protection on each part the piece covers and the skills its effects name: never a second formula.
import type { Actor, GameState, ItemInstance } from '../types';
import { itemDef } from '../library';
import { effectiveSkill } from '../ruleset';
import { isAccSlot, isHeld, rolledSkill } from '../ruleset/gear';
import { pieceOn } from '../ruleset/worn';
import { applyGearOps, equipArmor } from '../engine/gear';
import { power } from '../engine/xp';
import { ROLLED_SKILL } from '../library/skillIds';
import { skillName } from '../library/skillNames';
import { findInstance, reachesOf } from '../views';
import { attackOf, standing } from './charsheet';
import { safe, type PanelRow } from './kit';
import { listWords } from '../words';

/** the player with the item equipped, on a copy; `off` are the player's pieces it pushes out. null: it can't be equipped */
export function tryOn(s: GameState, instId: string): { s2: GameState; p2: Actor; off: ItemInstance[] } | null {
  const p2: Actor = structuredClone(s.player);
  let inst = p2.core.inventory.find((i) => i.id === instId);
  if (!inst) { // loot: as if taken first
    const found = findInstance(s, instId);
    if (!found) return null;
    inst = structuredClone(found);
    delete inst.equippedIn;
    p2.core.inventory.push(inst);
  }
  if (inst.equippedIn?.length) return null;
  const s2: GameState = { ...s, player: p2 };
  const d = safe(() => itemDef(s, inst!.itemId));
  if (!d) return null;
  const op = (o: 'draw' | 'wear_acc') => !applyGearOps(s2, p2, [{ op: o, item: inst!.id }]).invalid.length;
  const held = () => p2.core.inventory.filter(isHeld);
  if (d.slot === 'armor') equipArmor(s2, p2, inst.id);
  else if (d.slot === 'accessory') {
    if (!op('wear_acc')) { const first = p2.core.inventory.find((i) => i.equippedIn?.some(isAccSlot)); if (first) delete first.equippedIn; op('wear_acc'); }
  } else if (d.grips && (d.kind === 'weapon' || d.kind === 'shield')) {
    // into free grips; else in place of what is held of the same kind; else in place of everything held
    if (!op('draw')) {
      held().forEach((i) => { if (itemDef(s, i.itemId).kind === d.kind) delete i.equippedIn; });
      if (!op('draw')) { held().forEach((i) => delete i.equippedIn); op('draw'); }
    }
  } else return null;
  if (!inst.equippedIn?.length) return null;
  const off = s.player.core.inventory.filter((i) => i.equippedIn?.length && !p2.core.inventory.find((x) => x.id === i.id)?.equippedIn?.length);
  return { s2, p2, off };
}

const num = (n: number) => String(+n.toFixed(2)); // fractions shown, as on the Character page
const longest = (s: GameState, a: Actor) => Math.max(0, ...(reachesOf(s, a).reaches ?? []).map((r) => r.metres));

/** "Compared with your …" rows: each figure that changes, old → new with ▲ or ▼. Empty when the item can't be equipped */
export function compareRows(s: GameState, it: { id?: string }): PanelRow[] {
  const t = it.id ? safe(() => tryOn(s, it.id!)) : null;
  if (!t) return [];
  const { s2, p2, off } = t, p = s.player;
  const inst = p2.core.inventory.find((i) => i.id === it.id)!;
  const d = itemDef(s, inst.itemId);
  const rows: PanelRow[] = [];
  const row = (k: string, a: number | null | undefined, b: number | null | undefined, before = '', after = '', skill?: string, part?: string) => {
    if (a == null || b == null || (a === b && before === after)) return;
    const n = b - a;
    rows.push({ k, ...(skill ? { skill } : {}), ...(part ? { part } : {}), v: `${before}${num(a)} → ${after}${num(b)}${n ? ` ${n > 0 ? '▲ +' : '▼ −'}${num(Math.abs(n))}` : ''}`, tone: n > 0 ? 'cmp tone-good' : n < 0 ? 'cmp tone-bad' : 'cmp' });
  };
  const atk = safe(() => attackOf(s, p)), atk2 = safe(() => attackOf(s2, p2));
  if (atk && atk2) row('Standing attack', atk.value, atk2.value, atk.name === atk2.name ? '' : `${atk.name} `, atk.name === atk2.name ? '' : `${atk2.name} `);
  const def = safe(() => standing(s, p)), def2 = safe(() => standing(s2, p2));
  if (def && def2) row('Standing defense', def.value, def2.value, def.kind === def2.kind ? '' : `${def.kind} `, def.kind === def2.kind ? '' : `${def2.kind} `);
  if (d.weapon) row('Reach (m)', safe(() => longest(s, p)), safe(() => longest(s2, p2)));
  for (const part of d.armor?.covers ?? []) row('Protection', pieceOn(s, p, part)?.armor.reduction ?? 0, pieceOn(s2, p2, part)?.armor.reduction ?? 0, '', '', undefined, part);
  const skills = new Set((d.effects ?? []).filter((e) => e.kind === 'skill' && e.skill && e.skill !== '$mode').map((e) => (e.skill === ROLLED_SKILL ? rolledSkill(s, { id: inst.id }, e) : e.skill!)));
  for (const k of skills) row(skillName(k), safe(() => effectiveSkill(s, p, k).value), safe(() => effectiveSkill(s2, p2, k).value), '', '', k);
  row('Power', safe(() => power(s, p)), safe(() => power(s2, p2)));
  const head: PanelRow = { split: true, k: 'Compared with', v: off.length ? `your ${listWords(off.map((i) => safe(() => itemDef(s, i.itemId).name) ?? i.itemId))}` : 'nothing (a free slot)' };
  return [head, ...(rows.length ? rows : [{ k: 'Change', v: 'No figure changes', tone: 'tone-muted' }])];
}

