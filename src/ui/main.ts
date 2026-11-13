// Entry point bundled into dist/play/. In the artifact it wires the real game: Claude through the `sample`
// capability, saves through the `db` capability. ?fake=play|fell|notices runs the in-memory fake (screenshots only).
import './styles.css';
import type { GameApi, Notice } from '../types';
import { mountApp } from './app';
import { createFakeGame } from './fakeGame';
import { browserClaudeClient, createGame, realClock } from '../agents';
import { createDirector } from '../agents/director';
import { artifactDbStore } from '../save/store';

async function realGame(): Promise<GameApi | null> {
  const w = globalThis as unknown as { claude?: { use(name: string): Promise<unknown> } };
  if (!w.claude) return null;
  const [client, db] = await Promise.all([browserClaudeClient(), w.claude.use('db')]);
  if (!client || !db) return null;
  return createGame({ client, clock: realClock, store: artifactDbStore(db as Parameters<typeof artifactDbStore>[0]), director: createDirector(realClock) });
}

async function main(): Promise<void> {
  const mode = new URLSearchParams(location.search).get('fake');
  const injected = (globalThis as { __GAME_API__?: GameApi }).__GAME_API__;
  const real = injected ?? (mode ? null : await realGame());
  if (real) {
    mountApp(real);
    return;
  }
  const unavailable: Notice[] = mode ? [] : [{ kind: 'stop_play', text: 'Claude or the save database is not available in this view. Sign in to Claude and allow the page to use Claude and its database, then reload.' }];
  mountApp(createFakeGame({
    autoStart: !!mode,
    fell: mode === 'fell',
    banner: mode === 'notices',
    notices: mode === 'notices' ? [
      { kind: 'scenario_fallback', text: 'Scenario planning failed: placeholder area.' },
      { kind: 'rate_limited', text: 'Too many requests. The story waits a moment before the next turn.' },
    ] : unavailable,
  }));
}

void main();
