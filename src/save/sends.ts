// HF34 a: the library send list. "Send to NPC template" on a Hall of fame card (and, later, "Send to library" in the GM
// view) writes what is sent here, in the game database, and the page wakes Claude; Claude adds it to the code library by
// PR. Once merged, the library row names where it came from (UniqueSheet.from), which marks the send as in the library.
import type { Store } from './index';

export type LibrarySendKind = 'unique';
export type LibrarySend = {
  id: string;
  kind: LibrarySendKind;
  /** the story it came from */
  storyId: string;
  name: string;
  at: string;
  /** a unique: the race, the stranger label and the sheet (UniqueSheet) to put in src/library/uniques.ts */
  data: Record<string, unknown>;
};

const DIR = 'library_sends';
/** one send per story and kind: sending again replaces it */
export const sendId = (kind: LibrarySendKind, storyId: string) => `${kind}_${storyId}`;

export async function saveSend(store: Store, send: LibrarySend): Promise<void> {
  await store.set(`${DIR}/${send.id}`, send);
}

/** every send, newest first */
export async function librarySends(store: Store): Promise<LibrarySend[]> {
  const docs = await Promise.all((await store.list(DIR)).map((p) => store.get<LibrarySend>(p)));
  return docs.filter((d): d is LibrarySend => !!d).sort((a, b) => b.at.localeCompare(a.at));
}
