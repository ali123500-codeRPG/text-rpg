// Audio for the game (AU1-AU12): the pieces that don't need a browser, on a stand-in AudioContext. Outcome tiers are one
// code-made family that never runs out of tiers (AU8), blows map to sounds by outcome (AU11), the Sound switch silences
// everything (AU7), and every file key has a file.
import { beforeEach, describe, expect, it } from 'vitest';
import { blowSound, deathSound, setSound, setSoundVolume, soundVolume, tierSound } from '../../src/ui/sound';
import { SOUND_FILES } from '../../src/ui/sfx';
import { HIT_OUTCOMES } from '../../src/scales';
import { CONFIG } from '../../src/config';

const made = { osc: 0, noise: 0, fetched: [] as string[] };
const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
const node = () => ({ connect: (n: unknown) => n, gain: param(), frequency: param(), Q: param(), start() {}, stop() {} });
class FakeAudio {
  state = 'running'; currentTime = 0; sampleRate = 8000; destination = node();
  createGain() { return node(); }
  createBiquadFilter() { return node(); }
  createOscillator() { made.osc++; return node(); }
  createBuffer(_c: number, n: number) { made.noise++; return { getChannelData: () => new Float32Array(n) }; }
  createBufferSource() { return node(); }
  decodeAudioData() { return Promise.resolve({}); }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
}
const store = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
g.AudioContext = FakeAudio;
g.fetch = (u: string) => { made.fetched.push(u); return Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }); };

const settle = () => new Promise((r) => setTimeout(r, 0));
beforeEach(() => { store.clear(); made.osc = 0; made.noise = 0; made.fetched = []; });

describe('game sound', () => {
  it('AU8: each tier row is one voice; each step past either end adds one more', () => {
    const top = CONFIG.SOUND.TIER.HZ.length - 1; // Critical Success
    for (const [level, voices] of [[0, 1], [3, 1], [top, 1], [top + 2, 3], [-1, 2], [-3, 4]] as const) {
      made.osc = 0;
      tierSound(level);
      expect(made.osc, `level ${level}`).toBe(voices);
    }
  });

  it('AU11: a swing that met nothing swishes; a crushing hit plays two files; every outcome has a sound', async () => {
    blowSound('missed');
    expect(made.noise).toBe(1);
    expect(made.fetched).toEqual([]);
    blowSound('crushing_hit');
    await settle();
    expect(made.fetched.length).toBe(2);
    for (const o of HIT_OUTCOMES.keys) expect(() => blowSound(o)).not.toThrow();
  });

  it('AU7: the Sound switch off silences everything; the volume is kept between 0 and 1', () => {
    setSound(false);
    tierSound(5); blowSound('missed'); blowSound('full_hit');
    expect([made.osc, made.noise, made.fetched.length]).toEqual([0, 0, 0]);
    setSound(true);
    expect(soundVolume()).toBe(CONFIG.SOUND.VOLUME_DEFAULT);
    setSoundVolume(3);
    expect(soundVolume()).toBe(1);
  });

  it('AU12 a: the BBC death sound lives only on the published page; without it the death scene plays a code-made tone', async () => {
    expect(SOUND_FILES.death.urls).toEqual([]); // nothing licensed in this public repository
    deathSound();
    await settle();
    expect(made.osc).toBe(1);
  });

  it('every sound key has a file (its own or a licensed one) and a gain from 0 to 1', () => {
    for (const [k, f] of Object.entries(SOUND_FILES)) {
      expect(f.urls.length + (f.licensed?.length ?? 0), k).toBeGreaterThan(0);
      expect(f.gain > 0 && f.gain <= 1, k).toBe(true);
    }
  });
});
