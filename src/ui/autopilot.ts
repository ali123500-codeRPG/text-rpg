// Watch an agent play: an autopilot bar on the Play screen. The agent picks each command (typed into the box where you can
// see it) and says one short line of commentary, read aloud with the browser's own speech voices. It plays on your story,
// or on its own save (one story per owner: yours and the agent's), and you can switch between them.
import type { GameApi } from '../types';
import { h } from './kit';
import { PERSONA_NAMES, VOICE_STYLES, autoPerk } from '../agents/autopilot';
import { recommendedBuild } from '../library/spawn';

const KEY = 'rpg.autopilot';
/** style: a VOICE_STYLES id; voiceName: a speech voice on this PC, '' = its first Japanese voice */
type Prefs = { persona: string; waitS: number; voice: boolean; style: string; voiceName: string };
const WAITS = [2, 5, 10];
const PREFS: Prefs = { persona: '', waitS: 5, voice: true, style: 'companion', voiceName: '' };
function readPrefs(): Prefs {
  try { return { ...PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...PREFS }; }
}
const voices = () => (typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices());
const japanese = () => voices().find((v) => /^ja/i.test(v.lang));
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
  let status = '', said = '', saidJa = '';
  const el = h('section', { class: 'auto', 'aria-label': 'Watch an agent play' });
  const opener = h('button', { type: 'button', class: 'hs-btn-text auto-open', title: 'An agent plays while you watch, with spoken commentary',
    onclick: () => { if (open) pause(''); open = !open; update(); } });
  const agentStory = () => api.state()?.meta.owner === 'agent';
  const stopped = () => api.notices().some((n) => n.kind === 'stop_play' || n.kind === 'read_only');

  if (typeof speechSynthesis !== 'undefined') speechSynthesis.addEventListener?.('voiceschanged', () => update()); // voices load late
  /** the chosen voice, else the PC's first Japanese voice; Japanese words only in a Japanese voice, else the English line */
  function speak(text: string, ja = '') {
    if (!prefs.voice || !text || typeof speechSynthesis === 'undefined') return;
    const voice = voices().find((v) => v.name === prefs.voiceName) ?? japanese();
    const inJa = !!ja && !!voice && /^ja/i.test(voice.lang);
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(inJa ? ja : text);
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.rate = 1.05; speechSynthesis.speak(u);
    } catch { /* no voice here */ }
  }
  const set = (s: string) => { status = s; update(); };
  function pause(why = '') { playing = false; stepping = false; set(why); redraw(); }

  async function loop() {
    let failures = 0;
    while (playing) {
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
    if (playing || api.busy() || switching) return;
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
      h('option', { value: '', selected: !prefs.voiceName }, japanese() ? `Japanese · ${japanese()!.name}` : 'Japanese (none on this PC)'),
      voices().map((v) => h('option', { value: v.name, selected: prefs.voiceName === v.name }, v.name)));
    const noJa = prefs.voice && !prefs.voiceName && typeof speechSynthesis !== 'undefined' && !japanese()
      ? 'No Japanese voice on this PC, so the default voice speaks. Add one in Windows Settings › Time & language › Speech › Add voices › Japanese, then reload.' : '';
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
        btn(prefs.voice ? '✓ Voice' : 'Voice', () => { prefs.voice = !prefs.voice; writePrefs(prefs); if (!prefs.voice && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); update(); },
          { pressed: prefs.voice, title: prefs.voice ? 'The agent’s commentary is read aloud. Click to mute it' : 'Click to read the agent’s commentary aloud' }),
        h('div', { class: 'auto-go' },
          btn('One turn', () => play(true), { disabled: playing || switching || !api.state() }),
          playing ? btn('Pause', () => pause('Paused'), { main: true }) : btn('Play', () => play(), { main: true, disabled: switching || !api.state() }),
          h('button', { type: 'button', class: 'hs-btn-text auto-x', 'aria-label': 'Close the agent bar', title: 'Close', onclick: () => { pause(''); open = false; update(); } }, '×'))),
      said ? h('p', { class: 'auto-say' }, h('span', { class: 'auto-who' }, 'Agent'), saidJa ? h('span', {}, `“${saidJa}”`, h('span', { class: 'auto-en' }, said)) : `“${said}”`) : '',
      status || (!playing && mine) ? h('p', { class: 'hs-note', role: 'status' }, status || mine!.textContent) : '',
      noJa ? h('p', { class: 'hs-note' }, noJa) : ''));
  }
  update();
  return { el, opener, update, playing: () => playing };
}
