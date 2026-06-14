import { useEffect } from 'react';

import { Card } from '@gbedity/ui';
import { useNavigate } from 'react-router-dom';

import { ROUTES, pathWith } from '../../../../../shared/constants/routes.ts';
import { sessionStore } from '../../../../../shared/services/session-store.ts';
import { useDeadline } from '../../../missing-letters/multiplayer/logic/use-deadline.ts';
import { HostControlStrip } from '../../../../in-game/widgets/host-control-strip.tsx';
import { QuestionScreen } from '../../screens/question-screen.tsx';
import { ScoresScreen } from '../../screens/scores-screen.tsx';
import { FinalScoreScreen } from '../../screens/final-score-screen.tsx';
import { SlideFrame, SlideTone } from '../../ui/slide-frame.tsx';
import { WsBackendPhase } from '../logic/patch.ts';
import { MpAudience, useMpWordshot } from '../logic/use-mp-wordshot.ts';

// The multiplayer container for Wordshot: engine-driven, audience-aware. Maps the backend phase
// to the SHARED new-design screens; derives the countdown from the patch deadline (never a client
// clock); layers the HostControlStrip for the host seat. The ranked live feed (option B) sits
// outside QuestionScreen as a separate element so the screen stays pure.

const POINTS_MAX = 1000; // matches the plugin's maxPoints

interface MpWordshotScreenProps {
  readonly audience: MpAudience;
  readonly code: string;
}

export function MpWordshotScreen({ audience, code }: MpWordshotScreenProps) {
  const navigate = useNavigate();
  const game = useMpWordshot(audience);
  const { view, gameOver } = game;

  // All countdowns derived from backend deadline — every device stays in lockstep.
  const secondsLeft = useDeadline(view?.deadline ?? null);

  const isHost = audience === MpAudience.HOST;
  const isSpectator = audience === MpAudience.SPECTATOR;
  const myId = sessionStore.getPlayer()?.playerId;

  // Player/host navigate to the result screen on game-over. Spectator holds the board — the
  // display-game-screen's hands-free loop owns that transition.
  useEffect(() => {
    if (!gameOver || isSpectator) return;
    navigate(pathWith(isHost ? ROUTES.HOST_RESULT : ROUTES.PLAYER_RESULT, { code }));
  }, [gameOver, isSpectator, isHost, code, navigate]);

  // Pre-first-patch beat.
  if (view === null) {
    return (
      <SlideFrame tone={SlideTone.ACTION}>
        <p className="font-sans text-[16px] font-bold text-surface">
          {gameOver ? 'Wrapping up…' : 'Starting the round…'}
        </p>
      </SlideFrame>
    );
  }

  // Host controls sit over whichever screen is active.
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
    case WsBackendPhase.ROUND: {
      // yourSubmission !== null means this seat has already submitted; lock the input.
      const locked = view.yourSubmission !== null;
      return withHostControls(
        <div className="flex flex-col gap-4">
          <QuestionScreen
            letter={view.letter}
            category={view.category}
            roundIndex={view.roundIndex}
            rounds={view.rounds}
            secondsLeft={secondsLeft}
            secondsPerRound={view.secondsPerRound}
            pointsOnOffer={POINTS_MAX}
            guess={game.word}
            onGuessChange={game.setWord}
            onSubmit={game.submit}
            locked={locked}
            readOnly={isSpectator}
          />
          {/* Live ranked feed (option B): separate from the question slide */}
          {view.ranked.length > 0 ? (
            <Card size="lg" className="py-5">
              <span className="mb-3 block text-center font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-ink-4">
                Live leaders
              </span>
              <div className="flex flex-col gap-2">
                {view.ranked.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-1">
                    <span className="font-sans text-[14px] text-ink">{entry.text}</span>
                    <span className="font-sans text-[13px] font-bold text-ink-3">{entry.score} pts</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>,
      );
    }

    case WsBackendPhase.REVEAL: {
      const myRow = myId ? view.board.find((r) => r.playerId === myId) : undefined;
      const pointsEarned = isSpectator ? 0 : (myRow?.roundDelta ?? 0);
      const correct = isSpectator ? true : (view.yourSubmission?.valid ?? false);
      const submittedWord = isSpectator ? '' : (view.yourSubmission?.text ?? '');
      const caption = view.roundIndex + 1 >= view.rounds ? 'Final scores coming up…' : 'Next round coming up…';
      return withHostControls(
        <ScoresScreen
          correct={correct}
          submittedWord={submittedWord}
          letter={view.letter}
          category={view.category}
          pointsEarned={pointsEarned}
          roundIndex={view.roundIndex}
          rounds={view.rounds}
          onContinue={() => undefined}
          onExit={() => undefined}
          actions={false}
          caption={caption}
        />,
      );
    }

    case WsBackendPhase.DONE:
    default: {
      const myRow = myId ? view.board.find((r) => r.playerId === myId) : undefined;
      const totalScore = isSpectator ? (view.board[0]?.points ?? 0) : (myRow?.points ?? view.yourScore);
      return withHostControls(
        <FinalScoreScreen
          totalScore={totalScore}
          correctCount={0}
          rounds={view.rounds}
          onReplay={() => navigate(pathWith(isHost ? ROUTES.HOST_LOBBY : ROUTES.PLAYER_LOBBY, { code }))}
          onHome={() => navigate(isHost ? pathWith(ROUTES.HOST_LOBBY, { code }) : ROUTES.LANDING)}
        />,
      );
    }
  }
}
