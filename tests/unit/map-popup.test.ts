// The map as a big pop-up (no tab of its own): the Play header's Map button opens it through the app's nav, and the map
// it shows is built from what the character knows after a whole turn.
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { wholeTurn } from '../harness/turn';
import { intent } from '../cases/w4-kit';
import { knownMap } from '../../src/ui/mapData';
import { moveOrder } from '../../src/ui/map';

const src = (f: string): string => readFileSync(`src/ui/${f}`, 'utf8');

describe('map pop-up', () => {
  it('the rail has no Map page; Play has a Map button that opens the map full screen', () => {
    const app = src('app.ts'), play = src('play.ts');
    expect(app).not.toMatch(/\['map', 'Map'\]/);
    expect(app).toMatch(/if \(p === 'map'\) \{ openMap\(/);
    expect(app).toMatch(/openFull\(\{ label: 'Map', cls: 'map-full'/);
    expect(play).toMatch(/'data-open': 'map'[^\n]*nav\('map'\)/);
  });

  it('whole turn: the pop-up has a map to show, centred on where the character stands', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    await g.turn(intent({ action: { type: 'wait' } }));
    const m = knownMap(g.game.state()!);
    expect(m.zoneId).toBe('tav_common');
    expect(m.places.some((p) => p.zones.some((z) => z.id === 'tav_common'))).toBe(true);
  });

  it('Move to here types an order the parser reads as moving: the zone by name, "the" before a plain one', () => {
    expect(moveOrder('common room')).toBe('I go to the common room');
    expect(moveOrder('the high lane')).toBe('I go to the high lane');
    expect(moveOrder('Millbrook square')).toBe('I go to Millbrook square');
    expect(src('app.ts')).toMatch(/mapPage\(api, \(order\) => \{ playDraft\.text = order; closeFull\(\); go\('play'\); \}\)/);
  });
});
