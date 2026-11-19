// A3/A3b: a move with a limit stays on the deck, dimmed, with a mark (a ring filled by the share of the wait gone, or a
// hollow circle with a slash once used this fight); the words are only its tip, and it is never suggested or picked.
// C7: a quest ready to hand in shows by marks: a gold check on its Quests row, the Play quest line and its giver on
// Who's here, and a gold dot on the rail's Quests item.
import { describe, expect, it } from 'vitest';
// @ts-expect-error Node types are not installed; vitest runs in Node
import { readFileSync } from 'node:fs';
import { makeVillage } from '../harness';
import { actorById } from '../../src/engine/relations';
import { buildPlayerView } from '../../src/views';
import { deck, actionsOn, type DeckAction } from '../../src/ui/deck';
import { suggestions } from '../../src/ui/suggest';
import { now } from '../../src/time';
import { CONFIG } from '../../src/config';
import { PK } from '../../src/library/perkIds';
import type { GameState } from '../../src/types';

const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8');
const fight = (): GameState => {
  const s = makeVillage({ playerZone: 'tav_common', without: ['slime_1', 'slime_2', 'guard_1', 'trader'] });
  const m = actorById(s, 'patron_1')!.mind!;
  m.overrides = { player: 'hostile' };
  m.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  return s;
};
const all = (s: GameState) => deck({ pv: buildPlayerView(s), s }).flatMap((g) => g.actions);
const find = (s: GameState, kind: DeckAction['kind']) => all(s).find((a) => a.kind === kind);

describe('A3b limited moves on the deck', () => {
  it('Steady yourself within its cooldown stays, waiting, with the share gone and the words in its tip', () => {
    const s = fight();
    expect(find(s, 'steady')?.limit).toBeUndefined();
    s.player.core.condition.steadiedTurn = s.turn;
    const a = find(s, 'steady')!;
    expect(a.limit).toMatchObject({ share: 0, tip: `Ready in ${CONFIG.STEADY_COOLDOWN_S} s` });
  });

  it('Rest within its cooldown waits; past it, it is free', () => {
    const s = makeVillage();
    s.clocks[`rest:${s.player.id}`] = now(s) - CONFIG.REST_COOLDOWN_MIN / 4;
    expect(find(s, 'rest')!.limit).toMatchObject({ share: 0.25, tip: `Ready in ${CONFIG.REST_COOLDOWN_MIN * 0.75} min` });
    s.clocks[`rest:${s.player.id}`] = now(s) - CONFIG.REST_COOLDOWN_MIN;
    expect(find(s, 'rest')!.limit).toBeUndefined();
  });

  it('a perk move spent this fight is used: the view says so and the deck keeps it with the used mark', () => {
    const s = fight();
    s.player.core.perks.push({ perkId: PK.battle_cry, source: 'level', gainedTurn: 0 });
    s.player.engagement = { ...(s.player.engagement ?? { start: s.turn, kinds: [] }), uses: { [PK.battle_cry]: 1 } } as never;
    expect(buildPlayerView(s).player.perkMoves?.find((m) => m.id === PK.battle_cry)?.used).toBe(true);
    const cry = all(s).find((a) => a.label === 'Let out a battle cry')!;
    expect(cry.limit).toEqual({ used: true, tip: 'Used this fight' });
  });

  it('a limited move is never suggested, never on a person menu, never picked by the deck playtest', () => {
    const s = fight();
    s.player.core.condition.steadiedTurn = s.turn;
    const pv = buildPlayerView(s), groups = deck({ pv, s });
    expect(suggestions(groups, { pv, s }).some((x) => x.action.kind === 'steady')).toBe(false);
    expect(actionsOn(groups, 'patron_1').every((a) => !a.limit)).toBe(true);
    expect(readFileSync(new URL('../../scripts/playtest.ts', import.meta.url), 'utf8')).toMatch(/if \(a\.limit\) continue;/);
  });

  it('the deck draws it dimmed and unclickable, with the ring or the slash mark, and pulses once when it is ready', () => {
    const v = src('ui/deckView.ts'), css = src('ui/styles.css');
    expect(v).toMatch(/'aria-disabled': 'true'.*title: \[a\.limit\?\.tip, a\.time\]/); // the limit's words, then how long it takes
    expect(v).toMatch(/if \(a && !a\.limit\) b\.onclick/);
    expect(v).toMatch(/dk-mark used/);
    expect(v).toMatch(/dk-mark wait.*--share/);
    expect(v).toMatch(/classList\.add\('dk-ready'\)/);
    expect(css).toMatch(/\.dk-mark\.wait \{[^}]*conic-gradient\(currentColor calc\(var\(--share/);
    expect(css).toMatch(/\.dk-act\.dk-ready \{ animation: dk-ready [^;]*var\(--m-beat\)[^;]* 1;/);
  });
});

describe('C7 a quest ready to hand in', () => {
  it('marks the Quests row, the quest line, the giver on Who\'s here and the rail, with words only in tips', () => {
    expect(src('ui/pages.ts')).toMatch(/state: `\$\{q\.state === 'ready' \? '✓ ' : ''\}/);
    expect(src('ui/pages.ts')).toMatch(/q\.state === 'ready' \? \{ state: 'gold' as const \}/);
    const play = src('ui/play.ts');
    expect(play).toMatch(/h\('span', \{ class: 'q-ready' \}, `✓ \$\{QUEST_STATE_NAME\.ready\}`\)/);
    expect(play).toMatch(/handIn\.has\(a\.id\) \? h\('span', \{ class: 'q-ready', title: 'A quest for them is ready to hand in'/);
    const app = src('ui/app.ts');
    expect(app).toMatch(/railReady = !!api\.state\(\)\?\.quests\.some\(\(q\) => q\.state === 'ready'\)/);
    expect(app).toMatch(/h\('span', \{ class: 'rail-dot', 'aria-hidden': 'true' \}\)/);
    expect(src('ui/styles.css')).toMatch(/\.hs-rail \.rail-dot \{[^}]*background: var\(--scenario-mark\)/);
  });
});
