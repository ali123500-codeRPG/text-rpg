// TQ5 completeness table: every action either actor kind can take has a row here, with its decisions made. A new action
// (or a change to one of these rules) fails CI until its row says what it needs and who can do it, so a rule is never
// fixed for one action and forgotten for its siblings (BG-74, BG-78, BG-80, BG-83 to BG-91).
import { describe, expect, it } from 'vitest';
import { NPC_ACTIONS, PARSER_ACTIONS } from '../../src/types';
import { NEEDS } from '../../src/engine/merge';

type Row = {
  /** FR4 reach (NEEDS): voice = within earshot, grip = within arm's reach, weapon = within the weapon's reach */
  need: 'voice' | 'grip' | 'weapon' | 'none';
  /** who can take it; one side only says why */
  who: 'both' | `player only: ${string}` | `npc only: ${string}`;
};

const ROWS: Record<string, Row> = {
  attack: { need: 'weapon', who: 'both' },
  hide: { need: 'none', who: 'both' },
  sneak: { need: 'none', who: 'both' },
  vanish: { need: 'none', who: 'both' },
  search: { need: 'none', who: 'both' },
  talk: { need: 'voice', who: 'both' },
  persuade: { need: 'voice', who: 'both' },
  deceive: { need: 'voice', who: 'both' },
  barter: { need: 'voice', who: 'both' },
  intimidate: { need: 'voice', who: 'both' },
  use_item: { need: 'grip', who: 'both' }, // BF13: a healing item on someone else is used within arm's reach of them
  equip: { need: 'none', who: 'both' },
  give: { need: 'grip', who: 'both' },
  pick: { need: 'grip', who: 'both' },
  other: { need: 'none', who: 'both' },
  stash: { need: 'none', who: 'player only: not built for NPCs yet' },
  buy: { need: 'voice', who: 'player only: NPCs trade through barter' },
  sell: { need: 'voice', who: 'player only: NPCs trade through barter' },
  observe: { need: 'none', who: 'player only: NPCs see through their views every turn' },
  interact: { need: 'grip', who: 'player only: not built for NPCs yet' },
  rest: { need: 'none', who: 'player only: NPC rest comes from routines' },
  wait: { need: 'none', who: 'player only: an NPC holds' },
  sleep: { need: 'none', who: 'player only: NPC sleep comes from routines' },
  open: { need: 'grip', who: 'both' }, // BG-173: an NPC opens its own chest
  restrain: { need: 'grip', who: 'player only: not built for NPCs yet' },
  filch: { need: 'grip', who: 'both' }, // FL7: NPCs filch too
  move: { need: 'none', who: 'npc only: the player moves in the move slot' },
  hold: { need: 'none', who: 'npc only: the player waits' },
  call_help: { need: 'none', who: 'npc only: the player shouts' },
  flee: { need: 'none', who: 'npc only: the player moves away' },
};

const player = new Set<string>(PARSER_ACTIONS), npc = new Set<string>(NPC_ACTIONS);
const all = [...new Set([...PARSER_ACTIONS, ...NPC_ACTIONS])];

describe('action completeness table (TQ5)', () => {
  it('every action of the Parser and of NPC orders has a row, and no row is left over', () => {
    expect(all.filter((t) => !ROWS[t]), 'add a row to ROWS for each new action').toEqual([]);
    expect(Object.keys(ROWS).filter((t) => !all.includes(t as never))).toEqual([]);
  });
  it.each(all)('%s: reach need matches NEEDS', (t) => expect(NEEDS[t] ?? 'none').toBe(ROWS[t].need));
  it.each(all)('%s: who can take it matches the Parser and NPC lists', (t) => {
    const who = player.has(t) && npc.has(t) ? 'both' : player.has(t) ? 'player only' : 'npc only';
    expect(ROWS[t].who.split(':')[0]).toBe(who);
  });
});
