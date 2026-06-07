import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  type RouteObject,
} from "react-router-dom";

import { ROUTES } from "./shared/constants/routes.ts";

// Lazy-load every screen so each route is its own chunk. Screens are grouped by feature
// slice (onboarding, lobby, catalogue, configure, in-game, post-game, edge-states); the
// landing + preview keep their existing route files.

const lazyDefault = <T extends Record<string, unknown>>(
  loader: () => Promise<T>,
  name: string,
) =>
  lazy(() =>
    loader().then((m) => ({ default: m[name] as React.ComponentType })),
  );

const LandingScreen = lazyDefault(
  () => import("./features/landing/screen/landing-screen.tsx"),
  "LandingScreen",
);
const PreviewScreen = lazyDefault(
  () => import("./features/preview/screen/preview-screen.tsx"),
  "PreviewScreen",
);

const JoinCodeScreen = lazyDefault(
  () => import("./features/onboarding/screen/join-code-screen.tsx"),
  "JoinCodeScreen",
);
const NicknameScreen = lazyDefault(
  () => import("./features/onboarding/screen/nickname-screen.tsx"),
  "NicknameScreen",
);
const QrScanScreen = lazyDefault(
  () => import("./features/onboarding/screen/qr-scan-screen.tsx"),
  "QrScanScreen",
);
const HostStartScreen = lazyDefault(
  () => import("./features/onboarding/screen/host-start-screen.tsx"),
  "HostStartScreen",
);
const HostDisplayScreen = lazyDefault(
  () => import("./features/onboarding/screen/host-display-screen.tsx"),
  "HostDisplayScreen",
);

const DisplayLobbyScreen = lazyDefault(
  () => import("./features/lobby/screen/display-lobby-screen.tsx"),
  "DisplayLobbyScreen",
);
const PlayerLobbyScreen = lazyDefault(
  () => import("./features/lobby/screen/player-lobby-screen.tsx"),
  "PlayerLobbyScreen",
);
const HostLobbyScreen = lazyDefault(
  () => import("./features/lobby/screen/host-lobby-screen.tsx"),
  "HostLobbyScreen",
);

const CatalogueScreen = lazyDefault(
  () => import("./features/catalogue/screen/catalogue-screen.tsx"),
  "CatalogueScreen",
);
const LeagueBuilderScreen = lazyDefault(
  () => import("./features/catalogue/screen/league-builder-screen.tsx"),
  "LeagueBuilderScreen",
);

const ConfigureScreen = lazyDefault(
  () => import("./features/configure/screen/configure-screen.tsx"),
  "ConfigureScreen",
);

const DisplayGameScreen = lazyDefault(
  () => import("./features/in-game/screen/display-game-screen.tsx"),
  "DisplayGameScreen",
);
const HostGameScreen = lazyDefault(
  () => import("./features/in-game/screen/host-game-screen.tsx"),
  "HostGameScreen",
);
const PlayerGameScreen = lazyDefault(
  () => import("./features/in-game/screen/player-game-screen.tsx"),
  "PlayerGameScreen",
);

const DisplayResultScreen = lazyDefault(
  () => import("./features/post-game/screen/display-result-screen.tsx"),
  "DisplayResultScreen",
);
const HostResultScreen = lazyDefault(
  () => import("./features/post-game/screen/host-result-screen.tsx"),
  "HostResultScreen",
);
const RoundDetailScreen = lazyDefault(
  () => import("./features/post-game/screen/round-detail-screen.tsx"),
  "RoundDetailScreen",
);
const LeagueResultScreen = lazyDefault(
  () => import("./features/post-game/screen/league-result-screen.tsx"),
  "LeagueResultScreen",
);
const PlayerResultScreen = lazyDefault(
  () => import("./features/post-game/screen/player-result-screen.tsx"),
  "PlayerResultScreen",
);

const EdgeStatesScreen = lazyDefault(
  () => import("./features/edge-states/screen/edge-states-screen.tsx"),
  "EdgeStatesScreen",
);
const PreviewScreensScreen = lazyDefault(
  () => import("./features/preview-screens/preview-screens-screen.tsx"),
  "PreviewScreensScreen",
);

const routes: RouteObject[] = [
  { path: ROUTES.LANDING, Component: LandingScreen },
  { path: ROUTES.PREVIEW, Component: PreviewScreen },

  { path: ROUTES.JOIN, Component: JoinCodeScreen },
  // Backend's join_url is /join/:code — the QR target. Reuses the code-entry screen, which
  // pre-fills from the :code param.
  { path: ROUTES.JOIN_WITH_CODE, Component: JoinCodeScreen },
  { path: ROUTES.JOIN_NICKNAME, Component: NicknameScreen },
  { path: ROUTES.JOIN_QR, Component: QrScanScreen },

  { path: ROUTES.HOST_NEW, Component: HostStartScreen },
  { path: ROUTES.HOST_DISPLAY, Component: HostDisplayScreen },
  { path: ROUTES.HOST_CATALOGUE, Component: CatalogueScreen },
  { path: ROUTES.HOST_CONFIGURE, Component: ConfigureScreen },
  { path: ROUTES.HOST_LEAGUE_NEW, Component: LeagueBuilderScreen },

  { path: ROUTES.PLAYER_LOBBY, Component: PlayerLobbyScreen },
  { path: ROUTES.HOST_LOBBY, Component: HostLobbyScreen },
  { path: ROUTES.DISPLAY_LOBBY, Component: DisplayLobbyScreen },
  // Backend's display_url is /display/:code — the shared-screen entry. Routes to the display
  // lobby, which shows the code + QR and auto-advances into the game when the host starts.
  { path: ROUTES.DISPLAY, Component: DisplayLobbyScreen },

  { path: ROUTES.DISPLAY_GAME, Component: DisplayGameScreen },
  { path: ROUTES.HOST_GAME, Component: HostGameScreen },
  { path: ROUTES.PLAYER_GAME, Component: PlayerGameScreen },

  { path: ROUTES.DISPLAY_RESULT, Component: DisplayResultScreen },
  { path: ROUTES.HOST_RESULT, Component: HostResultScreen },
  { path: ROUTES.HOST_ROUND_DETAIL, Component: RoundDetailScreen },
  { path: ROUTES.DISPLAY_LEAGUE_RESULT, Component: LeagueResultScreen },
  { path: ROUTES.PLAYER_RESULT, Component: PlayerResultScreen },

  { path: ROUTES.EDGE_STATES, Component: EdgeStatesScreen },
  { path: ROUTES.PREVIEW_SCREENS, Component: PreviewScreensScreen },
];

const router = createBrowserRouter(routes);

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
