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
import { MlPhase } from '../logic/machine.ts';
import { useMissingLettersSolo } from '../logic/use-missing-letters-solo.ts';

// The composition root for client-driven solo Missing Letters: it owns the brain hook and routes the
// current phase to the matching (pure) screen. No socket, no engine — the hook drives everything via
// REST. This is what the solo route renders. Config can be threaded in later (defaults for now).

const POINTS_MAX = 1000; // matches the backend SCORE_MAX — "up for grabs" label

export function SoloMissingLettersScreen({ config }: { readonly config?: Record<string, unknown> }) {
  const navigate = useNavigate();
  const game = useMissingLettersSolo(config);

  const goHome = useMemo(() => () => navigate(ROUTES.LANDING), [navigate]);

  switch (game.phase) {
    case MlPhase.INTRO:
      return <IntroScreen onStart={game.start} />;

    case MlPhase.STARTING:
      return (
        <SlideFrame tone={SlideTone.ACTION}>
          <p className="font-sans text-[16px] font-bold text-surface">Setting up…</p>
        </SlideFrame>
      );

    case MlPhase.COUNTDOWN:
      return <CountdownScreen count={game.countdown} />;

    case MlPhase.PLAYING:
      if (!game.round) {
        return (
          <SlideFrame tone={SlideTone.ACTION}>
            <p className="font-sans text-[16px] font-bold text-surface">Loading the word…</p>
          </SlideFrame>
        );
      }
      return (
        <QuestionScreen
          masked={game.round.masked}
          length={game.round.length}
          roundIndex={game.round.idx}
          rounds={game.round.rounds}
          secondsLeft={game.secondsLeft}
          secondsPerRound={game.round.secondsPerRound}
          pointsOnOffer={POINTS_MAX}
          guess={game.guess}
          onGuessChange={game.setGuess}
          onSubmit={game.submit}
          locked={false}
        />
      );

    case MlPhase.REVEAL:
      if (!game.result) return null;
      return (
        <ScoresScreen
          correct={game.result.correct}
          answer={game.result.answer}
          pointsEarned={game.result.points}
          roundIndex={game.result.idx}
          rounds={game.result.rounds}
          onContinue={game.continueNext}
          onExit={goHome}
        />
      );

    case MlPhase.FINAL:
      return (
        <FinalScoreScreen
          totalScore={game.totalScore}
          correctCount={game.correctCount}
          rounds={game.rounds}
          onReplay={game.replay}
          onHome={goHome}
        />
      );

    case MlPhase.ERROR:
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
