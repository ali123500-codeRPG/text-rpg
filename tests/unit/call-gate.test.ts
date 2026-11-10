// Q4 (Motion Rules Review): the turn's own calls go ahead of background Planner and Weaver calls in the call slots, so
// how many background calls run never slows the turn the player waits for.
import { describe, expect, it } from 'vitest';
import { callGate } from '../../src/agents/call';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('call slots: turn calls first', () => {
  it('background calls keep one slot free and wait while a turn call runs', async () => {
    const g = callGate(2);
    const started: string[] = [];
    const bg = (name: string) => Promise.resolve(g.enter(true)).then((rel) => { started.push(name); return rel; });
    const a = bg('a'), b = bg('b'); // only one background call at a time with two slots
    await tick();
    expect(started).toEqual(['a']);
    const turn = await g.enter(false); // a turn call never waits
    (await a)();
    await tick();
    expect(started).toEqual(['a']); // b waits behind the running turn call
    turn();
    await tick();
    expect(started).toEqual(['a', 'b']);
    (await b)();
  });

  it('an aborted queued call leaves the queue without taking a slot', async () => {
    const g = callGate(2);
    const first = await g.enter(true);
    const c = new AbortController();
    const queued = Promise.resolve(g.enter(true, c.signal));
    c.abort();
    (await queued)(); // releasing the aborted call's no-op handle frees nothing
    first();
    const next = await g.enter(true);
    next();
    const t = await g.enter(false);
    t();
  });
});
