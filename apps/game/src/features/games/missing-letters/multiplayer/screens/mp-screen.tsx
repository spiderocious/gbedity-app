import { useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import { ROUTES, pathWith } from '../../../../../shared/constants/routes.ts';
import { sessionStore } from '../../../../../shared/services/session-store.ts';
import { CountdownScreen } from '../../screens/countdown-screen.tsx';
import { QuestionScreen } from '../../screens/question-screen.tsx';
import { ScoresScreen } from '../../screens/scores-screen.tsx';
import { FinalScoreScreen } from '../../screens/final-score-screen.tsx';
import { SlideFrame, SlideTone } from '../../ui/slide-frame.tsx';
import { HostControlStrip } from '../../../../in-game/widgets/host-control-strip.tsx';
import { MlBackendPhase } from '../logic/patch.ts';
import { useDeadline } from '../logic/use-deadline.ts';
import { MpAudience, useMpMissingLetters } from '../logic/use-mp-missing-letters.ts';

// The multiplayer container for Missing Letters: engine-driven, audience-aware. It reads the live
// patch (via the driver), maps the backend phase to the SHARED new-design screens, and wires submit
// + (host) the control strip. Timing comes from the patch deadline — never a client clock. The three
// generic in-game screens branch to this when backendId === 'missing_letters'.

const POINTS_MAX = 1000; // matches the plugin's POINTS — "up for grabs"

interface MpMissingLettersScreenProps {
  readonly audience: MpAudience;
  readonly code: string;
}

export function MpMissingLettersScreen({ audience, code }: MpMissingLettersScreenProps) {
  const navigate = useNavigate();
  const game = useMpMissingLetters(audience);
  const { view, gameOver } = game;

  // Round/countdown clock — derived from the backend's absolute deadline so all devices match.
  const secondsLeft = useDeadline(view?.deadline ?? null);

  const isHost = audience === MpAudience.HOST;
  const isSpectator = audience === MpAudience.SPECTATOR;
  const myId = sessionStore.getPlayer()?.playerId;

  // Player / host leave the play surface for the result screen on game-over. The spectator (display)
  // holds the board — its own screen owns the hands-free loop and never navigates here.
  useEffect(() => {
    if (!gameOver || isSpectator) return;
    navigate(pathWith(isHost ? ROUTES.HOST_RESULT : ROUTES.PLAYER_RESULT, { code }));
  }, [gameOver, isSpectator, isHost, code, navigate]);

  // Pre-first-patch beat.
  if (view === null) {
    return (
      <SlideFrame tone={SlideTone.ACTION}>
        <p className="font-sans text-[16px] font-bold text-surface">{gameOver ? 'Wrapping up…' : 'Starting the round…'}</p>
      </SlideFrame>
    );
  }

  // The host's control strip sits over whatever screen is showing.
  const withHostControls = (node: React.ReactNode): React.ReactNode =>
    isHost ? (
      <div className="pb-20">
        {node}
        <HostControlStrip controls={{ skip: true }} onSkip={game.skip} onEndGame={game.endGame} />
      </div>
    ) : (
      node
    );

  switch (view.phase) {
    case MlBackendPhase.COUNTDOWN: {
      // Map the shared deadline to a 3·2·1 numeral (ceil of seconds left; 0 → "Go").
      const count = Math.max(0, Math.ceil(secondsLeft));
      return withHostControls(<CountdownScreen count={count} />);
    }

    case MlBackendPhase.ROUND:
      return withHostControls(
        <QuestionScreen
          masked={view.masked}
          length={view.length}
          roundIndex={view.idx}
          rounds={view.rounds}
          secondsLeft={secondsLeft}
          secondsPerRound={view.secondsPerRound}
          pointsOnOffer={POINTS_MAX}
          guess={game.guess}
          onGuessChange={game.setGuess}
          onSubmit={game.submit}
          locked={view.locked}
          readOnly={isSpectator}
        />,
      );

    case MlBackendPhase.REVEAL:
      return withHostControls(
        <ScoresScreen
          correct={isSpectator ? true : view.solved}
          answer={view.answer ?? ''}
          pointsEarned={isSpectator ? 0 : view.board.find((r) => r.playerId === myId)?.roundDelta ?? 0}
          roundIndex={view.idx}
          rounds={view.rounds}
          onContinue={() => undefined}
          onExit={() => undefined}
          actions={false}
          caption={view.idx + 1 >= view.rounds ? 'Final scores coming up…' : 'Next round coming up…'}
        />,
      );

    case MlBackendPhase.DONE:
    default: {
      // Final board → the celebration screen. correctCount approximated from the board isn't available
      // per-player here for spectator; use the player's own when known, else the field count.
      const myRow = myId ? view.board.find((r) => r.playerId === myId) : undefined;
      const total = isSpectator ? (view.board[0]?.points ?? 0) : (myRow?.points ?? view.yourScore);
      return withHostControls(
        <FinalScoreScreen
          totalScore={total}
          correctCount={0}
          rounds={view.rounds}
          onReplay={() => navigate(pathWith(isHost ? ROUTES.HOST_LOBBY : ROUTES.PLAYER_LOBBY, { code }))}
          onHome={() => navigate(isHost ? pathWith(ROUTES.HOST_LOBBY, { code }) : ROUTES.LANDING)}
        />,
      );
    }
  }
}
