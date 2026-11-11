// Zone height: stairs change height, never distance across the map; inferred from exit words when the Weaver gives none.
import { describe, it, expect } from 'vitest';
import { verticalOf, inferHeights } from '../../src/scene/heights';
import { CONFIG } from '../../src/config';
import type { GameState, Zone } from '../../src/types';

const zone = (id: string, links: [string, string][], extra: Partial<Zone> = {}): Zone =>
  ({ id, placeId: 'inn', name: id, look: '', links: links.map(([to, label]) => ({ to, label, sight: false })), cover: 'none', light: 'dim', groundItems: [], ...extra });
const world = (zones: Zone[]) => ({ places: [{ id: 'inn', zones }] }) as unknown as GameState;

describe('zone heights', () => {
  it('reads up and down from exit words', () => {
    expect(verticalOf('the stairs up')).toBe(1);
    expect(verticalOf('up to the loft')).toBe(1);
    expect(verticalOf('the cellar hatch')).toBe(-1);
    expect(verticalOf('downstairs')).toBe(-1);
    expect(verticalOf('the north gate')).toBe(0);
    expect(verticalOf('the kitchen door')).toBe(0);
  });

  it('a storey up the stairs, down the hatch, level through doors', () => {
    const yard = zone('yard', [['hall', 'the front door']], { outdoor: true });
    const hall = zone('hall', [['yard', 'the front door'], ['landing', 'the stairs up'], ['cellar', 'the cellar hatch']]);
    const landing = zone('landing', [['hall', 'hall'], ['bedroom', 'a side door']]);
    const bedroom = zone('bedroom', [['landing', 'landing']]);
    const cellar = zone('cellar', [['hall', 'hall']]);
    const zs = [landing, bedroom, cellar, hall, yard];
    inferHeights(world(zs), zs);
    expect(yard.height ?? 0).toBe(0);
    expect(hall.height ?? 0).toBe(0);
    expect(landing.height).toBe(CONFIG.STOREY_HEIGHT);
    expect(bedroom.height).toBe(CONFIG.STOREY_HEIGHT);
    expect(cellar.height).toBe(-CONFIG.STOREY_HEIGHT);
  });

  it('a height the Weaver gave stands, and zones beyond it build on it', () => {
    const base = zone('base', [['top', 'the tower stair']], { outdoor: true });
    const top = zone('top', [['base', 'base'], ['roof', 'the ladder up']], { height: 20 });
    const roof = zone('roof', [['top', 'top']]);
    const zs = [base, top, roof];
    inferHeights(world(zs), zs);
    expect(top.height).toBe(20);
    expect(roof.height).toBe(20 + CONFIG.STOREY_HEIGHT);
  });
});
