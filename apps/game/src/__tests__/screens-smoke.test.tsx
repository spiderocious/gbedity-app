import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ROUTES } from '../shared/constants/routes.ts';
import { JoinCodeScreen } from '../features/onboarding/screen/join-code-screen.tsx';
import { NicknameScreen } from '../features/onboarding/screen/nickname-screen.tsx';
import { QrScanScreen } from '../features/onboarding/screen/qr-scan-screen.tsx';
import { HostStartScreen } from '../features/onboarding/screen/host-start-screen.tsx';
import { HostDisplayScreen } from '../features/onboarding/screen/host-display-screen.tsx';
import { DisplayLobbyScreen } from '../features/lobby/screen/display-lobby-screen.tsx';
import { PlayerLobbyScreen } from '../features/lobby/screen/player-lobby-screen.tsx';
import { HostLobbyScreen } from '../features/lobby/screen/host-lobby-screen.tsx';
import { CatalogueScreen } from '../features/catalogue/screen/catalogue-screen.tsx';
import { ConfigureScreen } from '../features/configure/screen/configure-screen.tsx';
import { DisplayGameScreen } from '../features/in-game/screen/display-game-screen.tsx';
import { HostGameScreen } from '../features/in-game/screen/host-game-screen.tsx';
import { PlayerGameScreen } from '../features/in-game/screen/player-game-screen.tsx';
import { DisplayResultScreen } from '../features/post-game/screen/display-result-screen.tsx';
import { HostResultScreen } from '../features/post-game/screen/host-result-screen.tsx';
import { RoundDetailScreen } from '../features/post-game/screen/round-detail-screen.tsx';
import { LeagueResultScreen } from '../features/post-game/screen/league-result-screen.tsx';
import { PlayerResultScreen } from '../features/post-game/screen/player-result-screen.tsx';
import { EdgeStatesScreen } from '../features/edge-states/screen/edge-states-screen.tsx';
import { PreviewScreensScreen } from '../features/preview-screens/preview-screens-screen.tsx';
import { GAMES } from '../shared/games/games-manifest.ts';

// Render every screen in a router and assert it mounts with visible content. This is the
// proof that "every screen works and is visible when clicked" — it catches the runtime
// blank/crash bugs that typecheck can't (bad param access, missing registry entry, etc.).

// canvas-confetti / GSAP touch canvas + rAF in ways jsdom doesn't implement; stub them so
// screens that mount them (via shared widgets) don't throw in the test environment.
vi.mock('canvas-confetti', () => ({ default: () => undefined }));

// socket.io-client opens a real connection on mount (lobby / in-game live screens). Stub it
// with an inert socket so screens render without network.
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: () => undefined,
    off: () => undefined,
    emit: () => undefined,
    close: () => undefined,
    removeAllListeners: () => undefined,
    io: { on: () => undefined },
  }),
}));

afterEach(() => {
  document.body.innerHTML = '';
});

