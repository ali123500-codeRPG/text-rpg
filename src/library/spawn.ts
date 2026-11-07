// NPC generation from templates (Part 4 §4) and player creation. Copy generation here; W1 adds unique generation.
import type { Actor, GameState, ItemInstance, Rng } from '../types';
import { CONFIG } from '../config';
import { creatureType, itemDef, npcTemplate } from './index';

let seq = 0;
export function newInstanceId(prefix = 'it'): string {
  seq += 1;
  return `${prefix}_${seq}`;
}
export function resetInstanceIds(): void {
  seq = 0;
}

export function fullParts(state: GameState | null, creatureTypeId: string): Record<string, number> {
  return Object.fromEntries(creatureType(state, creatureTypeId).parts.map((p) => [p.id, 100]));
}

/** equip a loadout the obvious way: weapons/shields into free hands, armor worn. */
export function equipLoadout(state: GameState | null, items: string[], idPrefix: string): ItemInstance[] {
  const out: ItemInstance[] = [];
  const hands = ['hand:right_arm', 'hand:left_arm'];
  let n = 0;
  for (const itemId of items) {
    const d = itemDef(state, itemId);
    n += 1;
    const inst: ItemInstance = { id: `${idPrefix}_${itemId}_${n}` , itemId };
    if (d.slot === 'armor') inst.equippedIn = ['armor'];
    else if ((d.kind === 'weapon' || d.kind === 'shield') && hands.length) inst.equippedIn = [hands.shift()!];
    if (d.shield) inst.pools = { shield: 100 };
    if (d.armor?.pools) inst.pools = Object.fromEntries(Object.keys(d.armor.pools).map((k) => [k, 100]));
    out.push(inst);
  }
  return out;
}

export type SpawnOpts = { id: string; zone: string; placeId: string; bandId: string; label?: string; name?: string; storyId?: string };

/** Copy NPC: skills are the template's minimums (read live in principle; copied here for the sheet). */
export function spawnNpc(state: GameState | null, templateId: string, opts: SpawnOpts, _rng?: Rng): Actor {
  const t = npcTemplate(state, templateId);
  if (t.generation === 'unique') {
    // W1: seeded unique generation (Part 4 §4). Until then uniques spawn like copies.
  }
  const ct = creatureType(state, t.creatureTypeId);
  const morale = CONFIG.PERSONALITY_MORALE[t.personality];
  return {
    id: opts.id,
    storyId: opts.storyId ?? state?.storyId ?? 'story',
    kind: 'npc',
    names: { current: opts.name ?? opts.label ?? t.label, past: [] },
    label: opts.label ?? t.label,
    placeId: opts.placeId,
    zone: opts.zone,
    bandId: opts.bandId,
    core: {
      creatureTypeId: ct.id,
      templateId: t.id,
      generation: t.generation,
      skills: Object.fromEntries(Object.entries(t.minimums).map(([k, v]) => [k, { raw: v, state: 'normal' as const }])),
      classes: t.classId ? [{ classId: t.classId, state: 'current', level: t.level }] : [],
      perks: [],
      condition: { hpLostPct: 0, parts: fullParts(state, ct.id), status: [] },
      inventory: equipLoadout(state, t.loadout ?? [], opts.id),
      standingDefense: (t.minimums.block ?? 0) > (t.minimums.dodge ?? 0) ? 'block' : 'dodge',
    },
    mind: {
      control: t.control,
      behavior: t.personality,
      morale: morale ?? CONFIG.MORALE_DEFAULT,
      fearless: t.personality === 'fearless',
      knowledge: {},
      knows: [],
    },
  };
}
