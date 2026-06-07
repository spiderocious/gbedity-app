import { useEffect } from "react";

import { Card, DrawerService, PlayerPill } from "@gbedity/ui";
import { useNavigate, useParams } from "react-router-dom";

import { useLobby } from "../../../shared/api/use-lobby.ts";
import { ROUTES, pathWith } from "../../../shared/constants/routes.ts";
import { RoomSocketProvider } from "../../../shared/realtime/room-socket-provider.tsx";
import {
  useRoomSocket,
  ConnectionStatus,
} from "../../../shared/realtime/room-socket-context.tsx";
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
  const { patch, status } = useRoomSocket();
  const myId = sessionStore.getPlayer()?.playerId;

  // When the host starts a game, the socket pushes a non-lobby phase — jump into play.
  useEffect(() => {
    if (patch !== null && patch.phase !== Phase.LOBBY) {
      navigate(pathWith(ROUTES.PLAYER_GAME, { code }));
    }
  }, [patch, code, navigate]);

  function leave() {
    DrawerService.confirm("Leave the room?", {
      description: "You’ll need the code to come back.",
      confirmLabel: "Leave",
      cancelLabel: "Stay",
      destructive: true,
      onConfirm: () => navigate(ROUTES.LANDING),
    });
  }

  const players = lobby.data?.players ?? [];
  const lineup = lobby.data?.lineup ?? [];

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader roomCode={code} />
      <main className="mx-auto flex max-w-md flex-col px-6 pt-8">
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
