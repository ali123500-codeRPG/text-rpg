// Game sound (Audio for the game, AU1-AU12). Sound effects only for now (AU1): interface clicks, the player's own roll,
// blows that land on either side, the scenario end and the death scene. Sounds keep the motion rules (AU6): they come only
// from the newest live turn once it has resolved, never while a turn runs, and never on load, undo or earlier turns, so
// their timing can't tell which agents ran. One Sound switch and one volume slider on the play header (AU7), kept per viewer.
// Made two ways (AU2 c): outcome tiers are code-made (AU8), everything else plays a file from SOUND_FILES (src/ui/sfx.ts).
import { CONFIG } from '../config';
import { SOUND_FILES, type SoundKey } from './sfx';
import type { AttackOutcome } from '../types';

const ON = 'sound', VOL = 'sound-volume';
const read = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* kept for this page only */ } };

/** the Sound switch: on unless the viewer turned it off */
export const soundOn = (): boolean => read(ON) !== 'off';
export function setSound(on: boolean): void { write(ON, on ? 'on' : 'off'); if (!on) ctx?.suspend().catch(() => {}); }
/** the volume slider, 0 to 1 */
export function soundVolume(): number {
  const v = Number(read(VOL));
  return read(VOL) !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : CONFIG.SOUND.VOLUME_DEFAULT;
}
export function setSoundVolume(v: number): void { write(VOL, String(Math.min(1, Math.max(0, v)))); if (out) out.gain.value = soundVolume(); }

// one audio context, made on the first click: browsers only allow sound after the viewer has touched the page
let ctx: AudioContext | null = null, out: GainNode | null = null;
function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!AC) return null;
  ctx = new AC();
  out = ctx.createGain();
  out.gain.value = soundVolume();
  out.connect(ctx.destination);
  return ctx;
}
const buffers = new Map<string, Promise<AudioBuffer | null>>();
function load(c: AudioContext, url: string): Promise<AudioBuffer | null> {
  let b = buffers.get(url);
  if (!b) { b = fetch(url).then((r) => r.arrayBuffer()).then((a) => c.decodeAudioData(a)).catch(() => null); buffers.set(url, b); }
  return b;
}

const pick = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)];
// licensed files exist only on the published page: a page opened from disk (the smoke tests) can't fetch them at all
const servedFiles = () => typeof location !== 'undefined' && location.protocol.startsWith('http');
const licensedOf = (key: SoundKey) => (servedFiles() ? SOUND_FILES[key].licensed ?? [] : []);

/** plays one sound `delay` ms from now; a key with several files picks one at random so repeats don't sound copied. Its
 * licensed file comes first, then its own files; with neither, `fallback` plays instead */
export function sfx(key: SoundKey, delay = 0, gain = 1, fallback?: () => void): void {
  if (!soundOn()) return;
  const c = audio();
  if (!c || !out) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const files = SOUND_FILES[key], lic = licensedOf(key);
  const first = lic.length ? load(c, pick(lic)) : Promise.resolve(null);
  void first.then((b) => b ?? (files.urls.length ? load(c, pick(files.urls)) : null)).then((buf) => {
    if (!soundOn()) return;
    if (!buf) { fallback?.(); return; }
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf; g.gain.value = files.gain * gain;
    src.connect(g).connect(out!);
    src.start(c.currentTime + Math.max(0, delay) / 1000);
  });
}

/** AU8: the player's own roll, one code-made sound family across the tiers. `level` is the tier's row in TIERS (0 Critical
 * Failure to 5 Critical Success) plus any steps past either end: a low dull thud at the bottom rising to a bright ring at the
 * top, and each step past either end adds one more voice (an octave out), so it never runs out of tiers. */
