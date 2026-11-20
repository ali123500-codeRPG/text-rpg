// SX8 step 2: the deck asks the engine (src/engine/beside.ts) which entries ride beside the main action, in place of a
// free mark set by hand on each entry. Nothing on screen may change: these are the entries, their order, their tips (time
// and note, numbers left out so a tuned row does not break it) and the free mark, as the deck showed them before the move,
// for a few states.
import { describe, expect, it } from 'vitest';
import { lay, makeVillage, place } from '../harness';
import { buildPlayerView } from '../../src/views';
import { actorById } from '../../src/engine/relations';
import { learn, TRICK } from '../../src/engine/ruses';
import { PERK_MOVES } from '../../src/ruleset';
import { IT } from '../../src/library/itemIds';
import { deck } from '../../src/ui/deck';
import type { GameState } from '../../src/types';

const F = 'free';
type Row = [group: string, kind: string, label: string, tip: string, free?: typeof F];

/** a fight in the common room with Old Wim */
const fight = () => {
  const s = makeVillage({ without: ['slime_1', 'slime_2', 'trader'] });
  const m = actorById(s, 'patron_1')!.mind!;
  m.overrides = { player: 'hostile' };
  m.knowledge.player = { status: 'engaged', lastKnownZone: s.player.zone, lastSeenTurn: s.turn, source: 'seen', revealed: [] };
  s.mode = 'tactical';
  s.player.engagement = { start: s.turn, last: s.turn, kinds: ['fight'] };
  return s;
};
/** the village with the sword put away, an amulet carried, spectacles worn, a dagger at the player's feet and the player's
 * Threadbound charm out in the far field */
const toHand = () => {
  const s = makeVillage(), p = s.player;
  for (const i of p.core.inventory) if (i.itemId === IT.arming_sword) delete i.equippedIn;
  p.core.inventory.push({ id: 'amulet_1', itemId: IT.amulet }, { id: 'specs_1', itemId: IT.spectacles, equippedIn: ['acc:0'] });
  lay(s, p.zone, { id: 'ground_dagger', itemId: IT.dagger }, { x: p.pos!.x, y: p.pos!.y + 0.3 });
  lay(s, 'field_far', { id: 'loop_1', itemId: IT.varos_loop, boundTo: p.id });
  return s;
};
/** the fight with every perk move owned (Play Dead open), Old Wim's play-dead trick known and Bertram on the player's side */
const withMoves = () => {
  const s = fight(), p = s.player;
  for (const perkId of Object.keys(PERK_MOVES)) p.core.perks.push({ perkId, source: 'level', gainedTurn: 0 });
  p.playDeadOpen = s.turn;
  learn(s, p, 'patron_1', TRICK.play_dead);
  const f = place(s, 'guard_1', p.zone);
  f.pos = { x: p.pos!.x - 0.8, y: p.pos!.y };
  f.bandId = p.bandId;
  delete f.asleep;
  f.mind!.knowledge.player = { status: 'aware', source: 'seen', revealed: [], lastKnownZone: p.zone, lastSeenTurn: s.turn };
  return s;
};

const rows = (s: GameState, broken = false): Row[] => deck({ pv: buildPlayerView(s), s, broken }).flatMap((g) => g.actions.map((a): Row => {
  const tip = [a.time, a.note].filter(Boolean).join(' · ').replace(/\d+(\.\d+)?/g, '#');
  return a.free ? [g.group, a.kind, a.label, tip, F] : [g.group, a.kind, a.label, tip];
}));

