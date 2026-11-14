// Entry point bundled into dist/play/. In the artifact it wires the real game: Claude through the `sample`
// capability, saves through the `db` capability. ?fake=play|fell|notices runs the in-memory fake (screenshots only);
// &stage=bent-nail|one-room|long-names swaps its world for a map test stage.
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
  const q = new URLSearchParams(location.search), mode = q.get('fake'), stage = q.get('stage') ?? undefined; // stage: a map test stage (fakeStages)
  const injected = (globalThis as { __GAME_API__?: GameApi }).__GAME_API__;
  const real = injected ?? (mode ? null : await realGame());
  if (real) {
    mountApp(real);
    return;
  }
  const unavailable: Notice[] = mode ? [] : [{ kind: 'stop_play', text: 'Claude or the save database is not available in this view. Sign in to Claude and allow the page to use Claude and its database, then reload.' }];
  const fake = createFakeGame({
    autoStart: !!mode,
    fell: mode === 'fell',
    banner: mode === 'notices',
    stage,
    achievements: mode === 'achievements',
    notices: mode === 'notices' ? [
      { kind: 'scenario_fallback', text: 'Scenario planning failed: placeholder area.' },
      { kind: 'rate_limited', text: 'Too many requests. The story waits a moment before the next turn.' },
    ] : unavailable,
  });
  // screenshot scripts set up a case (classes, offers…) through it; only in fake mode
  if (mode) (globalThis as { __FAKE_GAME__?: GameApi }).__FAKE_GAME__ = fake;
  mountApp(fake);
}

void main();
