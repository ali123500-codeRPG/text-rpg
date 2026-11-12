// 46 Saved zone re-entry: a zone saved on its place page but off the stage is linked by a frontier and loads again
// with no Weaver call.
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, createRng, place } from '../harness';
import { ScenarioDirector, frontiersNearPlayer } from '../../src/scenario';
import { VirtualClock } from '../../src/scenario/fixtures';

describe('46 Saved zone re-entry', () => {
  it('reloads the saved field without the Weaver', async () => {
    const s = makeVillage({ playerZone: 'tav_common' });
    // the field is off the stage but saved on its place page; links into it are frontiers
    const field = ['field_edge', 'field_mid', 'field_far'];
    s.stage.zoneIds = s.stage.zoneIds.filter((id) => !field.includes(id));
    s.zones = s.zones.filter((z) => !field.includes(z.id));
    for (const z of s.zones) for (const l of z.links) if (field.includes(l.to)) l.frontier = true;
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