describe('SX8: the deck shows what it showed before the free mark came from the engine', () => {
  it('village start', () => expect(rows(makeVillage())).toEqual<Row[]>([
    ['fight', 'attack', 'Attack', 'Each blow takes # s'],
    ['fight', 'restrain', 'Restrain', 'Takes the turn · hold them back unhurt'],
    ['talk', 'talk', 'Talk to', 'Takes # s'],
    ['talk', 'persuade', 'Persuade', 'Takes # s · your words, Persuasion'],
    ['talk', 'deceive', 'Lie to', 'Takes # s · Falsehood against their Insight'],
    ['talk', 'intimidate', 'Threaten', 'Takes # s · Intimidation'],
    ['talk', 'barter', 'Haggle with', 'Takes no time, but it is your action · Barter'],
    ['talk', 'give', 'Give', 'Takes no time, but it is your action'],
    ['talk', 'lets_search', 'Let them search you', ''],
    ['talk', 'show', 'Turn out your pockets', 'Takes the turn · before everyone here'],
    ['move', 'go', 'Go to', 'Takes as long as the way there'],
    ['move', 'walk_up', 'Walk up to', 'Takes as long as the way there'],
    ['move', 'back_away', 'Back away from', 'Takes as long as the way there'],
    ['move', 'follow', 'Follow', 'Takes as long as the way there'],
    ['move', 'way', 'Door, gate or bar', 'takes your move'],
    ['stealth', 'sneak', 'Sneak', 'Takes the turn · slows all actions ×#'],
    ['stealth', 'stash', 'Stash', 'Takes the turn'],
    ['use', 'look_at', 'Look at', 'Takes # s'],
    ['use', 'listen', 'Listen', 'Takes # s'],
    ['use', 'search', 'Search', 'Takes # s · all in sight, and what is hidden near'],
    ['use', 'pat_down', 'Pat down', 'Takes # s'],
    ['use', 'break', 'Break through', 'Takes # min · loud · long'],
    ['use', 'wait', 'Wait', 'Lasts until the time you pick'],
    ['use', 'rest', 'Rest', 'Takes # h · a short rest'],
    ['use', 'sleep', 'Sleep', 'Lasts until you are rested'],
    ['use', 'stow', 'Put away', 'Free: beside your action, not instead of it', F],
    ['use', 'equip', 'Armor on or off', 'Free: beside your action, not instead of it', F],
    ['use', 'set_down', 'Set down', 'Free: beside your action, not instead of it', F],
  ]));
  it('village, things to hand', () => expect(rows(toHand())).toEqual<Row[]>([
    ['fight', 'attack', 'Attack', 'Each blow takes # s'],
    ['fight', 'restrain', 'Restrain', 'Takes the turn · hold them back unhurt'],
    ['talk', 'talk', 'Talk to', 'Takes # s'],
    ['talk', 'persuade', 'Persuade', 'Takes # s · your words, Persuasion'],
    ['talk', 'deceive', 'Lie to', 'Takes # s · Falsehood against their Insight'],
    ['talk', 'intimidate', 'Threaten', 'Takes # s · Intimidation'],
    ['talk', 'barter', 'Haggle with', 'Takes no time, but it is your action · Barter'],
    ['talk', 'give', 'Give', 'Takes no time, but it is your action'],
    ['talk', 'lets_search', 'Let them search you', ''],
    ['talk', 'show', 'Turn out your pockets', 'Takes the turn · before everyone here'],
    ['move', 'go', 'Go to', 'Takes as long as the way there'],
    ['move', 'walk_up', 'Walk up to', 'Takes as long as the way there'],
    ['move', 'back_away', 'Back away from', 'Takes as long as the way there'],
    ['move', 'follow', 'Follow', 'Takes as long as the way there'],
    ['move', 'way', 'Door, gate or bar', 'takes your move'],
    ['stealth', 'sneak', 'Sneak', 'Takes the turn · slows all actions ×#'],
    ['stealth', 'stash', 'Stash', 'Takes the turn'],
    ['use', 'look_at', 'Look at', 'Takes # s'],
    ['use', 'listen', 'Listen', 'Takes # s'],
    ['use', 'search', 'Search', 'Takes # s · all in sight, and what is hidden near'],
    ['use', 'pat_down', 'Pat down', 'Takes # s'],
    ['use', 'loot', 'Take things here', 'pick what to pocket'],
    ['use', 'draw', 'Draw', 'Free: beside your action, not instead of it', F],
    ['use', 'swap', 'Swap weapons', 'Free: beside your action, not instead of it', F],
    ['use', 'wear_acc', 'Put on', 'Free: beside your action, not instead of it', F],
    ['use', 'remove_acc', 'Take off', 'Free: beside your action, not instead of it', F],
    ['use', 'pick_up', 'Pick up', 'Free: beside your action, not instead of it', F],
    ['use', 'summon', 'Summon', 'Free: beside your action, not instead of it', F],
    ['use', 'break', 'Break through', 'Takes # min · loud · long'],
    ['use', 'wait', 'Wait', 'Lasts until the time you pick'],
    ['use', 'rest', 'Rest', 'Takes # h · a short rest'],
    ['use', 'sleep', 'Sleep', 'Lasts until you are rested'],
    ['use', 'stow', 'Put away', 'Free: beside your action, not instead of it', F],
    ['use', 'equip', 'Armor on or off', 'Free: beside your action, not instead of it', F],
    ['use', 'set_down', 'Set down', 'Free: beside your action, not instead of it', F],
  ]));
  it('in a fight, every perk move, a foe to warn about', () => expect(rows(withMoves())).toEqual<Row[]>([
    ['fight', 'attack', 'Attack', 'Each blow takes # s'],
    ['fight', 'restrain', 'Restrain', 'Takes the turn · hold them back unhurt'],
    ['fight', 'steady', 'Steady yourself', 'Takes the turn · a morale roll'],
    ['fight', 'yield', 'Yield', 'ends the fight if they take it'],
    ['talk', 'talk', 'Talk to', 'Takes no time, but it is your action'],
    ['talk', 'persuade', 'Persuade', 'Takes # s · talk a foe down · easier once they are hurt or scared'],
    ['talk', 'deceive', 'Lie to', 'Takes # s · a lie to end it · Falsehood against their Insight'],
    ['talk', 'intimidate', 'Threaten', 'Takes # s · Intimidation'],
    ['talk', 'barter', 'Haggle with', 'Takes no time, but it is your action · pay a foe to stop: name the coin'],
    ['talk', 'demand', 'Demand surrender', 'Takes # s · Persuasion; a bigger win'],
    ['talk', 'give', 'Give', 'Takes no time, but it is your action'],
    ['talk', 'take', 'Take from', 'Takes no time, but it is your action · works if they yielded or are down'],
    ['talk', 'lets_search', 'Let them search you', ''],
    ['talk', 'show', 'Turn out your pockets', 'Takes the turn · before everyone here'],
    ['talk', 'warn', 'Warn your side', 'Free: beside your action, not instead of it · a shout', F],
    ['move', 'go', 'Go to', 'Takes as long as the way there'],
    ['move', 'walk_up', 'Walk up to', 'Takes as long as the way there'],
    ['move', 'back_away', 'Back away from', 'Takes as long as the way there'],
    ['move', 'follow', 'Follow', 'Takes as long as the way there'],
    ['move', 'way', 'Door, gate or bar', 'takes your move'],
    ['stealth', 'sneak', 'Sneak', 'Takes the turn · slows all actions ×#'],
    ['stealth', 'filch', 'Filch', 'Takes the turn · unseen, or they turn on you'],
    ['stealth', 'stash', 'Stash', 'Takes the turn'],
    ['use', 'look_at', 'Look at', 'Takes # s'],
    ['use', 'listen', 'Listen', 'Takes # s'],
    ['use', 'search', 'Search', 'Takes # s · all in sight, and what is hidden near'],
    ['use', 'pat_down', 'Pat down', 'Takes # s'],
    ['use', 'break', 'Break through', 'Takes # min · loud · long'],
    ['use', 'stow', 'Put away', 'Free: beside your action, not instead of it', F],
    ['use', 'equip', 'Armor on or off', 'Free: beside your action, not instead of it', F],
    ['use', 'set_down', 'Set down', 'Free: beside your action, not instead of it', F],
    ['perks', 'perk', 'Throw dirt in the eyes', 'Free: beside your action, not instead of it · Dirt in the Eyes', F],
    ['perks', 'perk', 'Let out a battle cry', 'Battle Cry'],
    ['perks', 'perk', 'Rally your side', 'Rally'],
    ['perks', 'perk', 'Draw Them In', 'Free: beside your action, not instead of it · Draw Them In', F],
    ['perks', 'perk', 'Play dead', 'Play Dead'],
    ['perks', 'perk', 'Grit Your Teeth', 'Free: beside your action, not instead of it · Grit Your Teeth', F],
    ['perks', 'perk', 'Bluff "Behind you!"', 'Free: beside your action, not instead of it · Bluff', F],
  ]));
  it('in a fight, nerve broken', () => expect(rows(fight(), true)).toEqual<Row[]>([
    ['getaway', 'yield', 'Yield', 'ends the fight if they take it'],
    ['getaway', 'go', 'Go to', 'Takes as long as the way there'],
    ['getaway', 'back_away', 'Back away from', 'Takes as long as the way there'],
    ['getaway', 'way', 'Door, gate or bar', 'takes your move'],
    ['getaway', 'sneak', 'Sneak', 'Takes the turn · slows all actions ×#'],
    ['talk', 'talk', 'Talk to', 'Takes no time, but it is your action'],
    ['talk', 'persuade', 'Persuade', 'Takes # s · talk a foe down · easier once they are hurt or scared'],
    ['talk', 'deceive', 'Lie to', 'Takes # s · a lie to end it · Falsehood against their Insight'],
    ['talk', 'intimidate', 'Threaten', 'Takes # s · Intimidation'],
    ['talk', 'barter', 'Haggle with', 'Takes no time, but it is your action · pay a foe to stop: name the coin'],
    ['talk', 'demand', 'Demand surrender', 'Takes # s · Persuasion; a bigger win'],
    ['talk', 'give', 'Give', 'Takes no time, but it is your action'],
    ['talk', 'lets_search', 'Let them search you', ''],
    ['talk', 'show', 'Turn out your pockets', 'Takes the turn · before everyone here'],
    ['stealth', 'stash', 'Stash', 'Takes the turn'],
    ['use', 'look_at', 'Look at', 'Takes # s'],
    ['use', 'listen', 'Listen', 'Takes # s'],
    ['use', 'search', 'Search', 'Takes # s · all in sight, and what is hidden near'],
    ['use', 'pat_down', 'Pat down', 'Takes # s'],
    ['use', 'break', 'Break through', 'Takes # min · loud · long'],
    ['use', 'stow', 'Put away', 'Free: beside your action, not instead of it', F],
    ['use', 'equip', 'Armor on or off', 'Free: beside your action, not instead of it', F],
    ['use', 'set_down', 'Set down', 'Free: beside your action, not instead of it', F],
  ]));
});
