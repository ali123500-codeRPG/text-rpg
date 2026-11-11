// Watch an agent play: an autopilot bar on the Play screen. The agent picks each command (typed into the box where you can
// see it) and says a few lines of commentary, read aloud in one of Claude's own voices. It plays on your story,
// or on its own save (one story per owner: yours and the agent's), and you can switch between them.
import type { GameApi } from '../types';
import { h } from './kit';
import { PERSONA_NAMES, VOICE_STYLES, autoPerk } from '../agents/autopilot';
import { recommendedBuild } from '../library/spawn';

const KEY = 'rpg.autopilot';
/** style: a VOICE_STYLES id; voiceName: 'claude:<voice>' (one of Claude's own voices), anything else = Buttery */
type Prefs = { persona: string; waitS: number; voice: boolean; style: string; voiceName: string; rate: number };
const WAITS = [2, 5, 10];
const RATES = [1, 1.25, 1.5]; // speaking speed (Claude's voices read at most 1.5×)
const PREFS: Prefs = { persona: '', waitS: 5, voice: true, style: 'companion', voiceName: '', rate: 1.5 };
function readPrefs(): Prefs {
  try { return { ...PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...PREFS }; }
}
/** Claude's own voices: the page's tts capability (null where it can't speak, e.g. not declared or not offered) */
const CLAUDE_VOICES = ['buttery', 'airy', 'glassy', 'rounded'];
type Tts = { speak(text: string, o: { voice: string; rate: number; language: string }): Promise<unknown>; stop(): Promise<void>; onState?(cb: (s: { state: string }) => void): unknown };
const writePrefs = (p: Prefs) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* per-PC convenience only */ } };
/** what the bar was doing, kept for this tab so a reload or a new version of the page carries on where it was */
const RUN = 'rpg.autopilot.run';
type Run = { open: boolean; playing: boolean; owner: 'player' | 'agent' };
function readRun(): Run | null { try { return JSON.parse(sessionStorage.getItem(RUN) ?? 'null'); } catch { return null; } }
const writeRun = (r: Run) => { try { sessionStorage.setItem(RUN, JSON.stringify(r)); } catch { /* per-tab convenience only */ } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** el: the bar under Who's here (empty while closed); opener: the header switch beside Show rolls */
export type Autopilot = { el: HTMLElement; opener: HTMLElement; update: () => void; playing: () => boolean };

/** `typeAndSend` types the command into the action box, then sends it like the Send button (resolves when the turn is done) */
export function autopilotBar(api: GameApi, typeAndSend: (text: string) => Promise<void>, redraw: () => void): Autopilot {
  const prefs = readPrefs();
  let restore = readRun(); // carried on once the story has loaded
  let open = !!restore?.open, playing = false, stepping = false, switching = false;
  let status = '', said = '', saidJa = '', voiceNote = '';
  let tts: Tts | null = null, talking = false;
  void (async () => {
    try { tts = ((await (globalThis as { claude?: { use(n: string): Promise<unknown> } }).claude?.use('tts')) ?? null) as Tts | null; } catch { tts = null; }
    tts?.onState?.((s) => { talking = s.state !== 'idle'; update(); });
    update();
  })();
  const el = h('section', { class: 'auto', 'aria-label': 'Watch an agent play' });
  const opener = h('button', { type: 'button', class: 'hs-btn-text auto-open', title: 'An agent plays while you watch, with spoken commentary',
    onclick: () => { if (open) pause(''); open = !open; update(); } });
  const agentStory = () => api.state()?.meta.owner === 'agent';
  const stopped = () => api.notices().some((n) => n.kind === 'stop_play' || n.kind === 'read_only');

  const claudeVoice = () => (prefs.voiceName.startsWith('claude:') ? prefs.voiceName.slice(7) : CLAUDE_VOICES[0]);
  /** in the chosen Claude voice (Japanese read as Japanese); where Claude can't speak, the line is only shown */
  function speak(text: string, ja = '') {
    if (!prefs.voice || !text || !tts) return;
    tts.speak(ja || text, { voice: claudeVoice(), rate: Math.min(prefs.rate, RATES.at(-1)!), language: ja ? 'ja' : 'en' }).then(() => { voiceNote = ''; }, (e: { code?: string }) => {
      if (e?.code === 'stopped' || e?.code === 'viewer_stopped') return;
      voiceNote = e?.code === 'rate_limited' ? 'Claude’s voice has used its allowance for now, so this line is shown only.' : 'Claude’s voice couldn’t read that line.';
      update();
    });
  }
  const set = (s: string) => { status = s; update(); };
  function pause(why = '') { playing = false; stepping = false; set(why); redraw(); }

  async function loop() {
    let failures = 0;
    while (playing) {
      if (api.busy()) set('Waiting for the story to finish the turn…');
      while (api.busy() && playing) await sleep(300);
      if (!playing) break;
      if (stopped()) { pause('Stopped: the story can’t take turns right now.'); break; }
      if (api.fell()) { pause('The character fell. Undo a turn or reset to go on.'); break; }
      set('Thinking about the next move…');
      const mv = await api.agentMove(prefs.persona, prefs.style);
      if (!playing) break;
      if (!mv) { if (++failures >= 2) { pause('The agent couldn’t decide: the Claude call failed twice.'); break; } continue; }
      failures = 0;
      said = mv.say; saidJa = mv.ja ?? '';
      speak(mv.say, saidJa);
      set('Typing…');
      await typeAndSend(mv.command);
      // on its own save the agent spends its perk points itself (the open milestone of its highest skill)
      const p = api.state()?.player;
      if (agentStory() && p?.progression) for (let id = autoPerk(p); p.progression.unspentPerkPoints > 0 && id; id = autoPerk(p)) api.takePerk(id);
      if (stepping || !playing) { pause(''); break; }
      set(`Next move in ${prefs.waitS} s`);
      await sleep(prefs.waitS * 1000);
    }
  }
  function play(step = false) {
    if (playing || switching) return; // a turn still running is waited for, never a reason to ignore the click
    playing = true; stepping = step; redraw();
    void loop().catch((e) => pause(`The agent stopped: ${(e as Error).message}`));
  }

  /** switch the Play screen to the agent's own save (made on first use) or back to the player's story */
  async function useSave(owner: 'player' | 'agent') {
    if (switching || (owner === 'agent') === agentStory()) return;
    pause('');
    switching = true; set(owner === 'agent' ? 'Opening the agent’s own story…' : 'Opening your story…');
    try {
      const found = await api.resume(owner);
      if (!found && owner === 'agent') await api.newStory({ ...recommendedBuild(), name: 'Wren' }, { owner: 'agent' });
      set('');
    } catch (e) { set(`Couldn’t switch: ${(e as Error).message}`); }
    finally { switching = false; redraw(); }
  }

  function update() {
    if (restore && api.state() && !api.busy() && !switching) {
      const r = restore; restore = null;
      void (async () => { await sleep(0); /* after the screen has finished building */ if (r.owner === 'agent' && !agentStory()) await useSave('agent'); if (r.playing) play(); })();
    }
    if (!restore && api.state()) writeRun({ open, playing: playing && !stepping, owner: agentStory() ? 'agent' : 'player' });
    if (document.activeElement?.tagName === 'SELECT' && el.contains(document.activeElement)) return; // don't close an open list
    const btn = (label: string, on: () => void, o: { pressed?: boolean; disabled?: boolean; main?: boolean; title?: string; agent?: boolean } = {}) => h('button', {
      type: 'button', class: (o.main ? 'hs-btn-main' : 'hs-btn-text') + (o.agent ? ' auto-agent' : ''), onclick: on, disabled: o.disabled, title: o.title,
      'aria-pressed': o.pressed === undefined ? undefined : String(o.pressed) }, label);
    const mine = agentStory() ? null : h('p', { class: 'hs-note' }, 'The agent’s turns are saved to your story like your own. Undo works one turn back.');
    opener.textContent = open ? '✓ Watch an agent play' : 'Watch an agent play';
    opener.setAttribute('aria-pressed', String(open));
    // on the agent's own story the opener and the "Its own story" choice turn yellow instead of a banner (no extra row)
    opener.classList.toggle('auto-agent', agentStory());
    opener.title = agentStory() ? 'You’re watching the agent’s own story. Your story is kept as it is.' : 'An agent plays while you watch, with spoken commentary';
    if (!open) { el.replaceChildren(); return; }
    const persona = h('select', { 'aria-label': 'Playstyle', onchange: (e: Event) => { prefs.persona = (e.target as HTMLSelectElement).value; writePrefs(prefs); } },
      PERSONA_NAMES.map(([id, name]) => h('option', { value: id, selected: prefs.persona === id }, name)));
    const style = h('select', { 'aria-label': 'Voice style', onchange: (e: Event) => { prefs.style = (e.target as HTMLSelectElement).value; writePrefs(prefs); } },
      VOICE_STYLES.map(([id, name]) => h('option', { value: id, selected: prefs.style === id }, name)));
    const voicePick = h('select', { 'aria-label': 'Speaking voice', onchange: (e: Event) => { prefs.voiceName = (e.target as HTMLSelectElement).value; writePrefs(prefs); } },
      CLAUDE_VOICES.map((v) => h('option', { value: `claude:${v}`, selected: claudeVoice() === v }, `${v[0].toUpperCase()}${v.slice(1)}`)));
    const rate = h('select', { 'aria-label': 'Speaking speed', onchange: (e: Event) => { prefs.rate = +(e.target as HTMLSelectElement).value; writePrefs(prefs); } },
      RATES.map((r) => h('option', { value: String(r), selected: prefs.rate === r }, `${r}×`)));
    const noVoice = prefs.voice && !tts ? 'Claude’s voice isn’t available in this view, so the commentary is shown only.' : '';
    const wait = h('select', { 'aria-label': 'Wait between turns', onchange: (e: Event) => { prefs.waitS = +(e.target as HTMLSelectElement).value; writePrefs(prefs); } },
      WAITS.map((s) => h('option', { value: String(s), selected: prefs.waitS === s }, `${s} s a turn`)));
    el.replaceChildren(h('div', { class: 'auto-panel' },
      h('div', { class: 'auto-row' },
        h('div', { class: 'hs-picker', role: 'group', 'aria-label': 'Which story' },
          btn('On my story', () => void useSave('player'), { pressed: !agentStory(), disabled: switching }),
          btn('Its own story', () => void useSave('agent'), { pressed: agentStory(), disabled: switching, agent: true })),
        h('label', { class: 'auto-field' }, 'Playstyle', persona),
        h('label', { class: 'auto-field' }, 'Pace', wait),
        h('label', { class: 'auto-field' }, 'Style', style),
        h('label', { class: 'auto-field' }, 'Speaker', voicePick),
        h('label', { class: 'auto-field' }, 'Speed', rate),
        btn(prefs.voice ? '✓ Voice' : 'Voice', () => { prefs.voice = !prefs.voice; writePrefs(prefs); if (!prefs.voice) void tts?.stop(); update(); },
          { pressed: prefs.voice, title: prefs.voice ? 'The agent’s commentary is read aloud. Click to mute it' : 'Click to read the agent’s commentary aloud' }),
        h('div', { class: 'auto-go' },
          talking ? btn('Stop voice', () => void tts?.stop(), { title: 'Stop reading this line aloud' }) : '',
          btn('One turn', () => play(true), { disabled: playing || switching || !api.state() }),
          playing ? btn('Pause', () => pause('Paused'), { main: true }) : btn('Play', () => play(), { main: true, disabled: switching || !api.state() }),
          h('button', { type: 'button', class: 'hs-btn-text auto-x', 'aria-label': 'Close the agent bar', title: 'Close', onclick: () => { pause(''); open = false; update(); } }, '×'))),
      said ? h('p', { class: 'auto-say' }, h('span', { class: 'auto-who' }, 'Agent'), saidJa ? h('span', {}, `“${saidJa}”`, h('span', { class: 'auto-en' }, said)) : `“${said}”`) : '',
      status || (!playing && mine) ? h('p', { class: 'hs-note', role: 'status' }, status || mine!.textContent) : '',
      noVoice || voiceNote ? h('p', { class: 'hs-note' }, noVoice || voiceNote) : ''));
  }
  update();
  return { el, opener, update, playing: () => playing };
}
