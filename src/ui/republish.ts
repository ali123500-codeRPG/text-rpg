// Republish (RH13, RH19 c): one press on the rail starts the owner's saved task that builds main and republishes the game
// and the library viewer. The task's id sits in the page's database (REPUBLISH_DOC), never in the code. The button shows only
// where this view reaches Claude Code Remote's fire_trigger and the page's database names a task.
import { h, lineIcon } from './kit';
import { openPop } from './pop';

export const REMOTE_SERVER = 'Claude Code Remote';
export const REPUBLISH_DOC = 'ops/republish';

/** the parts of the page's mcp and db capabilities used here */
export type RemoteMcp = {
  listTools(server?: string): Promise<{ servers: { server: string; tools: { name: string }[] }[] }>;
  callTool(server: string, tool: string, input?: unknown, o?: { cache?: false }): Promise<unknown>;
};
export type RepublishDb = { doc(path: string): { get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }> } };

/** the saved task's id, or null when this view can't start it (no connector, no fire_trigger, no task named) */
export async function republishTask(mcp: RemoteMcp | null, db: RepublishDb | null): Promise<string | null> {
  if (!mcp || !db) return null;
  try {
    const [list, snap] = await Promise.all([mcp.listTools(REMOTE_SERVER), db.doc(REPUBLISH_DOC).get()]);
    if (!list.servers.some((s) => s.server === REMOTE_SERVER && s.tools.some((t) => t.name === 'fire_trigger'))) return null;
    const id = snap.exists ? snap.data()?.task : undefined;
    return typeof id === 'string' && /^trig_\w+$/.test(id) ? id : null;
  } catch { return null; }
}

export type RepublishResult = { ok: true } | { ok: false; note: string };

/** why a press didn't start the task, in words for the pop-up. A write with no answer may still have run, so it says so */
export function republishFailure(e: { code?: string; message?: string }): string {
  switch (e?.code) {
    case 'needs_reauth': return `Reconnect ${REMOTE_SERVER} in claude.ai Settings → Connectors, then press again.`;
    case 'server_not_connected': case 'server_not_found': return `Add ${REMOTE_SERVER} in claude.ai Settings → Connectors, then press again.`;
    case 'selection_required': return `More than one connector is called ${REMOTE_SERVER}: keep one in claude.ai Settings → Connectors.`;
    case 'approval_required': case 'not_in_manifest': case 'not_granted': case 'consent_required':
      return `Allow ${REMOTE_SERVER} for this page (its Permissions menu), then press again.`;
    case 'blocked_by_policy': return `This page isn’t allowed to start the saved task.`;
    case 'tool_error': return `The saved task didn’t start${e.message ? `: ${e.message}` : '.'}`;
    default: return 'No answer came back, so it may have started. Look for a new thread in the project before pressing again.';
  }
}

/** one press: fire the saved task once, never retried (a write) */
export async function startRepublish(mcp: RemoteMcp, task: string): Promise<RepublishResult> {
  try {
    await mcp.callTool(REMOTE_SERVER, 'fire_trigger', { trigger_id: task }, { cache: false });
    return { ok: true };
  } catch (e) { return { ok: false, note: republishFailure(e as { code?: string; message?: string }) }; }
}

const ICON = 'M7 18a4 4 0 0 1-.7-7.9A6 6 0 0 1 17.8 9 4.5 4.5 0 0 1 17 18M12 20v-8M9 15l3-3 3 3';
type State = 'idle' | 'pending' | 'started' | 'failed';

/** the rail's Republish item: null until the view is known to reach the task; `redraw` redraws the rail when it is */
export function republishItem(redraw: () => void): { el: () => HTMLElement | null } {
  let mcp: RemoteMcp | null = null, task: string | null = null, state: State = 'idle', note = '';
  void (async () => {
    const c = (globalThis as { claude?: { use(n: string): Promise<unknown> } }).claude;
    if (!c) return;
    try {
      const [m, db] = await Promise.all([c.use('mcp'), c.use('db')]);
      mcp = m as RemoteMcp | null;
      task = await republishTask(mcp, db as RepublishDb | null);
    } catch { task = null; }
    if (task) redraw();
  })();
  let pop: HTMLElement | null = null;
  const body = (): HTMLElement[] => {
    const btn = h('button', { type: 'button', class: 'hs-btn-main', disabled: state === 'pending' || state === 'started',
      'aria-busy': state === 'pending' ? 'true' : undefined, onclick: press },
      state === 'pending' ? [h('span', { class: 'spin', 'aria-hidden': 'true' }), 'Starting…'] : 'Republish from main');
    const line = state === 'started' ? h('p', { class: 'rp-note', role: 'status' }, 'Started. A new thread in the project says when both pages are up.')
      : state === 'failed' ? h('p', { class: 'rp-note bad', role: 'alert' }, note) : null;
    return line ? [btn, line] : [btn];
  };
  // a redraw keeps focus in the pop-up (the pressed button is replaced), so Tab and Esc still work from where the player was
  const paint = () => { const b = pop?.querySelector('.dpop-body'); if (b && pop?.isConnected) { b.replaceChildren(...body()); pop.focus({ preventScroll: true }); } };
  async function press() {
    if (!mcp || !task || state === 'pending' || state === 'started') return;
    state = 'pending'; paint();
    const r = await startRepublish(mcp, task);
    state = r.ok ? 'started' : 'failed'; note = r.ok ? '' : r.note;
    paint(); redraw();
  }
  return {
    el: () => (!task ? null : h('button', {
      type: 'button', class: 'foot', 'aria-haspopup': 'dialog',
      'data-tip': state === 'started' ? 'Republish: started' : state === 'failed' ? 'Republish: didn’t start' : 'Republish from main',
      onclick: (e: Event) => { pop = openPop({ title: 'Republish', opener: e.currentTarget as HTMLElement, cls: 'rp-pop', body: body() }); },
    }, lineIcon('hs-i', ICON), h('span', { class: 'rail-label' }, 'Republish'))),
  };
}
