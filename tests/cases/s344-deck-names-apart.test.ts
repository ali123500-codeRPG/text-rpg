// BG-269: with three slimes in view the action deck listed two different slimes both as "The other slime", so the order line
// "Attack the other slime" could mean either. Two of a name still read "a slime" / "the other slime"; three or more are all
// numbered, "the 1st slime", "the 2nd slime", "the 3rd slime" (BF80), so no two entries share a name.
import { describe, expect, it } from 'vitest';
import { beside, makeVillage } from '../harness';
import { buildPlayerView } from '../../src/views';
import { actorById } from '../../src/engine/relations';
import { apart, deck } from '../../src/ui/deck';

describe('344 BG-269: no two deck entries share a name', () => {
  it('two of a name: the other; three or more: the 1st, the 2nd, the 3rd', () => {
    expect(apart(['a slime', 'a slime'])).toEqual(['a slime', 'the other slime']);
    expect(apart(['a slime', 'Hild', 'a slime', 'a slime'])).toEqual(['the 1st slime', 'Hild', 'the 2nd slime', 'the 3rd slime']);
    expect(apart(Array(12).fill('a rat')).slice(9)).toEqual(['the 10th rat', 'the 11th rat', 'the 12th rat']);
    expect(new Set(apart(Array(12).fill('a rat'))).size).toBe(12);
  });

  it('in play: three slimes in reach make three different attack picks and three different order lines', () => {
    const s = makeVillage({ playerZone: 'tav_common', without: ['guard_1', 'trader'] });
    beside(s, 'slime_1', 'player', 0.5); beside(s, 'slime_2', 'player', 0.7);
    const third = structuredClone(actorById(s, 'slime_2')!);
    third.id = 'slime_3'; s.actors.push(third); beside(s, 'slime_3', 'player', 0.9);
    const pv = buildPlayerView(s);
    const attack = deck({ pv, s }).flatMap((g) => g.actions).find((a) => a.kind === 'attack')!;
    const step = attack.steps[0];
    const picks = step.key === 'words' ? [] : step.picks({}).filter((p) => p.id.startsWith('slime'));
    expect(picks.length).toBe(3);
    expect(new Set(picks.map((p) => p.label)).size).toBe(3);
    const lines = picks.map((p) => { const c: Record<string, string> = { target: p.id }; for (const st of attack.steps.slice(1)) if (st.key !== 'words') c[st.key] = st.picks(c)[0].id; return attack.play(c).line; });
    expect(new Set(lines).size).toBe(3);
    expect(lines.join(" / ")).toMatch(/^Attack the 1st slime.* \/ Attack the 2nd slime.* \/ Attack the 3rd slime/);
    expect(picks.map((p) => p.label)).toEqual(['The 1st slime', 'The 2nd slime', 'The 3rd slime']);
  });
});
