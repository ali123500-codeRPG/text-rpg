// 46 Stage trim: past MAX_STAGE_ZONES, the farthest zones without engaged actors drop off, their links become
// frontiers, and re-entry loads them with no Weaver call.
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, createRng, place } from '../harness';
import { CONFIG } from '../../src/config';
import { ScenarioDirector, frontiersNearPlayer, trimStage } from '../../src/scenario';
import { VirtualClock } from '../../src/scenario/fixtures';

describe('46 Stage trim', () => {
  it('drops the far field, then reloads it without the Weaver', async () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    CONFIG.MAX_STAGE_ZONES = 6;
    trimStage(s);
    expect(s.stage.zoneIds).toHaveLength(6);
    for (const z of ['field_edge', 'field_mid', 'field_far']) expect(s.stage.zoneIds).not.toContain(z);
    expect(s.places.find((p) => p.id === 'field')!.zones).toHaveLength(3); // still saved on the place page
    const gate = s.zones.find((z) => z.id === 'gate_inner')!;
    expect(gate.links.find((l) => l.to === 'field_edge')!.frontier).toBe(true);

    const weave = vi.fn(async () => null);
    const d = new ScenarioDirector({ weave, clock: new VirtualClock() });
    place(s, 'player', 'gate_inner');
    expect(frontiersNearPlayer(s)).toEqual([]);
    expect(d.afterSave(s)).toEqual([]);
    const r = await d.cross(s, 'field_edge', createRng(1));
    expect(r.outcome).toBe('loaded');
    expect(weave).not.toHaveBeenCalled();
    expect(s.player.zone).toBe('field_edge');
    expect(s.stage.zoneIds).toContain('field_edge');
    expect(gate.links.find((l) => l.to === 'field_edge')!.frontier).toBeUndefined();
    expect(s.zones.find((z) => z.id === 'field_edge')!.links.find((l) => l.to === 'field_mid')!.frontier).toBe(true);
  });
});
