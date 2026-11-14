// The class tree: links come from the library's unlock rules, the tree shows the classes you have and the next step from
// each, dead ends are marked, and every class keeps one lane across the tier bands so a link runs straight across; a gold thread follows
// the character's own path.
import { describe, expect, it } from 'vitest';
import { classLinks, classSource, classTree, classPath, classThread, lanes } from '../../src/ui/classTree';
import { wholeTurn } from '../harness/turn';
import { intent } from '../cases/w4-kit';
import { getLibrary } from '../../src/library';
import { CL } from '../../src/library/classIds';
import { levelTarget, spendXp } from '../../src/engine/xp';

describe('class tree', () => {
  it('links come from the unlock rules: Commoner opens A Nobody, Trader opens Merchant, both by their capstone', () => {
    const links = classLinks();
    expect(links).toContainEqual(expect.objectContaining({ from: CL.commoner, to: CL.a_nobody }));
    expect(links).toContainEqual(expect.objectContaining({ from: CL.trader, to: CL.merchant }));
    for (const l of links.filter((x) => x.from === CL.trader || x.from === CL.commoner)) expect(l.via).toMatch(/capstone/);
  });

  it('classes that no class opens name where they come from', () => {
    const lib = getLibrary().classes;
    expect(classSource(lib[CL.swordsman])).toMatch(/Parry 40/);
    expect(classSource(lib[CL.commoner])).toBe('any class at its top level');
    expect(classSource(lib[CL.blessed_by_imbra])).toMatch(/blessing from Imbra/);
    expect(classSource(lib[CL.a_nobody])).toBeNull(); // Commoner opens it; being a start does not count then
  });

  it('whole turn: the tree shows your classes and the next step from each; dead ends are marked; the class card picks the next level', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    await g.turn(intent({ action: { type: 'wait' } }));
    const s = g.game.state()!, p = s.player;
    p.core.classes = [{ classId: CL.commoner, state: 'previous', level: 5 }, { classId: CL.trader, state: 'current', level: 2 }, { classId: CL.swordsman, state: 'unlocked', level: 0 }];
    const { nodes, links } = classTree(p);
    const by = (id: string) => nodes.find((n) => n.id === id);
    expect(by(CL.merchant)?.shown).toBe('next');
    expect(by(CL.a_nobody)?.shown).toBe('next');
    expect(by(CL.guard)).toBeUndefined(); // two steps away or from skills only: not shown
    expect(by(CL.merchant)?.deadEnd).toBe(true);
    expect(by(CL.swordsman)?.deadEnd).toBe(true);
    expect(by(CL.trader)?.deadEnd).toBe(false);
    expect(by(CL.commoner)?.pickable).toBe(false); // left behind, at its top level
    expect(by(CL.trader)?.target).toBe(true);
    // the thread: where the character started and each class they moved on to
    expect(classPath(p)).toEqual([CL.commoner, CL.trader]);
    expect(classThread(p)).toEqual([{ from: CL.commoner, to: CL.trader, planned: false }]);
    // the class card's "Next level goes here": the thread's next stretch is drawn, dashed until the level lands
    p.progression!.nextClass = CL.swordsman;
    expect(classThread(p)).toContainEqual({ from: CL.trader, to: CL.swordsman, planned: true });
    spendXp(s);
    expect(levelTarget(p)?.classId).toBe(CL.swordsman);
    expect(classTree(p).nodes.find((n) => n.id === CL.swordsman)?.target).toBe(true);
    // one lane per class across the bands: a link runs straight across, and a band it skips keeps that lane free
    const { lane: col } = lanes(nodes, links);
    expect(col.get(CL.merchant)).toBe(col.get(CL.trader));
    expect(col.get(CL.a_nobody)).toBe(col.get(CL.commoner));
    const trained = nodes.filter((n) => n.tier === 'tier_1').map((n) => col.get(n.id));
    expect(trained).not.toContain(col.get(CL.commoner));
    for (const t of new Set(nodes.map((n) => n.tier))) {
      const cs = nodes.filter((n) => n.tier === t).map((n) => col.get(n.id));
      expect(new Set(cs).size).toBe(cs.length);
    }
  });

  it('the thread follows the level log: a class levelled after another comes after it, and a link it follows is its stretch', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    await g.turn(intent({ action: { type: 'wait' } }));
    const p = g.game.state()!.player;
    p.core.classes = [{ classId: CL.a_nobody, state: 'current', level: 1 }, { classId: CL.commoner, state: 'previous', level: 5 }];
    p.progression!.xpLog = [{ source: 'level', amount: 0, turn: 1, levelUp: { classId: CL.commoner, level: 5 } }, { source: 'level', amount: 0, turn: 2, levelUp: { classId: CL.a_nobody, level: 6 } }];
    expect(classPath(p)).toEqual([CL.commoner, CL.a_nobody]);
    const t = classThread(p);
    expect(t).toEqual([{ from: CL.commoner, to: CL.a_nobody, planned: false }]);
    expect(classTree(p).links).toContainEqual(expect.objectContaining({ from: t[0].from, to: t[0].to }));
  });

  it('a class whose capstone can open every class is not a dead end', async () => {
    const g = wholeTurn({ playerZone: 'tav_common', without: ['slime_1', 'slime_2'] });
    await g.turn(intent({ action: { type: 'wait' } }));
    const p = g.game.state()!.player;
    p.core.classes = [{ classId: CL.late_bloomer, state: 'current', level: 1 }];
    const n = classTree(p).nodes.find((x) => x.id === CL.late_bloomer)!;
    expect(n.opensAll).toBe(true);
    expect(n.deadEnd).toBe(false);
  });
});
