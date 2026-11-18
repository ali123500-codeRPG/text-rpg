// R5: equipping and then unequipping every library item on a test actor returns its true skills, standing attack and
// defense, protection and Power to exactly their old values: nothing an item does outlives wearing or holding it.
import { describe, expect, it } from 'vitest';
import { actorBody, getLibrary, itemDef } from '../../src/library';
import { trueSkill } from '../../src/ruleset';
import { pieceOn } from '../../src/ruleset/worn';
import { applyGearOps, equipArmor } from '../../src/engine/gear';
import { power } from '../../src/engine/xp';
import { attackOf, standing } from '../../src/ui/charsheet';
import { makeVillage } from '../harness';
import type { Actor, GameState, ItemInstance } from '../../src/types';

const figures = (s: GameState, a: Actor) => ({
  skills: Object.keys(getLibrary().skills).map((k) => trueSkill(a, k)),
  attack: attackOf(s, a), defense: standing(s, a).value,
  protection: actorBody(s, a).parts.map((p) => pieceOn(s, a, p.id)?.armor.reduction ?? 0),
  power: power(s, a),
});

describe('equip round trip (R5)', () => {
  it('every equippable library item leaves the figures exactly as they were', () => {
    const s = makeVillage(), p = s.player;
    for (const i of p.core.inventory) delete i.equippedIn; // a bare test actor: free grips, no armor, no accessories
    const base = figures(s, p);
    const ids = Object.keys(getLibrary().items).filter((id) => { const d = itemDef(s, id); return d.slot || (d.grips && (d.kind === 'weapon' || d.kind === 'shield')); });
    expect(ids.length).toBeGreaterThan(20);
    let worn = 0;
    for (const id of ids) {
      const d = itemDef(s, id), inst: ItemInstance = { id: `rt_${id}`, itemId: id, qty: 1 };
      p.core.inventory.push(inst);
      const on = d.slot === 'armor' ? equipArmor(s, p, inst.id) : !applyGearOps(s, p, [{ op: d.slot === 'accessory' ? 'wear_acc' : 'draw', item: inst.id }]).invalid.length;
      if (on) worn++;
      if (d.slot === 'armor') equipArmor(s, p, inst.id); else applyGearOps(s, p, [{ op: d.slot === 'accessory' ? 'remove_acc' : 'stow', item: inst.id }]);
      expect(inst.equippedIn?.length ?? 0, id).toBe(0);
      p.core.inventory.splice(p.core.inventory.indexOf(inst), 1);
      expect(figures(s, p), id).toEqual(base);
    }
    expect(worn, 'most items really went on').toBeGreaterThan(ids.length * 0.8);
  });
});
