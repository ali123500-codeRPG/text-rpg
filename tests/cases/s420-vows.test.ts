// 420 Vows (D-141, VW1–VW9): a vow form from the Witness is read by code (refused when code can't check it, it is
// already met, or the cap is reached); a sworn vow is checked each turn: kept pays its stake's Thread, broken (a
// restraint's act, a missed deadline, renouncing) takes the same Thread, into debt if need be.
import { describe, expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { CONFIG } from '../../src/config';
import { DAY_MINUTES, now } from '../../src/time';
import { readVow, renounceVow, swearVow, vowRewards, vowXp, type VowForm } from '../../src/engine/vows';
import { getLibrary } from '../../src/library';
import { RW } from '../../src/library/tableIds';
import { IT } from '../../src/library/itemIds';
import { IMPROVISED_ITEM } from '../../src/engine/gear';
import { createRng } from '../harness';
import { charLevel } from '../../src/engine/xp';
import { checkWitness } from '../../src/agents/schema';
import { xpParts } from '../../src/engine/growth';
import type { GameState } from '../../src/types';
import { intent, play } from './w4-kit';

const NO_THEFT: VowForm = { line: 'Steal nothing for three days', goal: { kind: 'restraint', act: 'filch' }, stake: 'II', days: 3 };
const xp = (s: GameState) => s.player.progression!.xp;

describe('420 vows', () => {
  it('VW3/VW4/VW6/VW7: code reads the form, and refuses what it cannot check, a goal already met, a bad deadline or a vow past the cap', () => {
    const s = makeVillage();
    expect(readVow(s, NO_THEFT)).toMatchObject({ vow: { goal: { kind: 'restraint', act: 'filch' }, stake: 'ii', state: 'active' } });
    expect(readVow(s, { ...NO_THEFT, goal: { kind: 'restraint', act: 'sulk' } })).toHaveProperty('error');
    expect(readVow(s, { ...NO_THEFT, goal: { kind: 'level', to: charLevel(s.player) } })).toHaveProperty('error'); // already met
    expect(readVow(s, { ...NO_THEFT, goal: { kind: 'reach', target: 'nowhere' } })).toHaveProperty('error');
    expect(readVow(s, { ...NO_THEFT, days: CONFIG.VOW_DAYS_MAX + 1 })).toHaveProperty('error');
    expect(readVow(s, { ...NO_THEFT, stake: 'IV' })).toHaveProperty('error');
    for (let i = 0; i < CONFIG.VOW_MAX_ACTIVE; i++) expect(swearVow(s, NO_THEFT)).toBeNull();
    expect(swearVow(s, NO_THEFT)).toMatch(/most at once/);
  });

  it('VW5/VW8: a restraint broken by its act, or renounced, takes the stake\'s Thread, into debt', () => {
    const s = makeVillage();
    swearVow(s, { ...NO_THEFT, line: 'No rest for a day', goal: { kind: 'restraint', act: 'rest' } });
    const cost = vowXp(s, 'ii');
    play(s, { intent: intent({ action: { type: 'rest' } }) });
    expect(s.vows![0]).toMatchObject({ state: 'broken', why: 'restraint', xp: cost });
    expect(s.player.progression!.xpLog![0]).toMatchObject({ source: `vow broken:${s.vows![0].id}`, amount: -cost });
    swearVow(s, NO_THEFT);
    s.player.progression!.xp = 0;
    expect(renounceVow(s, s.vows![1].id)).toBe(true);
    expect(s.vows![1]).toMatchObject({ state: 'broken', why: 'renounced' });
    expect(xp(s)).toBe(-vowXp(s, 'ii')); // into debt
    expect(renounceVow(s, s.vows![1].id)).toBe(false); // already broken
    expect(xpParts(s, s.player.progression!.xpLog!, []).filter((p) => p.kind === 'vow')).toHaveLength(2); // VW9 a: each its own row
  });

  it('VW6: at the deadline a clean restraint is kept and pays; a goal not met is broken', () => {
    const s = makeVillage();
    swearVow(s, NO_THEFT);
    swearVow(s, { line: 'Reach level 9', goal: { kind: 'level', to: 9 }, stake: 'I', days: 1 });
    const gain = vowXp(s, 'ii');
    s.clocks.time = now(s) + 4 * DAY_MINUTES;
    play(s, { intent: intent({ action: { type: 'wait' } }) });
    expect(s.vows!.map((v) => [v.state, v.why])).toEqual([['kept', 'deadline'], ['broken', 'deadline']]);
    expect(s.player.progression!.xpLog!.find((x) => x.source.startsWith('vow:'))?.amount).toBe(gain);
  });

  it('VW3: a quest goal met keeps the vow at once and pays its stake', () => {
    const s = makeVillage();
    expect(swearVow(s, { line: 'Stand at the counter', goal: { kind: 'reach', target: 'tav_counter' }, stake: 'I', days: 2 })).toBeNull();
    s.player.zone = 'tav_counter';
    play(s, { intent: intent({ action: { type: 'wait' } }) });
    expect(s.vows![0]).toMatchObject({ state: 'kept', why: 'met', progress: 1 });
    expect(s.player.progression!.xpLog!.find((x) => x.source === `vow:${s.vows![0].id}`)?.amount).toBe(s.vows![0].xp);
  });

  it('VW10/VW14/VW15: a kept vow draws through the nested table until the band\'s Boon is filled, within the margin', () => {
    const s = makeVillage();
    const tables = getLibrary().rewardTables!, kept = tables[RW.vow_items].rows;
    try {
      tables[RW.vow_items].rows = [{ weight: 1, item: IT.healing_draught }]; // Boon 0.5 each
      const n = (stake: 'i' | 'ii' | 'iii') => vowRewards(s, stake, createRng(7)).reduce((t, r) => t + r.qty, 0) * 0.5;
      expect(n('i')).toBeCloseTo(CONFIG.BOON_BUDGET[CONFIG.VOW_STAKE_GAIN.i]);
      expect(n('ii')).toBeCloseTo(CONFIG.BOON_BUDGET[CONFIG.VOW_STAKE_GAIN.ii]);
      tables[RW.vow_items].rows = [{ weight: 1, item: IT.varos_loop }]; // far over any band: put back every time
      expect(vowRewards(s, 'iii', createRng(7))).toEqual([]);
      const budget = CONFIG.BOON_BUDGET, was = budget.major;
      budget.major = 20; // a band it fits: given once, never twice, and never while one is in the world (D-218)
      expect(vowRewards(s, 'iii', createRng(7))).toEqual([{ item: IT.varos_loop, qty: 1 }]);
      s.player.core.inventory.push({ id: 'loop1', itemId: IT.varos_loop });
      expect(vowRewards(s, 'iii', createRng(7))).toEqual([]);
      s.player.core.inventory.pop();
      budget.major = was;
      tables[RW.vow_items].rows = [{ weight: 1, item: IT.healing_draught }];
      swearVow(s, { line: 'Stand at the counter', goal: { kind: 'reach', target: 'tav_counter' }, stake: 'I', days: 2 });
      s.player.zone = 'tav_counter';
      play(s, { intent: intent({ action: { type: 'wait' } }) });
      expect(s.vows![0].items).toEqual([{ item: IT.healing_draught, qty: 4 }]);
      expect(s.player.core.inventory.filter((i) => i.id.startsWith(`vw_${s.vows![0].id}`)).length).toBeGreaterThan(0);
    } finally { tables[RW.vow_items].rows = kept; }
  });

  it('VW16: the Items table every reward type draws from lists every item but Threadbound ones and the improvised bases', () => {
    const lib = getLibrary(), imp = new Set(Object.values(IMPROVISED_ITEM));
    expect(lib.rewardTables![RW.vow_kept].rows).toEqual([{ weight: 3, table: RW.vow_items }, { weight: 1, table: RW.vow_threadbound }]);
    expect(lib.rewardTables![RW.vow_items].rows).toEqual([{ weight: 1, table: RW.items }]);
    expect(lib.rewardTables![RW.vow_threadbound].rows).toEqual([{ weight: 1, table: RW.threadbound }]);
    expect(lib.rewardTables![RW.threadbound].rows.map((r) => r.item).sort()).toEqual(Object.values(lib.items).filter((d) => d.threadbound).map((d) => d.id).sort());
    const listed = lib.rewardTables![RW.items].rows.map((r) => r.item).sort();
    expect(listed).toEqual(Object.values(lib.items).filter((d) => !d.threadbound && !imp.has(d.id)).map((d) => d.id).sort());
  });

  it('VW2: the Witness answer schema keeps the vow form', () => {
    const c = checkWitness({ reply: 'Then swear it.', vow: { ...NO_THEFT, by: null } });
    expect(c.errors).toEqual([]);
    expect(c.value.vow).toMatchObject({ goal: { kind: 'restraint', act: 'filch' }, stake: 'II' });
    expect(checkWitness({ reply: 'What goal?', vow: null }).value.vow).toBeNull();
  });
});
