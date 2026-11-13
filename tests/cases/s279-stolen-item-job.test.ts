// BF18 (BG-187): the Weaver can say whom a placed item belongs to; away from them it is on their list of missing things
// (never where it is), so a job can name that exact item, and handing it back completes the job.
import { expect, it } from 'vitest';
import { actor, createRng, makeVillage } from '../harness';
import { resolveSpeech, selectSpokespeople } from '../../src/engine';
import type { AcceptedAgentOutput } from '../../src/engine';
import { buildOppositionView } from '../../src/views';
import { checkStagePlan } from '../../src/agents/schema';
import { applyStagePlan } from '../../src/scenario';
import { toStoryStart, villageStagePlan } from '../../src/scenario/fixtures';
import { RESPONDER_INSTRUCTIONS, WEAVER_SHAPE } from '../../src/agents/prompts';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import type { GameState } from '../../src/types';
import { act, intent, play } from './w4-kit';

const shop = () => {
  const s = makeVillage({ playerZone: 'tav_counter' });
  actor(s, 'patron_1').core.inventory.push({ id: 'charm_1', itemId: IT.lucky_charm, owner: 'trader' });
  return s;
};
function hire(s: GameState) {
  const i = intent({ action: { type: 'talk', skill: SK.persuasion }, spoken: 'I will find it.', addressees: ['trader'] });
  const spokespeople = selectSpokespeople(s, i);
  const exchange = resolveSpeech(s, i, spokespeople, createRng(3));
  const job = { line: 'Find my mother\'s charm and bring it back to me', goal: { kind: 'deliver', item: 'charm_1', qty: 1, to: 'trader' } };
  const reply = { agent: 'responder', actorId: 'trader', output: { action: act('talk', 'player'), dialogue: { line: 'Bring it back.', volume: 'normal' },
    gear: null, stance: null, reveals: [], planUpdate: null, agreement: { with: 'player', text: 'The player brings back the charm.', job } } } as AcceptedAgentOutput;
  play(s, { intent: i, spokespeople, exchange, agentOutputs: [reply] });
}

it('BF18: an owner knows what of theirs is missing, by name, never where it is', () => {
  const s = shop();
  expect(buildOppositionView(s, 'trader').self.missing).toEqual([{ id: 'charm_1', name: 'lucky charm' }]);
  expect(buildOppositionView(s, 'patron_1').self.missing).toBeUndefined();
  expect(JSON.stringify(buildOppositionView(s, 'trader').self.missing)).not.toContain('patron');
});

it('BF18: a job naming the missing item is a typed deliver, and handing it back completes it', () => {
  const s = shop();
  hire(s);
  expect(s.quests[0].goal).toMatchObject({ kind: 'deliver', item: 'charm_1', inst: true, to: 'trader' });
  expect(s.log.some((l) => l.code === 'quest_goal_gap')).toBe(false);
  const charm = actor(s, 'patron_1').core.inventory.find((i) => i.id === 'charm_1')!;
  actor(s, 'patron_1').core.inventory = actor(s, 'patron_1').core.inventory.filter((i) => i !== charm);
  s.player.core.inventory.push(charm);
  play(s, { intent: intent({ action: { type: 'give', target: 'trader', item: 'charm_1' } }) });
  expect(s.quests[0].state).toBe('done');
  expect(buildOppositionView(s, 'trader').self.missing).toBeUndefined(); // back with its owner
});

it('BF18: the Weaver gives a placed item an owner; the job rule points at self.missing', () => {
  const st = toStoryStart(makeVillage());
  const p = villageStagePlan('success');
  p.rewards.push({ item: IT.lucky_charm, place: { carriedBy: 'guard_1' }, owner: 'barkeep' }); // cast keys
  expect(checkStagePlan(JSON.parse(JSON.stringify(p))).value.rewards.at(-1)).toMatchObject({ owner: 'barkeep' });
  applyStagePlan(st, p, { tier: 'success', kind: 'scenario', placeId: 'tavern' }, { entry: 'open' }, createRng(1));
  const holder = st.actors.find((a) => a.core.inventory.some((i) => i.itemId === IT.lucky_charm))!;
  const owner = st.actors.find((a) => a.label === 'the barkeep' || a.names?.current === p.cast.find((c) => c.key === 'barkeep')?.name)!;
  expect(holder.core.inventory.find((i) => i.itemId === IT.lucky_charm)?.owner).toBe(owner.id);
  expect(buildOppositionView(st, owner.id).self.missing?.map((m) => m.name)).toEqual(['lucky charm']);
  expect(WEAVER_SHAPE).toContain('that person knows it is missing');
  expect(RESPONDER_INSTRUCTIONS).toContain('the id of one of self.missing');
});
