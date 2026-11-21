// 387 BG-311: a new world's first region call has its own wait at story start, so a slow region call no longer eats
// the Weaver's WEAVER_TIMEOUT and drops the opening to the fallback stage.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { CONFIG } from '../../src/config';
import { TIERS } from '../../src/scales';
import { RK } from '../../src/library/tableIds';
import { ScenarioDirector } from '../../src/scenario';
import { toStoryStart, villageStagePlan, VirtualClock } from '../../src/scenario/fixtures';

const BRIEF = { kind: RK.river_valley, name: 'The Wendvale', look: 'A broad green vale.', settlements: [{ size: 'village', name: 'Thornbury', look: '', start: true }], features: [], beyond: {}, exits: ['n'] };

async function open(regionMs: number, weaveMs: number) {
  const clock = new VirtualClock();
  const s = toStoryStart(makeVillage());
  CONFIG.REGION_SIZE_M = 5000; // the region's size plays no part in its wait; a 10 km one is about 4x slower to draw
  s.regions = undefined;
  const d = new ScenarioDirector({
    clock,
    region: () => clock.sleep(regionMs).then(() => BRIEF),
    weave: (view) => clock.sleep(weaveMs).then(() => villageStagePlan(TIERS.keyOf(view.tier)!)),
  });
  const p = d.storyStart(s, createRng(s.rngState));
  await clock.advance(regionMs);
  await clock.advance(weaveMs);
  return { r: await p, s };
}

describe('387 the region call has its own wait', () => {
  it('a slow region call and a slow Weaver still open on the plan', async () => {
    const regionMs = CONFIG.REGION_TIMEOUT_MS - 1000, weaveMs = CONFIG.WEAVER_TIMEOUT_MS - 1000;
    const { r, s } = await open(regionMs, weaveMs);
    expect(s.regions![0].name).toBe('The Wendvale');
    expect(r.outcome).toBe('applied');
  });
  it('the Weaver past its own wait still falls back', async () => {
    const { r, s } = await open(1000, CONFIG.WEAVER_TIMEOUT_MS + 1000);
    expect(r.outcome).toBe('fallback');
    expect(s.stage.fallback!.reason).toBe('weaver_timeout');
  });
});
