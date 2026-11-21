// 27 Story start: turn 0 makes one event roll, one Weaver call (and one Narrator call), and is saved as turn 0.
// W6 part: the director runs setup alone as turn 0. The Narrator call and the save belong to the pipeline (W7).
// BG-32 (was s184): the story starts at a bare place node; the plan's place of the same key fills it in, never a second one.
import { TIERS } from '../../src/scales';
import { describe, expect, it, vi } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { ruleset } from '../../src/ruleset';
import { ScenarioDirector } from '../../src/scenario';
import { toStoryStart, villageStagePlan, VirtualClock } from '../../src/scenario/fixtures';

describe('27 Story start', () => {
  it('turn 0: one event roll, one Weaver call, the village stage on the start place (never doubled, BG-32), opening events', async () => {
    const roll = vi.spyOn(ruleset, 'eventRoll');
    const weave = vi.fn(async (view: { tier: string }) => villageStagePlan(TIERS.keyOf(view.tier)!));
    const s = toStoryStart(makeVillage());
    const d = new ScenarioDirector({ weave, clock: new VirtualClock() });
    const r = await d.storyStart(s, createRng(s.rngState));
    expect(roll).toHaveBeenCalledTimes(1);
    expect(weave).toHaveBeenCalledTimes(1);
    expect(r.outcome).toBe('applied');
    expect(s.turn).toBe(0);
    expect(s.stage.scenarioStartTurn).toBe(0);
    expect(s.player.zone).toBe('tav_common');
    expect(r.eventRoll).toBe(d.lastEventRoll);
    expect(r.events[0].kind).toBe('arrival');
    expect(s.events).toEqual(r.events);
    const taverns = s.places.filter((p) => p.id.startsWith('tavern'));
    expect(taverns.map((p) => p.id)).toEqual(['tavern']);
    expect(taverns[0]).toMatchObject({ names: { current: 'The Crooked Kettle' }, parentId: 'village' });
    expect(taverns[0].bare).toBeUndefined();
    expect(taverns[0].zones.length).toBeGreaterThan(0);
    expect(s.player.placeId).toBe('tavern');
    roll.mockRestore();
  });

  it('BG-1549: the start view claims no place for the player, and the plan\'s arriveAt is where they start', async () => {
    const weave = vi.fn(async (view: { tier: string; player: { standsIn: unknown } }) => {
      expect(view.player.standsIn).toBeNull();
      return { ...villageStagePlan(TIERS.keyOf(view.tier)!), arriveAt: 'field_mid' };
    });
    const s = toStoryStart(makeVillage());
    await new ScenarioDirector({ weave, clock: new VirtualClock() }).storyStart(s, createRng(s.rngState));
    expect(weave).toHaveBeenCalledTimes(1);
    expect(s.player.zone).toBe('field_mid');
  });
});
