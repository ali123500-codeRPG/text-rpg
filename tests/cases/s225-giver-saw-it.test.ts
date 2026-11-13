// BF6 (BG-129): Marta's slime job closed as handed in the moment the player spoke to her, though she never saw the kill,
// so she refused to pay for a job the game called done. The giver knows a goal is met only by perceiving the deed;
// talking to her hands it in only then. Otherwise her agent judges the player's report (questEnd done).
import { describe, expect, it } from 'vitest';
import type { GameEvent, Quest } from '../../src/types';
import { makeVillage } from '../harness';
import { handInQuests, updateQuests } from '../../src/engine/quests';

const setUp = () => {
  const s = makeVillage({ without: ['guard_1', 'patron_1'] });
  const q: Quest = { id: 'q1', state: 'active', text: 'kill the slime', giver: 'trader', dealId: 'd1', goal: { kind: 'defeat', by: 'actor', of: 'slime_1', count: 1 }, progress: 0, level: 'i' as Quest['level'], startTurn: 0 };
  s.quests.push(q);
  const slime = s.actors.find((a) => a.id === 'slime_1')!;
  const blow = (seen: boolean) => ({ id: 't1.1', turn: 1, actorId: s.player.id, kind: 'attack', target: slime.id, zone: slime.zone, effects: [], noise: 'normal', visibility: 'normal',
    perception: seen ? { trader: { level: 'full', cue: 'sight' } } : {} }) as unknown as GameEvent;
  return { s, q, slime, blow };
};

describe('BF6 a giver hands in only what it saw done', () => {
  it('a kill the giver saw is handed in by talking to her', () => {
    const { s, q, slime, blow } = setUp();
    updateQuests(s, [blow(true)], [slime]);
    expect(q).toMatchObject({ state: 'ready', giverSaw: true });
    handInQuests(s, () => true);
    expect(q.state).toBe('done');
  });
  it('a kill she did not see stays hers to judge', () => {
    const { s, q, slime, blow } = setUp();
    updateQuests(s, [blow(false)], [slime]);
    expect(q).toMatchObject({ state: 'ready', giverSaw: false });
    handInQuests(s, () => true);
    expect(q.state).toBe('ready');
  });
});
