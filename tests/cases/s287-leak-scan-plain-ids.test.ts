// BG-194 (BF39): the leak scan threw out a story over the word "thief", because a man's id was "thief" and every id was
// scanned as a word. Ids are scanned only when they cannot be a plain word (a digit, _ or .); an unlearned secret's id stays
// forbidden as a term; a stranger's first name said alone is caught with capitals kept, except an everyday-word name at the
// start of a sentence.
import { expect, it } from 'vitest';
import { makeVillage } from '../harness';
import { buildLeakContext, leakScan } from '../../src/agents/narration';

const world = () => {
  const s = makeVillage({ playerZone: 'tav_common' });
  const man = s.actors.find((a) => a.id !== 'player' && a.kind === 'npc')!;
  man.id = 'thief';
  man.names = { current: 'Bram Tesk', past: [] } as never;
  const other = s.actors.find((a) => a.kind === 'npc' && a !== man)!;
  other.names = { current: 'Will Hobb', past: [] } as never;
  s.zones.push({ id: 'cellar', groundItems: [] } as never);
  s.hidden.secrets.push({ id: 'smuggling', holderId: 'thief', fact: 'he smuggles', leakTerms: ['contraband'], revealWhen: { type: 'event_in_zone', kind: 'search', zone: 'cellar' } } as never);
  return s;
};

it('plain-word ids are not leaks; ids that cannot be words still are', () => {
  const s = world(), ctx = buildLeakContext(s);
  expect(leakScan('The thief bolts for the cellar door.', '{}', ctx)).toEqual([]);
  expect(leakScan('The sun rose over the lane.', '{}', ctx)).toEqual([]);
  expect(leakScan('You see guard_1 near tav_common.', '{}', ctx).length).toBeGreaterThan(0);
});

it("a stranger's first name said alone is caught, capitals kept; an everyday-word name opening a sentence is the word", () => {
  const ctx = buildLeakContext(world());
  expect(leakScan('Bram steps in from the rain.', '{}', ctx)).toEqual(['name:Bram']);
  expect(leakScan('Will he follow? You cannot tell.', '{}', ctx)).toEqual([]);
  expect(leakScan('You see Will by the hearth.', '{}', ctx)).toEqual(['name:Will']);
});

it("an unlearned secret's id stays forbidden; once learned it may be said", () => {
  const s = world();
  expect(leakScan('Talk of smuggling hangs in the air.', '{}', buildLeakContext(s))).toEqual(['term:smuggling']);
  s.player.journal!.secretsKnown.push('smuggling');
  expect(leakScan('Talk of smuggling hangs in the air.', '{}', buildLeakContext(s))).toEqual([]);
});
