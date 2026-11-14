// Unexplored exits on the map are clickable: the exit's card has Move to here, which types the order to take that way.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { wholeTurn } from '../harness/turn';
import { intent } from '../cases/w4-kit';
import { knownMap } from '../../src/ui/mapData';
import { exitOrder } from '../../src/ui/map';

describe('unexplored exits on the map', () => {
  it('Move to here on an unexplored exit types an order the parser reads as moving that way', () => {
    expect(exitOrder('back out to the road')).toBe('I go back out to the road');
    expect(exitOrder('through the gate')).toBe('I go through the gate');
    expect(exitOrder('the hut door')).toBe('I go to the hut door');
    expect(exitOrder('a lane down toward the mill stream')).toBe('I go to a lane down toward the mill stream');
  });

  it('every unexplored exit mark (arrow, note, stairs, stub) carries the zone it leaves and its words', () => {
    const src = readFileSync('src/ui/map.ts', 'utf8');
    expect(src.match(/exitAttrs\(/g)!.length).toBe(5); // the helper, plan arrow and note (shared), plan stairs, diagram stub and pill, diagram stairs
    expect(src).toMatch(/onMove\(exitOrder\(x\.label\)\)/);
  });

  it('whole turn: an exit you have not taken stays on the map as unexplored, with its words', async () => {
    const g = wholeTurn({ playerZone: 'field_far', without: ['slime_1', 'slime_2'] });
    await g.turn(intent({ action: { type: 'wait' } }));
    const far = knownMap(g.game.state()!).places.flatMap((p) => p.zones).find((z) => z.id === 'field_far')!;
    const woods = far.links.find((l) => l.label === 'into the woods')!;
    expect(woods.known).toBe(false);
    expect(exitOrder(woods.label)).toBe('I go into the woods');
  });
});
