// Skill IDs became numbers: an older save's name-keyed skills load under their numbers.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { memoryStore, saveTurn, loadStory } from '../../src/save';
import { getLibrary } from '../../src/library';
import { SK } from '../../src/library/skillIds';

describe('old skill IDs', () => {
  it('a save with sight and melee_medium loads them as Eyesight and Medium weapons', async () => {
    const s = makeVillage();
    const p = s.player;
    p.core.skills = { sight: { raw: 33, state: 'normal' }, melee_medium: { raw: 51, state: 'tagged' } } as typeof p.core.skills;
    const st = memoryStore();
    await saveTurn(st, s, { storyId: s.storyId, turn: 0, libraryVersion: s.libraryVersion, rngBefore: 0, playerInput: '', agentLog: [], events: [], factsAdded: [] });
    const { state } = await loadStory(st, 'test', getLibrary());
    expect(state.player.core.skills[SK.eyesight]).toEqual({ raw: 33, state: 'normal' });
    expect(state.player.core.skills[SK.melee_medium]).toEqual({ raw: 51, state: 'tagged' });
    expect(state.player.core.skills.sight).toBeUndefined();
  });
});
