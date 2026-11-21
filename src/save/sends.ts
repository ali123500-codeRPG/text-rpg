// HF34 a: the library send list. "Send to NPC template" on a Hall of fame card, and "Send to library" on something the
// Weaver made in a story (the GM view), write what is sent here, in the game database, and the page wakes Claude; Claude adds it to the code library by
// PR. Once merged, the library row names where it came from (UniqueSheet.from), which marks the send as in the library.
import type { Store } from './index';

/** unique: a Hall of fame hero; the rest: a story blueprint of that kind (BlueprintPage.kind) */
export type LibrarySendKind = 'unique' | 'item' | 'body_type' | 'npcTemplate';
export type LibrarySend = {
  id: string;
  kind: LibrarySendKind;
  /** the story it came from */
  storyId: string;
  name: string;
  at: string;
  /** a unique: the race, the stranger label and the sheet (UniqueSheet) to put in src/library/uniques.ts; a blueprint: its data */
  data: Record<string, unknown>;
};

const DIR = 'library_sends';
/** one send per story and kind (and blueprint id): sending again replaces it */
export const sendId = (kind: LibrarySendKind, storyId: string, blueprintId?: string) => `${kind}_${storyId}${blueprintId ? `_${blueprintId}` : ''}`;

export async function saveSend(store: Store, send: LibrarySend): Promise<void> {
  await store.set(`${DIR}/${send.id}`, send);
}

/** every send, newest first */
export async function librarySends(store: Store): Promise<LibrarySend[]> {
  const docs = await Promise.all((await store.list(DIR)).map((p) => store.get<LibrarySend>(p)));
  return docs.filter((d): d is LibrarySend => !!d).sort((a, b) => b.at.localeCompare(a.at));
}

// IAA-108: the Chronicler's deed ideas sent to Claude from the GM view's Wanted list, one document each, so an idea is sent once.
// The ideas themselves stay in the story (hidden.templateWants); this list only marks which went, and the owner's verdict,
// which the reviewing thread writes on the idea's document once the owner rules (an approved one becomes a code rule, PROG-118),
// and cleared once the owner clears ruled ideas from the list (the story keeps them, so the Chronicler doesn't propose them again).
export type DeedSend = { id: string; storyId: string; name: string; at: string; verdict?: 'approved' | 'turned_down'; cleared?: true };
const DEEDS = 'deed_sends';
/** one idea of a story: its scenario, turn and name */
export const deedSendId = (storyId: string, w: { scenario: number; turn: number; label: string }) =>
  `${storyId}_s${w.scenario}_t${w.turn}_${w.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

export async function saveDeedSends(store: Store, sends: readonly DeedSend[]): Promise<void> {
  await Promise.all(sends.map((d) => store.set(`${DEEDS}/${d.id}`, d)));
}

/** the deed ideas sent from one story */
export async function deedSends(store: Store, storyId: string): Promise<DeedSend[]> {
  const docs = await Promise.all((await store.list(DEEDS)).filter((p) => p.startsWith(`${DEEDS}/${storyId}_`)).map((p) => store.get<DeedSend>(p)));
  return docs.filter((d): d is DeedSend => !!d && d.storyId === storyId);
}
