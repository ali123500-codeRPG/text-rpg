// Ideas shaped by personality: code orders the groups and ideas by what the character is drawn to, and marks an idea they
// are pulled away from "against your nature". Nothing is added or taken away; a middling character keeps the plain order.
import { describe, expect, it } from 'vitest';
import { buildPlayerView } from '../../src/views';
import { ideas } from '../../src/ui/play';
import { AGAINST_NATURE, leanIdeas, pullOf } from '../../src/ui/ideaLeans';
import { personalityOf } from '../../src/ruleset/personality';
import { PA, VL } from '../../src/library/tableIds';
import { CONFIG } from '../../src/config';
import { wholeTurn, intent } from '../harness/turn';

const texts = (gs: { items: { text: string }[] }[]) => gs.flatMap((g) => g.items.map((i) => i.text)).sort();

describe('Ideas by personality', () => {
  it('whole turn: a quiet, cautious character gets Stealth before Fight and Talk marked; the same ideas either way', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    await g.turn(intent(), 'I look around');
    const pv = buildPlayerView(s);
    const plain = ideas(pv, false, false, { nerve: 0, traits: {}, values: [] });
    expect(plain.map((x) => x.group)).toEqual(ideas(pv).map((x) => x.group));
    s.player.core.personality = { nerve: -70, traits: { [PA.sociability]: -80 }, values: [] };
    await g.turn(intent(), 'I look around');
    const shy = ideas(buildPlayerView(s), false, false, personalityOf(s.player));
    const order = shy.map((x) => x.group);
    expect(order.indexOf('Stealth')).toBeLessThan(order.indexOf('Fight'));
    expect(order.indexOf('Talk')).toBeGreaterThan(order.indexOf('Use'));
    const talk = shy.find((x) => x.group === 'Talk')!;
    expect(talk.items.length).toBeGreaterThan(0);
    for (const it of talk.items) expect(it.note).toContain(AGAINST_NATURE);
    for (const it of shy.find((x) => x.group === 'Fight')!.items) expect(it.note ?? '').toContain(AGAINST_NATURE);
    expect(texts(shy)).toEqual(texts(ideas(buildPlayerView(s))));
  });

  it('a small lean changes nothing; a held value pulls like a trait', () => {
    const p = { nerve: CONFIG.PERSONALITY_LEAN - 1, traits: {}, values: [] };
    expect(pullOf('fight', p)).toBe(0);
    expect(pullOf('pick_up', { nerve: 0, traits: {}, values: [VL.wealth] })).toBe(CONFIG.IDEA_VALUE_PULL);
  });

  it('a broken nerve keeps its way out first, and Yield says it goes against a proud nature', () => {
    const groups = [
      { group: 'Get away', key: 'getaway' as const, items: [{ text: 'Yield', kind: 'yield' as const } as { text: string; note?: string; kind: 'yield' | 'flee' }, { text: 'Flee east', kind: 'flee' as const }] },
      { group: 'Talk', key: 'talk' as const, items: [{ text: 'Talk to Bren', kind: 'talk' as const } as { text: string; note?: string; kind: 'talk' }] },
    ];
    const out = leanIdeas(groups, { nerve: 0, traits: { [PA.pride]: 80, [PA.sociability]: 90 }, values: [] });
    expect(out[0].group).toBe('Get away');
    expect(out[0].items.find((i) => i.text === 'Yield')!.note).toBe(AGAINST_NATURE);
    expect(out[0].items[0].text).toBe('Flee east');
  });
});
