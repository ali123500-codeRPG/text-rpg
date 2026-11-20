// 370 Tactics on NPCs (TC4 a, TC9 a): roles carry Tactics skills (Soldier, Leader, Hunter, Sneak High; Skirmisher and
// beasts Moderate, beasts only where their race can learn the tree), and the Planner's tactics word comes from the NPC's
// own Battle Sense; bands carry no tactics word.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { buildActorView, buildDialogueView } from '../../src/views';
import { tacticsWord } from '../../src/views/tactics';
import { formatOppositionView } from '../../src/agents/format';
import { CONFIG } from '../../src/config';
import { SK } from '../../src/library/skillIds';


describe('370 Tactics on NPCs', () => {

  it('TC4 a: the tactics word steps at CONFIG.TACTICS_FROM, reaches the Planner, never the Voice', () => {
    const s = makeVillage();
    const g = s.actors.find((a) => a.id === 'guard_1')!;
    const at = (v: number) => { g.core.skills[SK.battle_sense] = { raw: v, state: 'normal' }; return tacticsWord(g); };
    expect([at(0), at(CONFIG.TACTICS_FROM.competent - 1), at(CONFIG.TACTICS_FROM.competent), at(CONFIG.TACTICS_FROM.cunning)]).toEqual(['simple', 'simple', 'competent', 'cunning']);
    expect(buildActorView(s, g.id).tacticsWord).toBe('cunning');
    const text = formatOppositionView(buildActorView(s, g.id));
    expect(text).toContain('cunning');
    expect(text).not.toContain('tacticsWord');
    expect('tacticsWord' in buildDialogueView(s, g.id, [])).toBe(false);
    expect('tactics' in buildActorView(s, g.id).band).toBe(false);
  });
});
