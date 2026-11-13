// 40 Nothing hidden in the opening: the NarrationView at scenario start holds no tier, grade, event summary, Weaver note or opening belief.
import { expect, it } from 'vitest';
import type { GameEvent } from '../../src/types';
import { makeVillage, createRng } from '../harness';
import { computePerception, updateBeliefs } from '../../src/perception';
import { buildNarrationView } from '../../src/views';

it('40 Nothing hidden in the opening', () => {
  const s = makeVillage();
  s.stage.tier = 'great_success';
  s.hidden.stage = { eventSummary: 'SUMMARY smugglers meet tonight', challenge: 'major', gain: 'extreme', hiddenTerms: ['smugglers'] };
  s.hidden.weaverNote = 'NOTE the barkeep is the fence';
  updateBeliefs(s, { kind: 'opening', observerId: 'patron_1', aboutId: 'player', status: 'suspicious', zone: 'tav_common' });
  updateBeliefs(s, { kind: 'opening', observerId: 'trader', aboutId: 'player', status: 'aware', zone: 'tav_common' });
  const rng = createRng(1);
  const ev = (id: string, actorId: string, kind: string, zone: string, activity?: string): GameEvent => {
    const e: GameEvent = { id, turn: 0, actorId, kind, zone, effects: [], noise: 'quiet', visibility: 'normal', perception: {}, ...(activity ? { activity } : {}) };
    e.perception = computePerception(e, s, rng);
    return e;
  };
  const events = [ev('arr', 'player', 'arrival', 'tav_common'), ev('p1', 'patron_1', 'presence', 'tav_common', 'drink'), ev('p2', 'trader', 'presence', 'tav_counter', 'tend_counter')];
  const v = buildNarrationView(s, events, null);
  expect(v.events.map((e) => [e.id, e.level, e.activityLook])).toEqual([['arr', 'full', undefined], ['p1', 'full', 'nursing a drink'], ['p2', 'full', 'tending the counter']]);
  const text = JSON.stringify(v);
  expect(text).not.toMatch(/\bextreme\b/); // the grade as a word: the Ordinary archetype's hint says "nothing to extremes"
  for (const w of ['Great Success', 'major', 'moderate', 'SUMMARY', 'smugglers', 'NOTE', 'fence', 'suspicious', 'aware', 'tier', 'grade', 'attention', 'distracted'])
    expect(text).not.toContain(w);
});
