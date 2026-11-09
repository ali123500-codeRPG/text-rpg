// Spotting a sneaker is a contest for both sides: the watching player's sense skill is marked too.
import { describe, expect, it } from 'vitest';
import { makeVillage, createRng } from '../harness';
import { spawnNpc } from '../../src/library/spawn';
import { stealthDetect } from '../../src/minds/state';
import { SK } from '../../src/library/skillIds';
import type { GameEvent } from '../../src/types';

describe('the watcher learns', () => {
  it('a thief sneaking in sight marks the player\'s Eyesight when the thief is near its level', () => {
    const s = makeVillage(), p = s.player;
    p.core.skills[SK.eyesight] = { raw: 45, state: 'normal' };
    p.progression!.marks = [];
    const t = spawnNpc(s, 'thief', { id: 'thief_1', zone: p.zone, placeId: p.placeId, bandId: 'thieves', name: 'Sly', storyId: 'test' });
    t.posture = 'stealthy';
    s.actors.push(t);
    const ev = { id: 'e1', turn: s.turn, actorId: t.id, kind: 'wait', zone: p.zone, effects: [], noise: 'silent', visibility: 'normal' } as unknown as GameEvent;
    stealthDetect(s, ev, createRng(2));
    expect(p.progression!.marks).toContain(SK.eyesight);
  });
});
