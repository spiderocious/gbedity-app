import { useMemo } from 'react';

import { Button } from '@gbedity/ui';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../../../../shared/constants/routes.ts';
import { IntroScreen } from '../../screens/intro-screen.tsx';
import { CountdownScreen } from '../../screens/countdown-screen.tsx';
import { QuestionScreen } from '../../screens/question-screen.tsx';
import { ScoresScreen } from '../../screens/scores-screen.tsx';
import { FinalScoreScreen } from '../../screens/final-score-screen.tsx';
import { SlideFrame, SlideTone } from '../../ui/slide-frame.tsx';
import { WsPhase } from '../logic/machine.ts';
import { useWordshot } from '../logic/use-wordshot.ts';

// Composition root for client-driven solo Wordshot: owns the brain hook and routes the current phase
// to the matching pure screen. No socket, no engine — the hook drives everything via REST.

const POINTS_MAX = 1000;

export function SoloWordshotScreen({ config }: { readonly config?: Record<string, unknown> }) {
  const navigate = useNavigate();
  const game = useWordshot(config);

  const goHome = useMemo(() => () => navigate(ROUTES.LANDING), [navigate]);

  switch (game.phase) {
    case WsPhase.INTRO:
      return <IntroScreen rounds={game.rounds || undefined} onStart={game.start} />;

    case WsPhase.STARTING:
      return (
        <SlideFrame tone={SlideTone.ACTION}>
          <p className="font-sans text-[16px] font-bold text-surface">Setting up…</p>
        </SlideFrame>
      );

    case WsPhase.COUNTDOWN:
      return <CountdownScreen count={game.countdown} />;

    case WsPhase.PLAYING: {
      if (!game.round) {
        return (
          <SlideFrame tone={SlideTone.ACTION}>
            <p className="font-sans text-[16px] font-bold text-surface">Loading the round…</p>
          </SlideFrame>
        );
      }
      return (
        <QuestionScreen
          letter={game.round.letter}
          category={game.round.category}
          roundIndex={game.round.idx}
          rounds={game.round.rounds}
          secondsLeft={game.secondsLeft}
          secondsPerRound={game.round.secondsPerRound}
          pointsOnOffer={POINTS_MAX}
          guess={game.word}
          onGuessChange={game.setWord}
          onSubmit={game.submit}
          locked={false}
        />
      );
    }

    case WsPhase.REVEAL:
      if (!game.result || !game.round) return null;
      return (
        <ScoresScreen
          correct={game.result.correct}
          submittedWord={game.submittedWord}
          letter={game.round.letter}
          category={game.round.category}
          pointsEarned={game.result.points}
          roundIndex={game.result.idx}
          rounds={game.result.rounds}
          suggestion={game.result.suggestion}
          onContinue={game.continueNext}
          onExit={goHome}
        />
      );

    case WsPhase.FINAL:
      return (
        <FinalScoreScreen
          totalScore={game.totalScore}
          correctCount={game.correctCount}
          rounds={game.rounds}
          onReplay={game.replay}
          onHome={goHome}
        />
      );

    case WsPhase.ERROR:
      return (
        <SlideFrame tone={SlideTone.CANVAS}>
          <div className="flex flex-col items-center gap-5">
            <h1 className="font-serif text-[28px] font-semibold text-ink">Something went wrong</h1>
            <p className="max-w-sm font-sans text-[15px] text-ink-3">{game.errorMessage ?? 'Please try again.'}</p>
            <div className="flex gap-3">
              <Button variant="primary" size="lg" onClick={game.replay}>
                Try again
              </Button>
              <Button variant="ghost" size="lg" onClick={goHome}>
                Home
              </Button>
            </div>
          </div>
        </SlideFrame>
      );

    default:
      return null;
  }
}
