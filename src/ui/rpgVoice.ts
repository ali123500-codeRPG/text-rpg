// The RPG Voice: Ali's claude.ai connector that acts a line out with Gemini's speech voices (sound tags such as <gasp>
// and a short English acting note). The page reaches it through its mcp capability; where it can't, Claude's own voices
// read the line instead.

export const RPG_SERVER = 'RPG Voice';
export const RPG_DEFAULT_VOICE = 'Leda';
/** the relay's voices and their character, as its list_voices tool gives them (refreshed from it once it has answered) */
export const RPG_VOICES: { voice: string; style: string }[] = ('Zephyr Bright, Puck Upbeat, Charon Informative, Kore Firm, Fenrir Excitable, '
  + 'Leda Youthful, Orus Firm, Aoede Breezy, Callirrhoe Easy-going, Autonoe Bright, Enceladus Breathy, Iapetus Clear, Umbriel Easy-going, '
  + 'Algieba Smooth, Despina Smooth, Erinome Clear, Algenib Gravelly, Rasalgethi Informative, Laomedeia Upbeat, Achernar Soft, Alnilam Firm, '
  + 'Schedar Even, Gacrux Mature, Pulcherrima Forward, Achird Friendly, Zubenelgenubi Casual, Sadachbia Lively, Sadaltager Knowledgeable, '
  + 'Sulafat Warm, Vindemiatrix Gentle').split(', ').map((s) => { const [voice, ...d] = s.split(' '); return { voice, style: d.join(' ') }; });

/** the part of the page's mcp capability used here */
export type Mcp = { callTool(server: string, tool: string, input?: unknown, o?: { cache?: false }): Promise<{ payload?: unknown }> };
export type McpError = { code?: string; message?: string };

/** one acted line as a playable data URL (rejects like callTool, or with code 'no_audio' when the answer has none) */
export async function rpgSpeak(mcp: Mcp, text: string, direction: string, voice: string): Promise<string> {
  const r = await mcp.callTool(RPG_SERVER, 'speak', { text, voice, ...(direction ? { direction } : {}) }, { cache: false });
  const p = r?.payload as { mime?: unknown; audio?: unknown } | undefined;
  if (!p || typeof p.audio !== 'string' || !p.audio) throw { code: 'no_audio', message: 'RPG Voice sent no audio' };
  return `data:${typeof p.mime === 'string' ? p.mime : 'audio/wav'};base64,${p.audio}`;
}

/** the relay's own voice list, or null when its answer isn't one */
export async function rpgVoices(mcp: Mcp): Promise<{ voice: string; style: string }[] | null> {
  const r = await mcp.callTool(RPG_SERVER, 'list_voices', {});
  const v = (r?.payload as { voices?: unknown } | undefined)?.voices;
  if (!Array.isArray(v)) return null;
  const out = v.filter((x): x is { voice: string; style?: string } => !!x && typeof x.voice === 'string').map((x) => ({ voice: x.voice, style: typeof x.style === 'string' ? x.style : '' }));
  return out.length ? out : null;
}

/** why the RPG Voice didn't read a line, in words for the bar; down: don't try it again until the watcher picks a voice */
export function rpgFailure(e: McpError): { note: string; down: boolean } {
  const then = 'Claude’s voice reads for now.';
  switch (e?.code) {
    case 'needs_reauth': return { note: `Reconnect RPG Voice in claude.ai Settings → Connectors to hear it. ${then}`, down: true };
    case 'server_not_connected': case 'server_not_found': return { note: `Add RPG Voice in claude.ai Settings → Connectors to hear it. ${then}`, down: true };
    case 'selection_required': return { note: `More than one connector is called RPG Voice: keep one in claude.ai Settings → Connectors. ${then}`, down: true };
    case 'approval_required': case 'not_granted': return { note: `RPG Voice needs your OK to speak on this page (the page’s Permissions menu). ${then}`, down: true };
    case 'blocked_by_policy': case 'not_in_manifest': return { note: `This page isn’t allowed to use RPG Voice. ${then}`, down: true };
    case 'tool_error':
      if (/\b429\b|quota|exhausted/i.test(e.message ?? '')) return { note: `RPG Voice has used its free allowance for now. ${then}`, down: true };
      return { note: 'RPG Voice couldn’t act that line, so Claude’s voice read it.', down: false };
    default: return { note: 'RPG Voice didn’t answer in time, so Claude’s voice read this line.', down: false };
  }
}
