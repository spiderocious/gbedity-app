import { useEffect } from "react";

import { Banner, Card, Checkbox, DrawerService, PlayerPill } from "@gbedity/ui";
import { useNavigate, useParams } from "react-router-dom";

import { useLobby } from "../../../shared/api/use-lobby.ts";
import { useSpectate } from "../../../shared/api/use-spectate.ts";
import { ROUTES, pathWith } from "../../../shared/constants/routes.ts";
import { RoomSocketProvider } from "../../../shared/realtime/room-socket-provider.tsx";
import {
  useRoomSocket,
  ConnectionStatus,
} from "../../../shared/realtime/room-socket-context.tsx";
import { useRoomGoneGuard } from "../../../shared/realtime/use-room-gone-guard.ts";
import { SocketRole } from "../../../shared/services/socket.ts";
import { sessionStore } from "../../../shared/services/session-store.ts";
import { Phase } from "../../../shared/types/view.ts";
import { AppHeader } from "../../../shared/widgets/app-header.tsx";
import { LineupSummary } from "../../../shared/widgets/lineup-summary.tsx";
import { seatForIndex } from "../seat.ts";

// §2.2 — player lobby. Live roster from GET /rooms/:code. The player socket auto-advances to
// the in-game screen when the host starts (the first non-lobby view patch arrives).
export function PlayerLobbyScreen() {
  const { code = "" } = useParams();
  const player = sessionStore.getPlayer();
  return (
    <RoomSocketProvider
      roomCode={code}
      role={SocketRole.PLAYER}
      {...(player?.playerId !== undefined ? { playerId: player.playerId } : {})}
      {...(player?.reconnectToken !== undefined
        ? { reconnectToken: player.reconnectToken }
        : {})}
    >
      <PlayerLobbyContent code={code} />
    </RoomSocketProvider>
  );
}

function PlayerLobbyContent({ code }: { readonly code: string }) {
  const navigate = useNavigate();
  const lobby = useLobby(code);
  // Room gone (closed/swept) → reconnect-then-"room no longer exists" modal (no silent poll failure).
  useRoomGoneGuard(lobby, { code, role: 'player' });
  const { patch, status } = useRoomSocket();
  const spectateMutation = useSpectate();
  const myId = sessionStore.getPlayer()?.playerId;

  const players = lobby.data?.players ?? [];
  const lineup = lobby.data?.lineup ?? [];
  const me = players.find((p) => p.id === myId);
  const amSpectator = me?.spectator === true;

  // When the host starts a game, the socket pushes a non-lobby phase — jump into play. SPECTATORS go
  // to the DISPLAY (TV) surface instead: it's the single hands-free spectator loop (read-only flow →
  // hold result → resume on the next game). Players go to the play surface.
  useEffect(() => {
    if (patch !== null && patch.phase !== Phase.LOBBY) {
      navigate(pathWith(amSpectator ? ROUTES.DISPLAY_GAME : ROUTES.PLAYER_GAME, { code }));
    }
  }, [patch, code, navigate, amSpectator]);

  // Opt into spectating: convert THIS seat in place (the server flips the flag + applies the
  // "(SPECTATOR)" suffix — no new seat). Confirm first; it's a per-room commitment for this game.
  function spectate() {
    if (myId === undefined) return;
    DrawerService.confirm('Spectate this game?', {
      description:
        "You won't play this round — you'll watch the whole game and see everyone's scores.",
      confirmLabel: 'Spectate',
      cancelLabel: 'Keep playing',
      onConfirm: () => {
        spectateMutation.mutate(
          { code, playerId: myId },
          {
            onSuccess: () => void lobby.refetch(),
            onError: () => DrawerService.toast('Could not switch to spectating.', { tone: 'danger' }),
          },
        );
      },
    });
  }

  function leave() {
    DrawerService.confirm("Leave the room?", {
      description: "You’ll need the code to come back.",
      confirmLabel: "Leave",
      cancelLabel: "Stay",
      destructive: true,
      onConfirm: () => navigate(ROUTES.LANDING),
    });
  }

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader roomCode={code} />
      <main className="mx-auto flex max-w-md flex-col px-6 pt-8">
        {/* A game is already running but you're on the lobby (refresh / navigated away) — one-tap
            rejoin into the live game. */}
        {lobby.data?.phase === 'in_game' ? (
          <Banner
            tone="info"
            title="A game is in progress"
            description="Jump back in to keep playing."
            cta={{ label: 'Rejoin game', onClick: () => navigate(pathWith(ROUTES.PLAYER_GAME, { code })) }}
            className="mb-4"
          />
        ) : null}
        <Card size="lg" className="flex flex-col">
          <p className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
            You&apos;re in
          </p>
          <h1 className="mt-1 font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">
            {players[0]?.nickname !== undefined
              ? `${players[0].nickname}'s room`
              : "The room"}
          </h1>
          <p className="mt-1 font-sans text-[14px] text-ink-3">
            {lineup.length > 0
              ? "Waiting for the host to start."
              : "Waiting for the host to pick a game."}
          </p>

          {lineup.length > 0 ? (
            <div className="mt-5">
              <h2 className="mb-2 font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
                Lineup
              </h2>
              <LineupSummary lineup={lineup} />
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-2">
            {players.map((p, i) => (
              <PlayerPill
                key={p.id}
                name={p.nickname}
                avatarId={p.id}
                seat={seatForIndex(i)}
                size="sm"
                isYou={p.id === myId}
                {...(p.spectator ? { tag: 'spectator' } : {})}
              />
            ))}
            {players.length === 0 ? (
              <p className="py-4 text-center font-sans text-[13px] text-ink-3">
                {status === ConnectionStatus.RECONNECTING
                  ? "Reconnecting…"
                  : "Joining…"}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex justify-center gap-1" aria-label="Waiting">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-ink-4 animate-[bob-dot_1.2s_ease-in-out_infinite]"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </Card>

        {/* Spectate opt-in (players only; hidden once you're already a spectator). A spectator
            watches the whole game read-only and never counts toward starting. */}
        {amSpectator ? (
          <p className="mt-4 self-center font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-ink-3">
            You&apos;re spectating
          </p>
        ) : (
          <Card size="sm" tone="canvas" className="mt-4">
            <Checkbox
              checked={false}
              onChange={spectate}
              label="Spectate this game — watch without playing"
            />
          </Card>
        )}

        <button
          type="button"
          onClick={leave}
          className="mt-4 self-center font-sans text-[13px] font-bold uppercase tracking-[0.1em] text-ink-3 hover:text-ink"
        >
          Leave room
        </button>
      </main>
    </div>
  );
}
