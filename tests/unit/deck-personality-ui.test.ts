// The action deck shaped by personality: code orders the groups and actions by what the character is drawn to, and marks
// an action they are pulled away from "against your nature". Nothing is added or taken away; a middling character keeps the
// plain order.
import { describe, expect, it } from 'vitest';
import { buildPlayerView } from '../../src/views';
import { deck } from '../../src/ui/deck';
import { AGAINST_NATURE, pullOf } from '../../src/ui/ideaLeans';
import { personalityOf } from '../../src/ruleset/personality';
import { PA, VL } from '../../src/library/tableIds';
import { CONFIG } from '../../src/config';
import { wholeTurn, intent } from '../harness/turn';

const kinds = (gs: ReturnType<typeof deck>) => gs.flatMap((g) => g.actions.map((a) => a.kind)).sort();

describe('the action deck by personality', () => {
  it('whole turn: a quiet, cautious character gets Stealth before Fight and Talk marked; the same actions either way', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    await g.turn(intent(), 'I look around');
    const pv = buildPlayerView(s);
    const plain = deck({ pv, s, self: { nerve: 0, traits: {}, values: [] } });
    expect(plain.map((x) => x.group)).toEqual(deck({ pv, s }).map((x) => x.group));
    s.player.core.personality = { nerve: -70, traits: { [PA.sociability]: -80 }, values: [] };
    await g.turn(intent(), 'I look around');
    const shy = deck({ pv: buildPlayerView(s), s, self: personalityOf(s.player) });
    const order = shy.map((x) => x.group);
    expect(order.indexOf('stealth')).toBeLessThan(order.indexOf('fight'));
    expect(order.indexOf('talk')).toBeGreaterThan(order.indexOf('use'));
    const talk = shy.find((x) => x.group === 'talk')!.actions.filter((a) => a.kind === 'talk' || a.kind === 'persuade');
    expect(talk.length).toBeGreaterThan(0);
    for (const a of talk) expect(a.note).toContain(AGAINST_NATURE);
    expect(kinds(shy)).toEqual(kinds(deck({ pv: buildPlayerView(s), s })));
  });

  it('a small lean changes nothing; a held value pulls like a trait', () => {
    const p = { nerve: CONFIG.PERSONALITY_LEAN - 1, traits: {}, values: [] };
    expect(pullOf('fight', p)).toBe(0);
    expect(pullOf('pick_up', { nerve: 0, traits: {}, values: [VL.wealth] })).toBe(CONFIG.IDEA_VALUE_PULL);
  });

  it('a broken nerve keeps its way out first, and Yield says it goes against a proud nature', () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    const out = deck({ pv: buildPlayerView(s), s, broken: true, self: { nerve: 0, traits: { [PA.pride]: 80, [PA.sociability]: 90 }, values: [] } });
    expect(out[0].group).toBe('getaway');
    expect(out[0].actions.find((a) => a.kind === 'yield')!.note).toContain(AGAINST_NATURE);
  });
});
