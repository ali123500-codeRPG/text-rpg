// LR5: linked perks on the Character sheet. A link the player holds shows its perk, the set it comes from (each perk with
// its ladder place) and whether it was granted beside the set or merged from it (the set asleep); a perk's card names its
// link. A link not yet earned stays unseen, like a sealed milestone (K4).
import { describe, expect, it } from 'vitest';
import { wholeTurn, intent } from '../harness/turn';
import { PK } from '../../src/library/perkIds';
import { LK } from '../../src/library/tableIds';
import { linkNote, linkViews } from '../../src/ui/perks';

describe('linked perks on the Character sheet', () => {
  it('whole turn: owning the set grants the link, which the sheet lists with its set; half a set shows nothing', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    const s = g.game.state()!;
    s.player.core.perks.push({ perkId: PK.dread_presence, source: 'level', gainedTurn: s.turn });
    await g.turn(intent(), 'I look around');
    expect(linkViews(g.game.state()!.player)).toEqual([]);
    expect(linkNote(g.game.state()!.player, PK.dread_presence)).toBeNull();
    g.game.state()!.player.core.perks.push({ perkId: PK.overwhelm, source: 'level', gainedTurn: s.turn });
    await g.turn(intent(), 'I look around');
    const p = g.game.state()!.player;
    const [v] = linkViews(p);
    expect(v).toMatchObject({ id: LK.crushing_presence, name: 'Crushing Presence', kind: 'grant' });
    expect(v.needs.map((n) => [n.name, n.asleep])).toEqual([['Dread Presence', false], ['Overwhelm', false]]);
    expect(v.needs.every((n) => /^\S.* \d+$/.test(n.where))).toBe(true); // "Intimidation 100": skill and milestone
    expect(linkNote(p, PK.dread_presence)).toBe('Linked with Overwhelm: together they grant Crushing Presence.');
  });

});
