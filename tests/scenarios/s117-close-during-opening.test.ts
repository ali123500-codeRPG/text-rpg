// 117 Closing the game during the opening: turn 0 saves nothing until the opening scene is planned
// and narrated, so a game closed then came back to "Create your swordsman". The build is kept until turn 0 is saved;
// reopening starts that opening again.
import { describe, expect, it } from 'vitest';
import { ScriptedClaude } from '../harness';
import { createGame, VirtualClock, type SceneDirector } from '../../src/agents';
import { loadPendingStart, memoryStore } from '../../src/save';
import { SK } from '../../src/library/skillIds';

const build = { name: 'Arden', skills: { [SK.melee_medium]: 50, [SK.block]: 40, [SK.dodge]: 30, [SK.endurance]: 50, [SK.eyesight]: 30, [SK.earshot]: 30, [SK.riposte]: 20 }, tagged: [SK.melee_medium, SK.block, SK.endurance] };
const stuck: SceneDirector = { startStory: () => new Promise(() => {}), afterResolve: async () => [], afterSave: () => {} };

describe('117 close during the opening', () => {
  it('keeps the build while turn 0 runs; a reopened game starts that opening again', async () => {
    const clock = new VirtualClock();
    const store = memoryStore();
    const first = createGame({ client: new ScriptedClaude(clock), clock, store, director: stuck });
    void first.newStory(build);
    await new Promise((r) => setTimeout(r, 0));
    expect((await loadPendingStart(store))?.build.name).toBe('Arden');

    const again = createGame({ client: new ScriptedClaude(clock), clock, store, director: stuck });
    expect(await again.resume()).toBe(true);
    expect(again.state()).not.toBeNull();
    expect(again.busy()).toBe(true);
  });
  it('with no story and nothing pending, resume finds nothing', async () => {
    const clock = new VirtualClock();
    const g = createGame({ client: new ScriptedClaude(clock), clock, store: memoryStore(), director: stuck });
    expect(await g.resume()).toBe(false);
  });
});
