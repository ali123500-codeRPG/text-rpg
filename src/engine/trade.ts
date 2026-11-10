// Paying with coin (D-93, PY1–PY10): sellers' wares, prices, haggling and the buy action.
// A seller is an actor with the Trader class and wares. Goods are its own stock (inventory items whose library id is
// listed); services are catalog ids. Price = base × TRADE_MARKUP × haggle × Hard Bargain × (1 − achievement pricePct %), rounded up, at least 1.
import { bestReward } from '../ruleset/achRewards';
import type { Actor, ContestResult, GameState, ItemInstance } from '../types';
import { CONFIG } from '../config';
import { getLibrary, itemDef } from '../library';
import { CL } from '../library/classIds';
import { hasPerk } from '../ruleset';
import { isActive, shortestPath, wary } from './relations';
import { PK } from '../library/perkIds';
import { IT } from '../library/itemIds';
import { tally } from './xp';

const GOODS = 'goods:';
const SERVICE = 'service:';

/** PY9: a coin amount in coin words, largest coin first ("1 silver and 5 copper") */
export function coinWords(n: number): string {
  let left = Math.max(0, Math.floor(n));
  const parts: string[] = [];
  for (const [name, worth] of CONFIG.COIN_NAMES) {
    const k = Math.floor(left / worth);
    if (k) parts.push(`${k} ${name}`);
    left -= k * worth;
  }
  if (!parts.length) return `0 ${CONFIG.COIN_NAMES.at(-1)![0]}`;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

export const coins = (a: Actor): number => a.core.inventory.filter((i) => i.itemId === IT.coin).reduce((n, i) => n + (i.qty ?? 1), 0);

export const isSeller = (a: Actor): boolean => !!a.wares && a.core.classes.some((c) => c.classId === CL.trader);

const stockOf = (a: Actor, itemId: string): ItemInstance[] => a.core.inventory.filter((i) => i.itemId === itemId && !i.equippedIn?.length);
const count = (insts: ItemInstance[]) => insts.reduce((n, i) => n + (i.qty ?? 1), 0);

/** SL8: an item's trade value: its library value, × QUALITY_PRICE_FACTOR × quality for a minted item */
export function itemValue(state: GameState, itemId: string): number {
  const d = itemDef(state, itemId);
  return d.value * (d.base ? CONFIG.QUALITY_PRICE_FACTOR * d.base.quality : 1);
}

/** the price buyer pays seller for one of a ware, or null when the seller doesn't offer it */
export function warePrice(state: GameState, buyer: Actor, seller: Actor, wareId: string): number | null {
  if (!isSeller(seller)) return null;
  let base: number | undefined;
  if (wareId.startsWith(GOODS)) {
    const id = wareId.slice(GOODS.length);
    if (seller.wares!.items.includes(id)) base = itemValue(state, id);
  } else if (wareId.startsWith(SERVICE)) {
    const id = wareId.slice(SERVICE.length);
    if (seller.wares!.services.includes(id)) base = getLibrary().services?.[id]?.price;
  }
  if (base === undefined) return null;
  const mult = CONFIG.TRADE_MARKUP * (buyer.haggle?.[seller.id] ?? 1) * (hasPerk(buyer, PK.haggler) ? CONFIG.HARD_BARGAIN_BUY : 1)
    * (1 - (bestReward(buyer, 'pricePct')?.value ?? 0) / 100);
  return Math.max(1, Math.ceil(base * mult - 1e-9));
}

/** what a seller offers, at the buyer's prices (goods only while in stock) */
export function wareList(state: GameState, buyer: Actor, seller: Actor): { id: string; name: string; price: string; stock?: number }[] {
  if (!isSeller(seller)) return [];
  const goods = seller.wares!.items.map((id) => ({ id: GOODS + id, name: itemDef(state, id).name, stock: count(stockOf(seller, id)) })).filter((g) => g.stock > 0);
  const services = seller.wares!.services.flatMap((id) => {
    const s = getLibrary().services?.[id];
    return s ? [{ id: SERVICE + id, name: s.name }] : [];
  });
  return [...goods, ...services].map((w) => ({ ...w, price: coinWords(warePrice(state, buyer, seller, w.id)!) }));
}

/** PY6: a barter contest against a seller: a win lowers the buyer's prices there, a loss by HAGGLE_BAD_GAP tiers or more
 * raises them, until the buyer's engagement ends; anything between leaves them as they were */
export function applyHaggle(buyer: Actor, seller: Actor, contest: ContestResult): void {
  if (!isSeller(seller)) return;
  const mult = contest.gap < 0 ? CONFIG.HAGGLE_WIN : contest.gap >= CONFIG.HAGGLE_BAD_GAP ? CONFIG.HAGGLE_BAD_LOSS : undefined;
  if (mult !== undefined) (buyer.haggle ??= {})[seller.id] = mult;
}

/** moves n of the buyer's coin into the seller's purse (both stacks merge by item id) */
function payCoin(from: Actor, to: Actor, n: number): void {
  for (const i of from.core.inventory.filter((x) => x.itemId === IT.coin)) {
    if (!n) break;
    const take = Math.min(n, i.qty ?? 1);
    i.qty = (i.qty ?? 1) - take;
    n -= take;
    const purse = to.core.inventory.find((x) => x.itemId === IT.coin);
    if (purse) purse.qty = (purse.qty ?? 1) + take;
    else to.core.inventory.push({ id: `${i.id}_${to.id}`, itemId: IT.coin, qty: take });
  }
  from.core.inventory = from.core.inventory.filter((x) => x.itemId !== IT.coin || (x.qty ?? 1) > 0);
}

export type BuyResult =
  | { ok: true; price: number; qty: number; itemInst?: string; service?: string; to: Actor }
  | { ok: false; reason: 'not_here' | 'refuses' | 'not_offered' | 'out_of_stock' | 'not_enough_coin' };

/** zone links between two actors on the stage, or Infinity when no path joins them */
function links(state: GameState, a: Actor, b: Actor): number {
  return shortestPath(state, a.zone, b.zone)?.length ?? Infinity;
}

/** PY5/PY7: buy qty (default 1) of a ware from seller, for `to` (default the buyer). All or nothing; no roll.
 * The seller may stand up to TRADE_SELLER_LINKS zone links away, `to` up to TRADE_GIFT_LINKS (S1, S2). */
export function buy(state: GameState, buyer: Actor, seller: Actor | undefined, wareId: string | null | undefined, qtyIn: number | null | undefined, to: Actor = buyer): BuyResult {
  if (!seller || seller === buyer || !isActive(seller) || links(state, buyer, seller) > CONFIG.TRADE_SELLER_LINKS) return { ok: false, reason: 'not_here' };
  if (!isActive(to) || links(state, buyer, to) > CONFIG.TRADE_GIFT_LINKS) return { ok: false, reason: 'not_here' };
  if (wary(state, seller, buyer)) return { ok: false, reason: 'refuses' };
  const each = wareId ? warePrice(state, buyer, seller, wareId) : null;
  if (each === null) return { ok: false, reason: 'not_offered' };
  const qty = Math.max(1, Math.floor(qtyIn ?? 1));
  const goods = wareId!.startsWith(GOODS) ? stockOf(seller, wareId!.slice(GOODS.length)) : null;
  if (goods && count(goods) < qty) return { ok: false, reason: 'out_of_stock' };
  const price = each * qty;
  if (coins(buyer) < price) return { ok: false, reason: 'not_enough_coin' };
  payCoin(buyer, seller, price);
  if (buyer === state.player) tally(state, 'coin_spent', { add: price }); // N5: copper spent buying
  if (!goods) {
    const id = wareId!.slice(SERVICE.length);
    const heals = getLibrary().services?.[id]?.heals;
    if (heals && !(to.paid ??= []).includes(heals)) to.paid.push(heals);
    return { ok: true, price, qty, service: id, to };
  }
  const itemId = wareId!.slice(GOODS.length);
  let left = qty;
  let inst: ItemInstance | undefined;
  const stackable = itemDef(state, itemId).stackable;
  for (const g of goods) {
    if (!left) break;
    if (!stackable) {
      seller.core.inventory.splice(seller.core.inventory.indexOf(g), 1);
      to.core.inventory.push(g);
      inst = g;
      left -= 1;
      continue;
    }
    const take = Math.min(left, g.qty ?? 1);
    left -= take;
    g.qty = (g.qty ?? 1) - take;
    if (g.qty <= 0) seller.core.inventory.splice(seller.core.inventory.indexOf(g), 1);
    inst = to.core.inventory.find((x) => x.itemId === itemId);
    if (inst) inst.qty = (inst.qty ?? 1) + take;
    else to.core.inventory.push(inst = { id: `${g.id}_${to.id}_${state.turn}`, itemId, qty: take });
  }
  return { ok: true, price, qty, itemInst: inst?.id, to };
}

/** SL2: a Trader buys the kinds of item it sells */
const buysKind = (state: GameState, seller: Actor, itemId: string): boolean =>
  isSeller(seller) && seller.wares!.items.some((w) => itemDef(state, w).kind === itemDef(state, itemId).kind);

/** SL7: worn armor and worn accessories must come off before they can be sold; held gear is stowed and sold */
const worn = (inst: ItemInstance): boolean => !!inst.equippedIn?.some((s) => s === 'armor' || s.startsWith('acc:'));

/** SL1/SL5/SL8/SL10: what seller pays the owner for one of an item, or null when it won't buy it.
 * value × SELL_SHARE, × the haggle turned round (a won haggle pays more), × Hard Bargain; rounded down, at least 1. */
export function sellPrice(state: GameState, owner: Actor, seller: Actor, itemId: string): number | null {
  if (itemId === IT.coin || !buysKind(state, seller, itemId)) return null;
  const value = itemValue(state, itemId);
  if (value <= 0) return null; // SL8: worthless items (improvised weapons) can't be sold
  const h = owner.haggle?.[seller.id];
  const mult = CONFIG.SELL_SHARE * (h === undefined ? 1 : 2 - h) * (hasPerk(owner, PK.haggler) ? CONFIG.HARD_BARGAIN_SELL : 1);
  return Math.max(1, Math.floor(value * mult + 1e-9));
}

/** SL9: what seller would pay for each item the owner carries and could sell now */
export function offerList(state: GameState, owner: Actor, seller: Actor): { id: string; name: string; price: string }[] {
  if (!isSeller(seller)) return [];
  return owner.core.inventory.flatMap((i) => {
    const p = worn(i) ? null : sellPrice(state, owner, seller, i.itemId);
    return p === null ? [] : [{ id: i.id, name: itemDef(state, i.itemId).name, price: coinWords(p) }];
  });
}

export type SellResult =
  | { ok: true; price: number; qty: number; itemInst: string }
  | { ok: false; reason: 'not_here' | 'refuses' | 'not_bought' | 'worn' | 'not_enough_coin' };

/** SL4/SL6: sell qty (default 1; stacks only) of one of the seller's own items to a Trader. All or nothing; no roll.
 * The item joins the Trader's stock and wares; the Trader pays from its own purse. */
export function sell(state: GameState, owner: Actor, seller: Actor | undefined, instId: string | null | undefined, qtyIn: number | null | undefined): SellResult {
  if (!seller || seller === owner || !isActive(seller) || links(state, owner, seller) > CONFIG.TRADE_SELLER_LINKS) return { ok: false, reason: 'not_here' };
  if (wary(state, seller, owner)) return { ok: false, reason: 'refuses' };
  const inst = owner.core.inventory.find((i) => i.id === instId);
  const each = inst ? sellPrice(state, owner, seller, inst.itemId) : null;
  if (!inst || each === null) return { ok: false, reason: 'not_bought' };
  if (worn(inst)) return { ok: false, reason: 'worn' };
  const stackable = itemDef(state, inst.itemId).stackable;
  const qty = stackable ? Math.max(1, Math.floor(qtyIn ?? 1)) : 1;
  if (qty > (inst.qty ?? 1)) return { ok: false, reason: 'not_bought' };
  const price = each * qty;
  if (coins(seller) < price) return { ok: false, reason: 'not_enough_coin' };
  payCoin(seller, owner, price);
  let moved: ItemInstance = inst;
  if (stackable && qty < (inst.qty ?? 1)) {
    inst.qty = (inst.qty ?? 1) - qty;
    moved = { id: `${inst.id}_${seller.id}_${state.turn}`, itemId: inst.itemId, qty };
  } else owner.core.inventory.splice(owner.core.inventory.indexOf(inst), 1);
  delete moved.equippedIn; // a held weapon or shield is stowed and sold
  const stack = stackable ? seller.core.inventory.find((x) => x.itemId === moved.itemId && !x.equippedIn?.length) : undefined;
  if (stack) stack.qty = (stack.qty ?? 1) + qty;
  else seller.core.inventory.push(moved);
  if (!seller.wares!.items.includes(moved.itemId)) seller.wares!.items.push(moved.itemId);
  return { ok: true, price, qty, itemInst: stack?.id ?? moved.id };
}