export function tierSound(level: number, delay = 0): void {
  if (!soundOn()) return;
  const c = audio();
  if (!c || !out) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const T = CONFIG.SOUND.TIER;
  const top = T.HZ.length - 1, row = Math.min(top, Math.max(0, level)), past = level - row;
  const at = c.currentTime + Math.max(0, delay) / 1000;
  const bright = row / top; // 0 dull … 1 bright
  const dur = T.DUR_S[0] + (T.DUR_S[1] - T.DUR_S[0]) * Math.abs(bright - 0.5) * 2; // the ends ring longer than the middle
  const voices = [1, ...Array.from({ length: Math.abs(past) }, (_, i) => (past > 0 ? 2 : 0.5) ** (i + 1))];
  for (const [i, k] of voices.entries()) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = bright >= 0.5 ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(T.HZ[row] * k, at);
    if (bright < 0.5) o.frequency.exponentialRampToValueAtTime(T.HZ[row] * k * T.FALL, at + dur); // failures sag
    const peak = T.GAIN / (i + 1);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(out);
    o.start(at); o.stop(at + dur + 0.02);
  }
}

/** a soft noise sweep: a swing that met nothing (missed, dodged) */
export function swish(delay = 0): void {
  if (!soundOn()) return;
  const c = audio();
  if (!c || !out) return;
  const S = CONFIG.SOUND.SWISH, at = c.currentTime + Math.max(0, delay) / 1000;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * S.DUR_S), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(S.HZ[0], at); f.frequency.exponentialRampToValueAtTime(S.HZ[1], at + S.DUR_S);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(S.GAIN, at + S.DUR_S * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, at + S.DUR_S);
  src.connect(f).connect(g).connect(out);
  src.start(at);
}

/** a blow by its outcome (AU11: Kenney's impacts): a swing that met nothing swishes; steel, shield, graze and hits get heavier
 * with the outcome, and a crushing hit lays plate over a heavy hit */
const BLOW: Record<AttackOutcome, SoundKey[]> = { missed: [], dodged: [], parried: ['parry'], blocked: ['block'], grazed: ['graze'], full_hit: ['hit'], heavy_hit: ['heavy'], crushing_hit: ['heavy', 'crush'] };
export function blowSound(o: AttackOutcome, delay = 0): void {
  const keys = BLOW[o];
  if (!keys.length) { swish(delay); return; }
  for (const k of keys) sfx(k, delay);
}

/** the death scene: BBC's groan and body fall, or a low falling tone where that file is missing */
export function deathSound(): void { sfx('death', 0, 1, fallTone); }
function fallTone(): void {
  if (!soundOn()) return;
  const c = audio();
  if (!c || !out) return;
  const D = CONFIG.SOUND.DEATH, at = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(D.HZ[0], at); o.frequency.exponentialRampToValueAtTime(D.HZ[1], at + D.DUR_S);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(D.GAIN, at + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, at + D.DUR_S);
  o.connect(g).connect(out);
  o.start(at); o.stop(at + D.DUR_S + 0.05);
}

/** AU1: every clickable on the page clicks, once, from one listener; the first click also opens the audio context */
let lastClick = 0;
export function listenForClicks(root: Document = document): void {
  root.addEventListener('pointerdown', () => {
    const c = audio();
    if (!c) return;
    if (c.state === 'suspended' && soundOn()) c.resume().catch(() => {});
    for (const [k, f] of Object.entries(SOUND_FILES)) for (const u of [...licensedOf(k as SoundKey), ...f.urls]) void load(c, u); // ready before the first turn needs them
  }, { capture: true });
  root.addEventListener('click', (e) => {
    const t = e.target as Element | null;
    if (!t?.closest?.('button, a[href], summary, [role="button"], [role="tab"], select, input[type="checkbox"], input[type="radio"]')) return;
    if (t.closest('input[type="range"]')) return;
    const now = Date.now();
    if (now - lastClick < CONFIG.SOUND.CLICK_GAP_MS) return;
    lastClick = now;
    sfx('click');
  }, { capture: true });
}
