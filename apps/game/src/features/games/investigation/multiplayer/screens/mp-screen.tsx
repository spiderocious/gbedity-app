import { useEffect, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { ROUTES, pathWith } from '../../../../../shared/constants/routes.ts';
import { sessionStore } from '../../../../../shared/services/session-store.ts';
import { useLobby } from '../../../../../shared/api/use-lobby.ts';
import { seatForIndex } from '../../../../lobby/seat.ts';
import { InvestigateScreen } from '../../screens/investigate-screen.tsx';
import { AccuseScreen } from '../../screens/accuse-screen.tsx';
import { RevealScreen } from '../../screens/reveal-screen.tsx';
import { FinalBoardScreen } from '../../screens/final-board-screen.tsx';
import { SlideFrame, SlideTone } from '../../ui/slide-frame.tsx';
import { HostControlStrip } from '../../../../in-game/widgets/host-control-strip.tsx';
import { toMockCase } from '../../to-mock-case.ts';
import { InvBackendPhase } from '../logic/patch.ts';
import { MpAudience, useMpInvestigation } from '../logic/use-mp-investigation.ts';

// Multiplayer container for Investigation: engine-driven, audience-aware. The engine phase is just
// investigate → reveal → done; the CLIENT adds the briefing/accuse beats. During investigate, the
// player works the case and (when ready) opens the accuse screen — locking in sends the socket
// action; after that they wait. Spectator is read-only. Host carries the control strip. Timing comes
// from the patch deadline. The three generic in-game screens branch here when backendId==='investigation'.

interface MpInvestigationScreenProps {
  readonly audience: MpAudience;
  readonly code: string;
}

const useDeadlineSeconds = (deadline: number | null): number => {
  const [s, setS] = useState(() => (deadline === null ? 0 : Math.max(0, (deadline - Date.now()) / 1000)));
  useEffect(() => {
    if (deadline === null) {
      setS(0);
      return undefined;
    }
    setS(Math.max(0, (deadline - Date.now()) / 1000));
    const id = window.setInterval(() => setS(Math.max(0, (deadline - Date.now()) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [deadline]);
  return s;
};

export function MpInvestigationScreen({ audience, code }: MpInvestigationScreenProps) {
  const navigate = useNavigate();
  const game = useMpInvestigation(audience);
  const { view, gameOver } = game;
  const isHost = audience === MpAudience.HOST;
  const isSpectator = audience === MpAudience.SPECTATOR;
  const myId = sessionStore.getPlayer()?.playerId;

  // Player names + seats for the final board (the patch board carries playerId + points only).
  const lobby = useLobby(code, code !== '', false);
  const roster = lobby.data?.players ?? [];
  const nameOf = (id: string): string => roster.find((p) => p.id === id)?.nickname ?? 'Player';
  const seatOf = (id: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 => {
    const idx = roster.findIndex((p) => p.id === id);
    return seatForIndex(idx >= 0 ? idx : 0);
  };

  // Client-local sub-view during the backend `investigate` phase: workspace ↔ accuse.
  const [accusing, setAccusing] = useState(false);
  const shownAtRef = useRef(Date.now());

  const secondsLeft = useDeadlineSeconds(view?.deadline ?? null);

  // Player/host leave for the result screen on game-over; spectator holds the board.
  useEffect(() => {
    if (!gameOver || isSpectator) return;
    navigate(pathWith(isHost ? ROUTES.HOST_RESULT : ROUTES.PLAYER_RESULT, { code }));
  }, [gameOver, isSpectator, isHost, code, navigate]);

  if (view === null) {
    return (
      <SlideFrame tone={SlideTone.STAGE}>
        <p className="font-sans text-[16px] font-bold text-surface">{gameOver ? 'Wrapping up…' : 'Opening the case file…'}</p>
      </SlideFrame>
    );
  }

  const liveCase = toMockCase(view);
  const reveal = view.phase === InvBackendPhase.REVEAL || view.phase === InvBackendPhase.DONE;

  const withHostControls = (node: React.ReactNode): React.ReactNode =>
    isHost ? (
      <div className="pb-20">
        {node}
        <HostControlStrip controls={{ skip: true }} onSkip={game.endGame} onEndGame={game.endGame} />
      </div>
    ) : (
      node
    );

  // REVEAL / DONE → the truth, scored off the patch board.
  if (reveal) {
    const revealed = toMockCase(view, {
      solutionSuspectId: view.solutionSuspectId ?? '',
      keyEvidenceId: view.keyEvidenceId ?? '',
      explanation: view.explanation,
    });
    if (view.phase === InvBackendPhase.DONE) {
      // The full standings — every player from the patch board (already sorted desc), named from the
      // lobby. "You" marks the local player. A non-zero score means they named the culprit (wrong = 0).
      const rows = view.board.map((r) => {
        const mine = r.playerId === myId;
        return {
          name: mine ? `${nameOf(r.playerId)} (You)` : nameOf(r.playerId),
          score: r.points,
          seat: seatOf(r.playerId),
          detail: r.points > 0 ? 'cracked the case' : 'wrong call',
        };
      });
      return withHostControls(
        <FinalBoardScreen
          rows={rows.length > 0 ? rows : [{ name: 'No detectives', score: 0, seat: 1 as const }]}
          onReplay={() => navigate(pathWith(isHost ? ROUTES.HOST_LOBBY : ROUTES.PLAYER_LOBBY, { code }))}
          onHome={() => navigate(isHost ? pathWith(ROUTES.HOST_LOBBY, { code }) : ROUTES.LANDING)}
        />,
      );
    }
    return withHostControls(
      <RevealScreen
        theCase={revealed}
        yourSuspectId={isSpectator ? view.solutionSuspectId : view.yourAccusation}
        pointsEarned={view.yourScore}
        onContinue={() => undefined}
        readOnly
      />,
    );
  }

  // INVESTIGATE → workspace, or the accuse step (client-local). Spectator: read-only workspace only.
  if (accusing && !isSpectator) {
    return withHostControls(
      <AccuseScreen
        theCase={liveCase}
        onBack={() => setAccusing(false)}
        onSubmit={(a) => {
          game.accuse(a);
          setAccusing(false);
        }}
      />,
    );
  }

  // If the player has already locked in, show a waiting beat instead of the accuse button.
  if (view.locked && !isSpectator) {
    return withHostControls(
      <SlideFrame tone={SlideTone.ACTION}>
        <div className="flex flex-col items-center gap-3">
          <span className="font-serif text-[28px] font-semibold text-surface">Accusation locked in</span>
          <p className="max-w-sm font-sans text-[15px] text-surface/90">Sit tight — the room is still working the case. The truth drops when the clock runs out or everyone’s in.</p>
        </div>
      </SlideFrame>,
    );
  }

  return withHostControls(
    <InvestigateScreen
      theCase={liveCase}
      secondsLeft={secondsLeft}
      investigateSeconds={view.investigateSeconds}
      onAccuse={() => {
        shownAtRef.current = Date.now();
        setAccusing(true);
      }}
      readOnly={isSpectator}
    />,
  );
}
