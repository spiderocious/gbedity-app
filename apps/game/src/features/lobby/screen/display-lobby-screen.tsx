import { useEffect } from 'react';

import { Logo, PlayerPill, QrCode, RoomCodeChip } from '@gbedity/ui';
import { useNavigate, useParams } from 'react-router-dom';

import { useLobby } from '../../../shared/api/use-lobby.ts';
import { ROUTES, joinUrl, pathWith } from '../../../shared/constants/routes.ts';
import { RoomSocketProvider } from '../../../shared/realtime/room-socket-provider.tsx';
import { useRoomSocket } from '../../../shared/realtime/room-socket-context.tsx';
import { SocketRole } from '../../../shared/services/socket.ts';
import { Phase } from '../../../shared/types/view.ts';
import { LineupSummary } from '../../../shared/widgets/lineup-summary.tsx';
import { seatForIndex } from '../seat.ts';

// §2.1 — display lobby (landscape, large text). A pure SPECTATOR surface: live roster from
// GET /rooms/:code + the QR/code to join. No host controls — it auto-advances to the display game
// when the host starts (the first non-lobby view patch arrives over the socket).
export function DisplayLobbyScreen() {
  const { code = '' } = useParams();
  return (
    <RoomSocketProvider roomCode={code} role={SocketRole.DISPLAY}>
      <DisplayLobbyContent code={code} />
    </RoomSocketProvider>
  );
}

function DisplayLobbyContent({ code }: { readonly code: string }) {
  const navigate = useNavigate();
  const lobby = useLobby(code);
  const { patch } = useRoomSocket();
  const players = lobby.data?.players ?? [];
  const lineup = lobby.data?.lineup ?? [];

  // Auto-advance into the display game when the host starts. The game id is detected from the
  // first patch shape on the game screen (no host queue here — this is a spectator surface).
  useEffect(() => {
    if (patch !== null && patch.phase !== Phase.LOBBY) {
      navigate(pathWith(ROUTES.DISPLAY_GAME, { code }));
    }
  }, [patch, code, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between px-10 py-6">
        <Logo size="lg" />
        <RoomCodeChip code={code} size="lg" />
        <span className="font-sans text-[14px] font-bold text-ink-3">How players join</span>
      </header>

      <div className="flex flex-1 gap-10 px-10 pb-6">
        <main className="flex flex-1 flex-col items-center justify-center gap-6">
          <QrCode url={joinUrl(code)} size={240} className="border-2 border-action" />
          <RoomCodeChip code={code} size="hero" />
          <p className="max-w-[44ch] text-center font-sans text-[20px] leading-[1.5] text-ink-3">
            Open gbedity.app on your phone and enter the code — or scan.
          </p>
        </main>

        <aside className="flex w-[340px] flex-col gap-3">
          <h2 className="font-sans text-[13px] font-extrabold uppercase tracking-[0.14em] text-ink-3">Players</h2>
          {players.map((p, i) => (
            <PlayerPill key={p.id} name={p.nickname} avatarId={p.id} seat={seatForIndex(i)} size="lg" />
          ))}
          {players.length === 0 ? <p className="font-sans text-[15px] text-ink-3">Waiting for the first player…</p> : null}

          {lineup.length > 0 ? (
            <div className="mt-4">
              <h2 className="mb-2 font-sans text-[13px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
                Lineup
              </h2>
              <LineupSummary lineup={lineup} scale="display" />
            </div>
          ) : null}
        </aside>
      </div>

      {/* The display is a SPECTATOR surface — no host controls. It auto-advances into the game when
          the host starts (the phase-change effect above). Footer is a passive status line. */}
      <footer className="flex items-center justify-center gap-4 bg-surface px-10 py-5">
        <span className="font-serif text-[24px] font-semibold text-ink">
          Waiting for the host to start · {players.length} joined
        </span>
      </footer>
    </div>
  );
}
