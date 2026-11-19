// RH19 c: the Republish button starts the saved task only where the view reaches Claude Code Remote's fire_trigger and
// the page's database names a task; each refusal says what to do, and a write with no answer says it may have run.
import { describe, expect, it } from 'vitest';
import { REMOTE_SERVER, REPUBLISH_DOC, type RemoteMcp, type RepublishDb, republishTask, startRepublish } from '../../src/ui/republish';

const db = (data?: Record<string, unknown>): RepublishDb & { asked: string[] } => {
  const asked: string[] = [];
  return { asked, doc: (p) => { asked.push(p); return { get: async () => ({ exists: !!data, data: () => data }) }; } };
};
const mcp = (tools: string[], fire?: (input: unknown) => unknown): RemoteMcp & { calls: unknown[][] } => {
  const calls: unknown[][] = [];
  return {
    calls,
    listTools: async () => ({ servers: tools.length ? [{ server: REMOTE_SERVER, tools: tools.map((name) => ({ name })) }] : [] }),
    callTool: async (...a) => { calls.push(a); return fire ? fire(a[2]) : { payload: {} }; },
  };
};

describe('Republish button', () => {
  it('shows only with the connector, its fire_trigger tool and a task named in the database', async () => {
    const d = db({ task: 'trig_01Abc' });
    expect(await republishTask(mcp(['fire_trigger', 'list_triggers']), d)).toBe('trig_01Abc');
    expect(d.asked).toEqual([REPUBLISH_DOC]);
    expect(await republishTask(null, d)).toBeNull(); // no mcp capability (a viewer from another account)
    expect(await republishTask(mcp([]), d)).toBeNull(); // connector absent
    expect(await republishTask(mcp(['list_triggers']), d)).toBeNull(); // tool absent
    expect(await republishTask(mcp(['fire_trigger']), db())).toBeNull(); // no task written
    expect(await republishTask(mcp(['fire_trigger']), db({ task: 'not a task' }))).toBeNull();
    const refusing: RemoteMcp = { listTools: async () => { throw { code: 'not_granted' }; }, callTool: async () => ({}) };
    expect(await republishTask(refusing, d)).toBeNull();
  });

  it('a press fires the task once, uncached, with no added text', async () => {
    const m = mcp(['fire_trigger']);
    expect(await startRepublish(m, 'trig_01Abc')).toEqual({ ok: true });
    expect(m.calls).toEqual([[REMOTE_SERVER, 'fire_trigger', { trigger_id: 'trig_01Abc' }, { cache: false }]]);
  });

  it('a refusal says what to do; no answer says it may have started', async () => {
    const fail = async (e: object) => startRepublish(mcp(['fire_trigger'], () => { throw e; }), 'trig_01Abc');
    expect(await fail({ code: 'needs_reauth' })).toMatchObject({ ok: false, note: expect.stringContaining(`Reconnect ${REMOTE_SERVER}`) });
    expect(await fail({ code: 'server_not_connected' })).toMatchObject({ note: expect.stringContaining(`Add ${REMOTE_SERVER}`) });
    expect(await fail({ code: 'approval_required' })).toMatchObject({ note: expect.stringContaining('Permissions menu') });
    expect(await fail({ code: 'tool_error', message: 'trigger disabled' })).toMatchObject({ note: 'The saved task didn’t start: trigger disabled' });
    expect(await fail({ code: 'server_unavailable' })).toMatchObject({ note: expect.stringContaining('may have started') });
  });
});