// Screens now use React Query + (some) sockets — wrap every render in a fresh QueryClient.
function withProviders(ui: ReactNode, initialPath: string, pattern: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path={pattern} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

interface Case {
  readonly name: string;
  readonly path: string;
  readonly pattern: string;
  readonly Screen: React.ComponentType;
}

const G = '6';

const CASES: readonly Case[] = [
  { name: 'Join code', path: ROUTES.JOIN, pattern: ROUTES.JOIN, Screen: JoinCodeScreen },
  { name: 'Nickname', path: ROUTES.JOIN_NICKNAME, pattern: ROUTES.JOIN_NICKNAME, Screen: NicknameScreen },
  { name: 'QR scan', path: ROUTES.JOIN_QR, pattern: ROUTES.JOIN_QR, Screen: QrScanScreen },
  { name: 'Host start', path: ROUTES.HOST_NEW, pattern: ROUTES.HOST_NEW, Screen: HostStartScreen },
  { name: 'Host display setup', path: ROUTES.HOST_DISPLAY, pattern: ROUTES.HOST_DISPLAY, Screen: HostDisplayScreen },
  { name: 'Display lobby', path: '/host/room/GBE-4ZK/display', pattern: ROUTES.DISPLAY_LOBBY, Screen: DisplayLobbyScreen },
  { name: 'Player lobby', path: '/lobby/GBE-4ZK', pattern: ROUTES.PLAYER_LOBBY, Screen: PlayerLobbyScreen },
  { name: 'Host lobby', path: '/host/room/GBE-4ZK', pattern: ROUTES.HOST_LOBBY, Screen: HostLobbyScreen },
  { name: 'Catalogue', path: ROUTES.HOST_CATALOGUE, pattern: ROUTES.HOST_CATALOGUE, Screen: CatalogueScreen },
  // (League builder is now a redirect to the host-lobby queue, not a content screen — BUG-02.)
  { name: 'Configure', path: '/host/configure/6', pattern: ROUTES.HOST_CONFIGURE, Screen: ConfigureScreen },
  { name: 'Display game', path: `/d/GBE-4ZK/game?mock=${G}`, pattern: ROUTES.DISPLAY_GAME, Screen: DisplayGameScreen },
  { name: 'Host game', path: `/host/room/GBE-4ZK/game?mock=${G}`, pattern: ROUTES.HOST_GAME, Screen: HostGameScreen },
  { name: 'Player game', path: `/p/GBE-4ZK/game?mock=${G}`, pattern: ROUTES.PLAYER_GAME, Screen: PlayerGameScreen },
  { name: 'Display result', path: `/d/GBE-4ZK/result?mock=${G}`, pattern: ROUTES.DISPLAY_RESULT, Screen: DisplayResultScreen },
  { name: 'Host result', path: `/host/room/GBE-4ZK/result?mock=${G}`, pattern: ROUTES.HOST_RESULT, Screen: HostResultScreen },
  { name: 'Round detail', path: '/host/room/GBE-4ZK/round/1', pattern: ROUTES.HOST_ROUND_DETAIL, Screen: RoundDetailScreen },
  { name: 'League result', path: '/d/GBE-4ZK/league-result', pattern: ROUTES.DISPLAY_LEAGUE_RESULT, Screen: LeagueResultScreen },
  { name: 'Player result', path: '/p/GBE-4ZK/result', pattern: ROUTES.PLAYER_RESULT, Screen: PlayerResultScreen },
  { name: 'Edge states', path: ROUTES.EDGE_STATES, pattern: ROUTES.EDGE_STATES, Screen: EdgeStatesScreen },
  { name: 'Preview screens', path: ROUTES.PREVIEW_SCREENS, pattern: ROUTES.PREVIEW_SCREENS, Screen: PreviewScreensScreen },
];

describe('every screen renders visible content', () => {
  it.each(CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const { container } = render(withProviders(<c.Screen />, c.path, c.pattern));
    expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });
});

describe('every game renders in the in-game + configure + result shells', () => {
  it.each(GAMES.map((g) => [g.title, g.id] as const))('%s', (_title, id) => {
    for (const c of [
      { path: `/d/GBE-4ZK/game?mock=${id}`, pattern: ROUTES.DISPLAY_GAME, Screen: DisplayGameScreen },
      { path: `/p/GBE-4ZK/game?mock=${id}`, pattern: ROUTES.PLAYER_GAME, Screen: PlayerGameScreen },
      { path: `/host/configure/${id}`, pattern: ROUTES.HOST_CONFIGURE, Screen: ConfigureScreen },
      { path: `/d/GBE-4ZK/result?mock=${id}`, pattern: ROUTES.DISPLAY_RESULT, Screen: DisplayResultScreen },
    ]) {
      const { container, unmount } = render(withProviders(<c.Screen />, c.path, c.pattern));
      expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0);
      unmount();
    }
  });
});
