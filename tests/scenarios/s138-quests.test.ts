// 138 Quests (OQ-28, D-105, QT1–QT28): a job an NPC gives the player in a deal, made only when the giver hears the
// player accept; one open job per giver; the line is leak-scanned; code checks typed goals from events, hands the job in
// when the player next talks to the giver, pays XP from the quests' own table, locks the deal, tracks the promised pay
// and the deadline, links follow-ups, and steps the giver's stance.
import { describe, expect, it } from 'vitest';
import { actor, createRng, makeVillage } from '../harness';
import { resolveSpeech, selectSpokespeople } from '../../src/engine';
import type { AcceptedAgentOutput } from '../../src/engine';
import { abandonQuest, pinQuest, unpaidQuests, updateQuests } from '../../src/engine/quests';
import { stance } from '../../src/engine/relations';
import { checkResponder } from '../../src/agents/schema';
import { buildOppositionView, questGoalText } from '../../src/views';
import { CONFIG } from '../../src/config';
import { DAY_MINUTES, now } from '../../src/time';
import { RC } from '../../src/library/raceIds';
import { IT } from '../../src/library/itemIds';
import { SK } from '../../src/library/skillIds';
import type { GameEvent, GameState, JobOffer, ResponderOutput } from '../../src/types';
import { act, intent, play } from './w4-kit';

const SLIMES: JobOffer = { line: 'Clear the slimes from the field', goal: { kind: 'defeat', target: 'slimes', count: 2 }, pay: { coin: 10 } };
const codes = (s: GameState, code: string) => s.log.filter((l) => l.code === code);

/** the player talks to Mags at the counter; her Responder answers with `out` */
function talk(s: GameState, out: Partial<ResponderOutput> = {}, spoken = 'All right, I will do it.'): GameEvent[] {
  const i = intent({ action: { type: 'talk', skill: SK.persuasion }, spoken, addressees: ['trader'] });
  const spokespeople = selectSpokespeople(s, i);
  const exchange = resolveSpeech(s, i, spokespeople, createRng(3));
  const reply = { agent: 'responder', actorId: 'trader', output: { action: act('talk', 'player'), dialogue: { line: 'Good. Off you go.', volume: 'normal' },
    gear: null, stance: null, reveals: [], planUpdate: null, ...out } } as AcceptedAgentOutput;
  return play(s, { intent: i, spokespeople, exchange, agentOutputs: [reply] });
}
const offer = (job: JobOffer) => ({ agreement: { with: 'player', text: 'The player does the job; Mags pays.', job } });
const shop = () => makeVillage({ playerZone: 'tav_counter' });

