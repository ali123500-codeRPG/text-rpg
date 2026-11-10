// Watch an agent play: an autopilot bar on the Play screen. The agent picks each command (typed into the box where you can
// see it) and says one short line of commentary, read aloud with the browser's own speech voices. It plays on your story,
// or on its own save (one story per owner: yours and the agent's), and you can switch between them.
import type { GameApi } from '../types';
import { h } from './kit';
import { PERSONA_NAMES, autoPerk } from '../agents/autopilot';
import { recommendedBuild } from '../library/spawn';

const KEY = 'rpg.autopilot';
type Prefs = { persona: string; waitS: number; voice: boolean };
const WAITS = [2, 5, 10];
function readPrefs(): Prefs {
  try { return { persona: '', waitS: 5, voice: true, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { persona: '', waitS: 5, voice: true }; }
}
const writePrefs = (p: Prefs) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* per-PC convenience only */ } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Autopilot = { el: HTMLElement; update: () => void; playing: () => boolean };

/** `typeAndSend` types the command into the action box, then sends it like the Send button (resolves when the turn is done) */
export function autopilotBar(api: GameApi, typeAndSend: (text: string) => Promise<void>, redraw: () => void): Autopilot {
  const prefs = readPrefs();
  let open = false, playing = false, stepping = false, switching = false;
  let status = '', said = '';
  const el = h('section', { class: 'auto', 'aria-label': 'Watch an agent play' });
  const agentStory = () => api.state()?.meta.owner === 'agent';
  const stopped = () => api.notices().some((n) => n.kind === 'stop_play' || n.kind === 'read_only');

  function speak(text: string) {
    if (!prefs.voice || !text || typeof speechSynthesis === 'undefined') return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; speechSynthesis.speak(u); } catch { /* no voice here */ }
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
      const mv = await api.agentMove(prefs.persona);
      if (!playing) break;
      if (!mv) { if (++failures >= 2) { pause('The agent couldn’t decide: the Claude call failed twice.'); break; } continue; }
      failures = 0;
      said = mv.say;
      speak(mv.say);
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
    if (document.activeElement?.tagName === 'SELECT' && el.contains(document.activeElement)) return; // don't close an open list
    const btn = (label: string, on: () => void, o: { pressed?: boolean; disabled?: boolean; main?: boolean; title?: string } = {}) => h('button', {
      type: 'button', class: o.main ? 'hs-btn-main' : 'hs-btn-text', onclick: on, disabled: o.disabled, title: o.title,
      'aria-pressed': o.pressed === undefined ? undefined : String(o.pressed) }, label);
    const mine = agentStory() ? null : h('p', { class: 'hs-note' }, 'The agent’s turns are saved to your story like your own. Undo works one turn back.');
    const banner = agentStory() ? h('div', { class: 'auto-own' }, h('span', {}, 'You’re watching the agent’s own story. Your story is kept as it is.'),
      btn('Back to my story', () => void useSave('player'), { disabled: switching })) : null;
    if (!open) {
      el.replaceChildren(banner ?? '', h('div', { class: 'auto-row end' }, btn('Watch an agent play', () => { open = true; update(); }, { title: 'An agent plays while you watch, with spoken commentary' })));
      return;
    }
    const persona = h('select', { 'aria-label': 'Playstyle', onchange: (e: Event) => { prefs.persona = (e.target as HTMLSelectElement).value; writePrefs(prefs); } },
      PERSONA_NAMES.map(([id, name]) => h('option', { value: id, selected: prefs.persona === id }, name)));
    const wait = h('select', { 'aria-label': 'Wait between turns', onchange: (e: Event) => { prefs.waitS = +(e.target as HTMLSelectElement).value; writePrefs(prefs); } },
      WAITS.map((s) => h('option', { value: String(s), selected: prefs.waitS === s }, `${s} s between turns`)));
    el.replaceChildren(banner ?? '', h('div', { class: 'auto-row' },
      h('div', { class: 'hs-picker', role: 'group', 'aria-label': 'Which story' },
        btn('On my story', () => void useSave('player'), { pressed: !agentStory(), disabled: switching }),
        btn('Its own story', () => void useSave('agent'), { pressed: agentStory(), disabled: switching })),
      h('label', { class: 'hs-label' }, 'Playstyle ', persona), wait,
      btn(prefs.voice ? 'Voice on' : 'Voice off', () => { prefs.voice = !prefs.voice; writePrefs(prefs); if (!prefs.voice && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); update(); }, { pressed: prefs.voice }),
      playing ? btn('Pause', () => pause('Paused'), { main: true }) : btn('Play', () => play(), { main: true, disabled: switching || !api.state() }),
      btn('One turn', () => play(true), { disabled: playing || switching || !api.state() }),
      btn('Close ×', () => { pause(''); open = false; update(); })),
    said ? h('p', { class: 'auto-say' }, h('b', {}, 'Agent: '), `“${said}”`) : '',
    status ? h('p', { class: 'hs-note', role: 'status' }, status) : '', playing ? '' : mine ?? '');
  }
  update();
  return { el, update, playing: () => playing };
}
