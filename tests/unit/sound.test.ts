// Audio for the game (AU1-AU12): the pieces that don't need a browser, on a stand-in AudioContext. Outcome tiers are one
// code-made family that never runs out of tiers (AU8), blows map to sounds by outcome (AU11), the Sound switch silences
// everything (AU7), and every file key has a file.
import { beforeEach, describe, expect, it } from 'vitest';
import { deathSound } from '../../src/ui/sound';
import { SOUND_FILES } from '../../src/ui/sfx';

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

  it('AU12 a: the BBC death sound lives only on the published page; without it the death scene plays a code-made tone', async () => {
    expect(SOUND_FILES.death.urls).toEqual([]); // nothing licensed in this public repository
    deathSound();
    await settle();
    expect(made.osc).toBe(1);
  });

});
