import { useMemo } from 'react';

import { Button } from '@gbedity/ui';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../../../../shared/constants/routes.ts';
import { IntroScreen } from '../../screens/intro-screen.tsx';
import { QuestionScreen } from '../../screens/question-screen.tsx';
import { AnswerScreen } from '../../screens/answer-screen.tsx';
import { FinalScoreScreen } from '../../screens/final-score-screen.tsx';
import { CountdownScreen } from '../../ui/countdown-screen.tsx';
import { SlideFrame, SlideTone } from '../../ui/slide-frame.tsx';
import { WwtbamPhase } from '../logic/machine.ts';
import { useWwtbamSolo } from '../logic/use-wwtbam-solo.ts';

// Composition root for client-driven solo WWTBAM. Owns the brain hook and routes the current phase
// to the matching pure screen. No socket, no engine. Config can be threaded in from the launch later.

export function SoloWwtbamScreen({ config }: { readonly config?: Record<string, unknown> }) {
  const navigate = useNavigate();
  const game = useWwtbamSolo(config);

  const goHome = useMemo(() => () => navigate(ROUTES.LANDING), [navigate]);

  switch (game.phase) {
    case WwtbamPhase.INTRO:
      return (
        <IntroScreen
          questionCount={game.questionCount > 0 ? game.questionCount : 10}
          onStart={game.start}
        />
      );

    case WwtbamPhase.STARTING:
      return (
        <SlideFrame tone={SlideTone.ACTION}>
          <p className="font-sans text-[16px] font-bold text-surface">Setting up…</p>
        </SlideFrame>
      );

    case WwtbamPhase.COUNTDOWN:
      return <CountdownScreen count={game.countdown} />;

    case WwtbamPhase.PLAYING:
      if (!game.question) {
        return (
          <SlideFrame tone={SlideTone.ACTION}>
            <p className="font-sans text-[16px] font-bold text-surface">Loading the question…</p>
          </SlideFrame>
        );
      }
      return (
        <QuestionScreen
          prompt={game.question.prompt}
          options={game.question.options}
          hiddenOptions={game.hiddenOptions}
          selectedIdx={game.selectedIdx}
          questionIdx={game.question.idx}
          questionCount={game.question.questionCount}
          secondsLeft={Math.ceil(game.secondsLeft)}
          secondsPerQuestion={game.question.secondsPerQuestion}
          rung={game.question.rung}
          fiftyFiftyAvailable={game.question.fiftyFiftyAvailable && game.hiddenOptions.length === 0}
          onSelect={game.selectOption}
          onFiftyFifty={game.useFiftyFifty}
          locked={game.selectedIdx !== null}
        />
      );

    case WwtbamPhase.REVEAL: {
      if (!game.result || !game.question) return null;
      return (
        <AnswerScreen
          correct={game.result.correct}
          selectedIdx={game.selectedIdx ?? game.result.answerIdx}
          answerIdx={game.result.answerIdx}
          options={game.question.options}
          rung={game.result.rung}
          bankedThisQuestion={game.result.bankedThisQuestion}
          questionIdx={game.result.idx}
          questionCount={game.result.questionCount}
          eliminated={game.result.eliminated}
          onContinue={game.continueNext}
          onExit={game.result.eliminated ? game.goToFinal : goHome}
        />
      );
    }

    case WwtbamPhase.FINAL:
      return (
        <FinalScoreScreen
          totalBanked={game.totalBanked}
          correctCount={game.correctCount}
          questionCount={game.questionCount}
          eliminated={game.result?.eliminated ?? false}
          onReplay={game.replay}
          onHome={goHome}
        />
      );

    case WwtbamPhase.ERROR:
      return (
        <SlideFrame tone={SlideTone.CANVAS}>
          <div className="flex flex-col items-center gap-5">
            <h1 className="font-serif text-[28px] font-semibold text-ink">Something went wrong</h1>
            <p className="max-w-sm font-sans text-[15px] text-ink-3">
              {game.errorMessage ?? 'Please try again.'}
            </p>
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
