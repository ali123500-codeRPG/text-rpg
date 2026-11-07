// Entry point bundled into dist/index.html. Integration (W7) sets globalThis.__GAME_API__ to the real GameApi before
// this runs; without it the page runs on the in-memory fake (?fake=play|fell|notices for screenshots).
import './styles.css';
import type { GameApi } from '../types';
import { mountApp } from './app';
import { createFakeGame } from './fakeGame';

const real = (globalThis as { __GAME_API__?: GameApi }).__GAME_API__;
const mode = new URLSearchParams(location.search).get('fake');
const api = real ?? createFakeGame({
  autoStart: !!mode,
  fell: mode === 'fell',
  banner: mode === 'notices',
  notices: mode === 'notices' ? [
    { kind: 'scene_fallback', text: 'Scene planning failed: placeholder area.' },
    { kind: 'rate_limited', text: 'Too many requests. The story waits a moment before the next turn.' },
  ] : [],
});
mountApp(api);