describe('138 quests', () => {
  it('QT1/QT3/QT9/QT22: an accepted job becomes a quest in a locked deal, its level from the gain grade', () => {
    const s = shop();
    talk(s, offer(SLIMES));
    const [q] = s.quests;
    expect(q).toMatchObject({ state: 'active', text: SLIMES.line, giver: 'trader', goal: { kind: 'defeat', by: 'race', of: RC.slime, count: 2 },
      level: CONFIG.QUEST_GAIN_LEVEL.moderate, pay: { coin: 10 }, paid: { coin: 0, qty: 0 } });
    expect(s.hidden.agreements?.[0].id).toBe(q.dealId);
    expect(questGoalText(s, q)).toBe('Slimes 0 / 2');
    talk(s, { endAgreements: [{ id: q.dealId, outcome: 'broken' }] }, 'Never mind.');
    expect(s.hidden.agreements).toHaveLength(1);
    expect(codes(s, 'quest_deal_locked')).toHaveLength(1);
  });

  it('QT3/QT4/QT5/QT27: unheard, leaking or second jobs make no quest; "other" logs a goal gap', () => {
    const s = shop();
    // no words from the player this turn: the deal stands, the quest does not
    play(s, { agentOutputs: [{ agent: 'planner', actorId: 'trader', output: { action: act('hold'), dialogue: { line: 'Clear the field for me.', volume: 'normal' },
      gear: null, stance: null, planUpdate: null, ...offer(SLIMES) } } as AcceptedAgentOutput] });
    expect(s.quests).toEqual([]);
    expect(codes(s, 'quest_refused')[0].detail).toMatchObject({ reason: 'not_heard' });
    s.hidden.stage.hiddenTerms = ['smugglers'];
    talk(s, offer({ ...SLIMES, line: 'Scare off the smugglers' }));
    expect(codes(s, 'quest_refused')[0].detail).toMatchObject({ reason: 'leak' });
    talk(s, offer({ line: 'Cheer up my sister', goal: { kind: 'other' } }));
    expect(s.quests[0].goal).toEqual({ kind: 'other' });
    expect(codes(s, 'quest_goal_gap')[0].detail).toMatchObject({ text: 'Cheer up my sister', giver: 'trader' });
    talk(s, offer(SLIMES));
    expect(s.quests).toHaveLength(1);
    expect(codes(s, 'quest_refused')[0].detail).toMatchObject({ reason: 'open_quest' });
  });

  it('QT6/QT8/QT13: defeats count, the job is handed in by talking to the giver: XP, friendlier, deal ended', () => {
    const s = shop();
    talk(s, offer(SLIMES));
    const q = s.quests[0];
    updateQuests(s, [], [actor(s, 'slime_1')]);
    expect(q.progress).toBe(1);
    updateQuests(s, [], [actor(s, 'slime_2')]);
    expect(q.state).toBe('ready');
    expect(buildOppositionView(s, 'trader').jobs).toEqual([{ id: q.id, text: q.text, state: 'active', owed: 'Owed 1 silver' }]); // she doesn't know yet
    const before = stance(s, actor(s, 'trader'), s.player);
    const xp = s.player.progression!.xp;
    talk(s, {}, 'The slimes are gone.');
    expect(q.state).toBe('done');
    expect(s.player.progression!.xpLog?.some((x) => x.source === `quest:${q.id}` && x.amount === CONFIG.QUEST_REWARD_XP[q.level])).toBe(true);
    expect(s.player.progression!.xp).not.toBe(xp);
    expect(stance(s, actor(s, 'trader'), s.player)).not.toBe(before);
    expect(s.hidden.agreements).toEqual([]);
    expect(buildOppositionView(s, 'trader').jobs?.[0]).toMatchObject({ state: 'done', owed: 'Owed 1 silver' });
  });

  it('QT10/QT23: gifts from the giver count toward the promise; still owed when the talk ends, it is unpaid', () => {
    const s = shop();
    talk(s, offer(SLIMES));
    const q = s.quests[0];
    actor(s, 'trader').core.inventory.push({ id: 'till', itemId: IT.coin, qty: 30 });
    play(s, { agentOutputs: [{ agent: 'planner', actorId: 'trader', output: { action: act('give', 'player', { item: 'till', qty: 4 }), dialogue: null, gear: null, stance: null, planUpdate: null } } as AcceptedAgentOutput] });
    expect(q.paid).toEqual({ coin: 4, qty: 0 });
    q.state = 'done';
    unpaidQuests(s);
    expect(q.unpaid).toBe(true);
    expect(s.hidden.memory.trader.at(-1)!.text).toContain('Did not pay');
    expect(buildOppositionView(s, 'trader').jobs?.[0].owed).toBe('Unpaid 6 copper');
  });

  it('QT25: a goal not met by the deadline fails, and the giver cools', () => {
    const s = shop();
    talk(s, offer({ ...SLIMES, due: { days: 0, by: 'night' } }));
    const q = s.quests[0];
    expect(q.dueBy).toBe('night');
    const before = stance(s, actor(s, 'trader'), s.player);
    s.clocks.time = q.due! + 1;
    updateQuests(s, [], []);
    expect(q.state).toBe('failed');
    expect(stance(s, actor(s, 'trader'), s.player)).not.toBe(before);
    expect(now(s)).toBeGreaterThan(q.due!);
    // a deadline without a time of day is the end of that day
    const t = shop();
    talk(t, offer({ ...SLIMES, due: { days: 1 } }));
    expect(t.quests[0].due! % DAY_MINUTES).toBe(0);
  });

  it('QT8/QT11: delivering to the giver finishes at once; a dead giver fails the job', () => {
    const s = shop();
    talk(s, offer({ line: 'Bring me two healing draughts', goal: { kind: 'deliver', item: IT.healing_draught, qty: 2, to: 'trader' } }));
    s.player.core.inventory.push({ id: 'dr', itemId: IT.healing_draught, qty: 2 });
    play(s, { intent: intent({ action: { type: 'give', target: 'trader', item: 'dr', qty: 2 } }) });
    expect(s.quests[0].state).toBe('done');
    const t = shop();
    talk(t, offer(SLIMES));
    actor(t, 'trader').core.condition.hpLostPct = 1000;
    updateQuests(t, [], []);
    expect(t.quests[0]).toMatchObject({ state: 'failed' });
  });

  it('QT12/QT22/QT6: abandoning cools the giver; the giver calls off in words the player hears; "other" is judged by the giver', () => {
    const s = shop();
    talk(s, offer(SLIMES));
    const before = stance(s, actor(s, 'trader'), s.player);
    expect(abandonQuest(s, s.quests[0].id)).toBe(true);
    expect(s.quests[0].state).toBe('abandoned');
    expect(stance(s, actor(s, 'trader'), s.player)).not.toBe(before);
    expect(s.hidden.memory.trader.at(-1)!.text).toContain('gave up the job');
    talk(s, offer({ line: 'Cheer up my sister', goal: { kind: 'other' } }));
    const q2 = s.quests[1];
    talk(s, { questEnd: { id: q2.id, outcome: 'called_off' } }, 'Any news?');
    expect(q2.state).toBe('called_off');
    talk(s, offer({ line: 'Find my lost cat', goal: { kind: 'other' } }));
    talk(s, { questEnd: { id: s.quests[2].id, outcome: 'done' } }, 'I found your cat.');
    expect(s.quests[2].state).toBe('done');
    talk(s, offer(SLIMES));
    talk(s, { questEnd: { id: s.quests[3].id, outcome: 'done' } }, 'Done.'); // a typed goal is code's to judge
    expect(s.quests[3].state).toBe('active');
    expect(codes(s, 'invalid_quest_end')).toHaveLength(1);
  });

  it('QT24: a follow-up from the giver in the same talk links to the job just handed in; pins are one at a time', () => {
    const s = shop();
    talk(s, offer({ line: 'Find my lost cat', goal: { kind: 'other' } }));
    talk(s, { questEnd: { id: s.quests[0].id, outcome: 'done' } }, 'Here is your cat.');
    talk(s, offer(SLIMES), 'What else?');
    expect(s.quests[1].after).toBe(s.quests[0].id);
    pinQuest(s, s.quests[1].id);
    expect(s.quests[1].pinned).toBe(true);
    pinQuest(s, s.quests[1].id);
    expect(s.quests[1].pinned).toBeUndefined();
  });

  it('the agent schema reads a job and a quest end', () => {
    const r = checkResponder({ action: act('talk', 'player'), dialogue: null, gear: null, stance: null, planUpdate: null, reveals: [],
      agreement: { with: 'player', text: 'a deal', job: { line: 'x', goal: { kind: 'reach', target: 'field_far' }, due: { days: 2, by: 'Dusk' } } },
      questEnd: { id: 'quest_1_trader', outcome: 'called_off' } });
    expect(r.errors).toEqual([]);
    expect(r.value.agreement?.job?.due).toEqual({ days: 2, by: 'dusk' });
  });
});
