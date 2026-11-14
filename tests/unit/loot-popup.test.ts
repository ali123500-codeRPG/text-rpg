// The loot pop-up lists what the character can see to take where they stand (a body that is down, an open chest, the
// ground) and types one order for what was picked; Back closes it. Move to here names the town for a spot in another
// place, and an item's hover card says what it is worth.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { wholeTurn } from '../harness/turn';
import { intent } from '../cases/w4-kit';
import { buildPlayerView } from '../../src/views';
import { lootCount, lootOrder, lootSources } from '../../src/ui/loot';
import { actorById, zoneById } from '../../src/engine/relations';
import { newInstanceId } from '../../src/library/spawn';
import { IT } from '../../src/library/itemIds';
import type { GameState } from '../../src/types';

const src = (f: string): string => readFileSync(`src/ui/${f}`, 'utf8');

/** a patron down beside the player with what a search turned up, an open chest and a sack on the ground */
function lootHere(s: GameState) {
  const p = s.player, npc = actorById(s, 'patron_1')!;
  npc.zone = p.zone; npc.placeId = p.placeId; npc.core.condition.hpLostPct = 100;
  const add = (itemId: string) => { const it = { id: newInstanceId(), itemId, qty: 1 }; npc.core.inventory.push(it); return it; };
  const found = [add(IT.bandage), add(IT.key)];
  p.journal = { ...p.journal!, revealed: [...(p.journal?.revealed ?? []), ...found.map((i) => `item:${i.id}`)] };
  const z = zoneById(s, p.zone)!;
  z.groundItems.push({ id: 'chest_1', itemId: IT.chest, open: true, contents: [{ id: 'picks_1', itemId: IT.lockpicks }] } as never, { id: 'sack_1', itemId: IT.sack } as never);
  return { found, npc };
}

describe('loot pop-up', () => {
  it('after a whole turn, lists the body\'s found things, the open chest and the ground, never the fixed chest itself', async () => {
    const g = wholeTurn();
    const { found } = lootHere(g.state);
    await g.turn(intent({ action: { type: 'wait' } } as never));
    const srcs = lootSources(buildPlayerView(g.game.state()!));
    const body = srcs.find((x) => x.kind === 'body')!;
    for (const f of found) expect(body.items.map((i) => i.id)).toContain(f.id);
    expect(srcs.find((x) => x.kind === 'container')?.items.map((i) => i.id)).toEqual(['picks_1']);
    expect(srcs.find((x) => x.kind === 'ground')?.items.map((i) => i.id)).toEqual(['sack_1']);
    expect(lootCount(srcs)).toBe(srcs.reduce((n, x) => n + x.items.length, 0));
  });

  it('one order for the picks, one phrase per place they come from', async () => {
    const g = wholeTurn();
    const { found } = lootHere(g.state);
    const srcs = lootSources(buildPlayerView(g.state));
    const from = srcs.find((x) => x.kind === 'body')!.from;
    expect(lootOrder(srcs, new Set([found[0].id, found[1].id]))).toBe(`Take the bandage and the key from ${from}`);
    expect(lootOrder(srcs, new Set([found[1].id, 'picks_1', 'sack_1']))).toBe(`Take the key from ${from}, take the lockpicks from the chest and pick up the sack`);
    expect(lootOrder(srcs, new Set())).toBe('');
  });

  it('a standing person\'s gear is not loot', () => {
    const g = wholeTurn();
    const npc = actorById(g.state, 'patron_1')!;
    npc.zone = g.state.player.zone; npc.placeId = g.state.player.placeId;
    expect(lootSources(buildPlayerView(g.state)).some((x) => x.kind === 'body')).toBe(false);
  });

  it('the chip opens it; Take types the order and sends nothing; Back closes it', () => {
    const play = src('play.ts'), loot = src('loot.ts'), pop = src('pop.ts');
    expect(play).toMatch(/lootBtn\.onclick = \(\) => \{[^}]*openLoot\(v, lootBtn, pick\)/);
    expect(loot).toMatch(/take\.onclick = \(\) => \{ const o = lootOrder\(src, picked\); if \(!o\) return; closePop\(\); onOrder\(o\); \}/);
    expect(loot).toMatch(/openPop\(\{ title: 'Loot', body, opener, cls: 'loot-pop', back: true \}\)/);
    expect(pop).toMatch(/if \(o\.back && !history\.state\?\.dpop\) history\.pushState\(\{ dpop: true \}, ''\)/);
    expect(pop).toMatch(/addEventListener\('popstate', \(\) => \{ if \(current\?\.back\) closePop\(true\); closeFull\(true\); \}\)/);
  });
});

describe('Move to here names the town; items show their value', () => {
  it('a zone in another place than yours gets "in <place>" after it', () => {
    const m = src('map.ts');
    expect(m).toMatch(/rootOf\(cur\.placeId\) !== to && name\.toLowerCase\(\) !== z\.name\.toLowerCase\(\) \? `\$\{moveOrder\(z\.name\)\} in \$\{theName\(name\)\}`/);
    expect(m).toMatch(/onMove\(moveHere\(z\)\)/);
  });

  it('the hover card has a Value row, for a stack each and in all', async () => {
    const pages = src('pages.ts');
    expect(pages).toMatch(/k: 'Value', v: !worth \? 'Worthless' : n > 1 \? `\$\{coinWords\(worth\)\} each, \$\{coinWords\(worth \* n\)\} for \$\{n\}`/);
  });
});
