import type { Actor, GameState } from '../types';
import { CONFIG } from '../config';
import { itemDef } from '../library';
import { IT } from '../library/itemIds';
import { PA, VL } from '../library/tableIds';
import { personalityOf } from '../ruleset/personality';
import { isActive, stance } from './relations';
import { coins, itemValue } from './trade';
import { distM } from './position';

/**
 * WP6 a, D-253 b: `looters` strip `body` in their order. The first takes all the coin; then each in turn takes the most
 * valuable thing left, until each has LOOT_TAKE_MAX or nothing of value is left. Worn containers and soulbound gear stay.
 */
export function stripBody(state: GameState, body: Actor, looters: Actor[]): void {
  if (!looters.length) return;
  const take = (a: Actor, i: (typeof body.core.inventory)[number]) => {
    body.core.inventory = body.core.inventory.filter((x) => x !== i);
    delete i.equippedIn;
    const purse = i.itemId === IT.coin ? a.core.inventory.find((x) => x.itemId === IT.coin) : undefined;
    if (purse) purse.qty = (purse.qty ?? 1) + (i.qty ?? 1);
    else a.core.inventory.push(i);
  };
  for (const i of body.core.inventory.filter((x) => x.itemId === IT.coin)) take(looters[0], i);
  const worth = (i: (typeof body.core.inventory)[number]) => itemValue(state, i.itemId) * (i.qty ?? 1);
  const left = body.core.inventory.filter((i) => !i.soulbound && !itemDef(state, i.itemId).container && worth(i) > 0).sort((a, b) => worth(b) - worth(a));
  const count = new Map<Actor, number>();
  for (let k = 0; left.length; k++) {
    const open = looters.filter((f) => (count.get(f) ?? 0) < CONFIG.LOOT_TAKE_MAX);
    if (!open.length) break;
    const f = open[k % open.length];
    take(f, left.shift()!);
    count.set(f, (count.get(f) ?? 0) + 1);
  }
}

/** D-253 b: an NPC takes from a body when it is hostile to the dead, values Wealth, is dishonest (Honesty below 0) or is
 * poor (under POOR_COIN coin) */
export function takesFrom(state: GameState, a: Actor, body: Actor): boolean {
  const p = personalityOf(a);
  return stance(state, a, body) === 'hostile' || p.values.includes(VL.wealth) || (p.traits[PA.honesty] ?? 0) < 0 || coins(a) < CONFIG.POOR_COIN;
}

/** D-253 b: at a scenario's end every NPC standing that found a body (down or dead) and takes by its personality loots
 * it, nearest first. The player's body is not looted here (the rest of D-253 is parked). */
export function lootFoundBodies(state: GameState): void {
  for (const body of state.actors.filter((b) => !isActive(b))) {
    const d = (x: Actor) => { const m = distM(state, x, body); return Number.isFinite(m) ? m : Infinity; };
    const looters = state.actors.filter((a) => a !== body && a.mind && isActive(a) && a.mind.bodiesFound?.includes(body.id) && takesFrom(state, a, body))
      .sort((a, b) => d(a) - d(b) || 0);
    stripBody(state, body, looters);
  }
}
