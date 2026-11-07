// 32 Late extension: the player crosses before the extension returns; the turn waits for it, and no fallback is used.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { CONFIG } from '../../src/config';
import { SceneDirector } from '../../src/scene';
import { grovePlan, VirtualClock } from '../../src/scene/fixtures';

describe('32 Late extension', () => {
  it('waits for the held call, however late', async () => {
    const s = makeVillage({ playerZone: 'field_far' });
    const clock = new VirtualClock();
    const late = CONFIG.WEAVER_TIMEOUT_MS * 2; // WEAVER_TIMEOUT is scene start only
    const d = new SceneDirector({ weave: () => clock.sleep(late).then(() => grovePlan()), clock });
    d.afterSave(s);
    let done = false;
    const crossing = d.cross(s, 'woods', createRng(s.rngState)).then((r) => ((done = true), r));
    await clock.advance(late - 1);
    expect(done).toBe(false);
    await clock.advance(1);
    const r = await crossing;
    expect(r.outcome).toBe('applied');
    expect(s.stage.fallback).toBeUndefined();
    expect(s.player.zone).toBe('grove');
  });
});
