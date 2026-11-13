// TQ4 Parser test set: tricky player lines, each with what its parse must hold, on the test village (the player in the
// common room; the barkeep `trader` behind the bar and a patron `patron_1` in view; ways out: behind the bar, the front
// door). Lines come from Parser bugs (BG-n) and playtest habits. Add a case for every Parser bug fixed.
import type { Intent } from '../../src/types';

export type Parsed = { intent: Intent | null; clarify: string | null };
type Check = (p: Parsed) => string | null;
const need = (ok: boolean, why: string): string | null => (ok ? null : why);
const i = (p: Parsed) => p.intent;
const act = (type: string | string[], target?: string): Check => (p) => need([type].flat().includes(i(p)?.action?.type ?? '') && (target === undefined || i(p)?.action?.target === target), `action ${[type].flat().join('/')}${target ? ` at ${target}` : ''}`);
const says = (to?: string): Check => (p) => need(!!i(p)?.spoken?.trim() && (to === undefined || !!i(p)?.addressees?.includes(to) || i(p)?.action?.target === to), `words${to ? ` to ${to}` : ''}`);
const moves = (zones: string[], near?: string): Check => (p) => need(!!i(p)?.move && (zones.includes(i(p)!.move!.toZone) || (!!near && i(p)!.move!.spot?.near === near)), `a move to ${zones.join('/')}${near ? ` or near ${near}` : ''}`);
const noMove: Check = (p) => need(!i(p)?.move, 'no move');
const clarifies: Check = (p) => need(!!p.clarify && !p.intent, 'a clarify question');
const noClarify: Check = (p) => need(!p.clarify && !!p.intent, 'no clarify');
const nothingDeferred: Check = (p) => need(!i(p)?.deferred?.length, 'nothing deferred');
const all = (...cs: Check[]): Check => (p) => cs.map((c) => c(p)).find(Boolean) ?? null;

export const CASES: { line: string; bug?: string; check: Check }[] = [
  { line: 'I walk over to the barkeep.', check: moves(['tav_counter'], 'trader') },
  { line: 'Go out the front door.', check: moves(['street_door']) },
  { line: 'Go behind the bar.', check: moves(['tav_counter']) },
  { line: 'Leave through the front door and head into the street.', bug: 'BG-15', check: moves(['street_door']) },
  { line: 'Walk to the back of the room.', bug: 'BG-12', check: (p) => need(i(p)?.move?.toZone === 'tav_common' && !!i(p)?.move?.spot, 'a spot in the common room') },
  { line: 'Go stand by the north wall of the common room.', bug: 'BG-12', check: (p) => need(!!i(p)?.move?.spot, 'a spot') },
  { line: 'I knock on the bar and call out: Hello? Anyone serving?', bug: 'BG-46', check: says() },
  { line: 'Walk over to the patron and say: mind if I sit?', bug: 'BG-58', check: all(moves(['tav_common'], 'patron_1'), says('patron_1')) },
  { line: 'Ask the barkeep if there is any work going.', bug: 'BG-68', check: all(says('trader'), nothingDeferred) },
  { line: 'Order a drink, then take a seat near the patron.', bug: 'BG-79', check: all(says('trader'), moves(['tav_common'], 'patron_1')) },
  { line: 'Nod to the barkeep, then ask the patron why he came here.', bug: 'BG-96', check: all(says('patron_1'), nothingDeferred) },
  { line: 'I grab the patron by the wrist and ask what he took.', bug: 'BG-117', check: says('patron_1') },
  { line: 'Tell the barkeep: I will take the job.', check: says('trader') },
  { line: 'Say to everyone: drinks are on me!', check: says() },
  { line: 'Shout for help!', bug: 'BG-71', check: (p) => need(i(p)?.volume === 'shout' && !!i(p)?.spoken, 'shouted words') },
  { line: 'Whisper to the patron: don\'t look now.', bug: 'BG-71', check: (p) => need(i(p)?.volume === 'whisper' && !!i(p)?.addressees?.includes('patron_1'), 'whispered words to patron_1') },
  { line: 'Say "*grins* Well met, friend." to the patron.', bug: 'BG-93', check: (p) => need(!!i(p)?.spoken && !/[*[\]]/.test(i(p)!.spoken!), 'spoken words with no stage direction') },
  { line: 'Go behind the bar, and after that ask the barkeep about rooms.', bug: 'BG-134', check: all(noClarify, (p) => need(!(i(p)?.deferred ?? []).some((d) => /trader|patron_1|the player/i.test(d)), 'deferred in the player\'s own words')) },
  { line: 'I draw my sword and attack the patron.', check: act('attack', 'patron_1') },
  { line: 'Hit the barkeep with my shield.', check: act('attack', 'trader') },
  { line: 'Charge the patron and swing at his head.', check: (p) => need(i(p)?.action?.type === 'attack' && i(p)?.action?.target === 'patron_1' && !!i(p)?.action?.targetPart, 'an aimed attack at patron_1') },
  { line: 'Attack the dragon.', check: clarifies },
  { line: 'Give the barkeep five coins.', check: (p) => need(i(p)?.action?.type === 'give' && i(p)?.action?.target === 'trader' && i(p)?.action?.item === 'player_coin' && i(p)?.action?.qty === 5, 'give 5 player_coin to trader') },
  { line: 'Threaten the patron: leave now or else.', check: act('intimidate', 'patron_1') },
  { line: 'Haggle with the barkeep over the price of a room.', check: act('barter', 'trader') },
  { line: 'Lie to the barkeep that I am a city guard.', check: act('deceive', 'trader') },
  { line: 'Try to convince the patron to come with me.', check: act('persuade', 'patron_1') },
  { line: 'Hold the patron back so he can\'t leave.', bug: 'BF5', check: act('restrain', 'patron_1') },
  { line: 'Hide behind the bar.', check: all(act('hide'), moves(['tav_counter'])) },
  { line: 'Sneak out the front door.', check: moves(['street_door']) },
  { line: 'Search the room.', check: act('search') },
  { line: 'Look around.', check: all(act('observe'), noMove) },
  { line: 'I wait and watch the room.', check: all(act(['wait', 'observe']), noMove) },
  { line: 'I await the outcome.', bug: 'BG-3', check: all(noClarify, noMove) },
  { line: 'I sit down and rest for a while.', check: act(['rest', 'wait']) },
  { line: 'Take off my gambeson.', check: (p) => need(!!i(p)?.gear?.some((g) => JSON.stringify(g).includes('player_IT12_3')), 'a gear op on the gambeson') },
  { line: 'Put my sword away.', check: (p) => need(!!i(p)?.gear?.some((g) => JSON.stringify(g).includes('player_IT2_1')), 'a gear op on the sword') },
  { line: 'I say nothing and keep my eyes on the patron.', check: all(noClarify, (p) => need(!i(p)?.spoken, 'no words')) },
  { line: 'Ask the patron, then the barkeep, if they have seen a wolf.', bug: 'BG-122', check: says() },
  { line: 'Duck out the front door before anyone notices.', check: moves(['street_door']) },
];
