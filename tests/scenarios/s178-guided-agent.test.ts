// 178 Guided autoplay (GA1–GA17): code spots the crossroads a turn brought (a fight others started, bad wounds, a foe's
// yield); the agent is told the kinds it must ask about before moving, and its question is read safely.
import { describe, expect, it } from 'vitest';
import { actor, makeVillage } from '../harness';
import { CROSSROADS, askKey, guidedPrompt, readAsk, spotCrossroads, turnSnap } from '../../src/agents/crossroads';
import { readMove } from '../../src/agents/autopilot';

describe('178 guided agent', () => {
  it('code spots a fight someone else started, once the character is engaged', () => {
    const s = makeVillage({ playerZone: 'street_square', without: ['slime_1', 'slime_2'] });
    const before = turnSnap(s);
    const g = actor(s, 'guard_1');
    g.mind!.overrides = { player: 'hostile' };
    g.mind!.knowledge.player = { status: 'aware', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
    expect(spotCrossroads(before, s, undefined, false).map((c) => c.kind)).toEqual(['fight_started']);
    expect(spotCrossroads(before, s, undefined, true)).toEqual([]); // the watcher already approved the agent's own fight
  });

  it('code spots Wounded and worse, and a part turning Crippled', () => {
    const s = makeVillage({ without: ['slime_1', 'slime_2'] });
    const before = turnSnap(s);
    s.player.core.condition.hpLostPct = 50; // Wounded
    const line = { turn: 1, kind: 'narration' as const, text: '', wounds: [{ id: 'left_arm', from: 'Damaged', to: 'Crippled' }] };
    const got = spotCrossroads(before, s, line, false);
    expect(got.map((c) => c.about)).toEqual(['Wounded', 'left arm Crippled']);
    s.player.core.condition.hpLostPct = 20; // Bruised is no crossroads
    expect(spotCrossroads(turnSnap(makeVillage({ without: ['slime_1', 'slime_2'] })), s, undefined, false)).toEqual([]);
  });

  it('the agent is told what to ask about, the coin limit, what is settled, and a code crossroads to word', () => {
    const s = makeVillage({ without: ['slime_1', 'slime_2'] });
    const p = guidedPrompt(s, [], { orders: 'never kill', settled: ['deal: the barkeep → yes'] });
    for (const c of CROSSROADS.filter((x) => x.by === 'agent')) expect(p).toContain(`- ${c.kind}:`);
    expect(p).toContain('Standing orders from the watcher (always follow them; never ask about what they already settle): never kill');
    expect(p).toContain('Coin limit:');
    expect(p).toContain('deal: the barkeep → yes');
    const must = guidedPrompt(s, [], { mustAsk: { kind: 'badly_hurt', about: 'Wounded', situation: 'your health is now Wounded' } });
    expect(must).toContain('STOP: the watcher must decide');
    expect(guidedPrompt(s, [], { answered: { about: 'the barkeep', words: 'talk her down' } })).toContain('"talk her down"');
  });

  it('a question is read safely; a bad one is no question', () => {
    expect(readAsk({ kind: 'deal', about: 'the barkeep', choices: ['I accept', 'I refuse', 7], pick: 9 })).toEqual({ kind: 'deal', about: 'the barkeep', choices: ['I accept', 'I refuse'], pick: 0 });
    expect(readAsk({ kind: 'nonsense', choices: ['x'] })).toBeNull();
    expect(readAsk({ choices: ['I fight'] }, 'fight_started')?.kind).toBe('fight_started');
    expect(readMove({ ask: { kind: 'kill', about: 'the slime', choices: ['I finish it', 'I let it go'], pick: 1 }, say: 'Finish it?' }))
      .toEqual({ command: '', say: 'Finish it?', ask: { kind: 'kill', about: 'the slime', choices: ['I finish it', 'I let it go'], pick: 1 } });
    expect(askKey('deal', 'The Barkeep')).toBe('deal: the barkeep');
  });
});
