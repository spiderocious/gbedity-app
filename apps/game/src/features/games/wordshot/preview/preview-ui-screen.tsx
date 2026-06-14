import { useState } from 'react';

import { Segmented } from '@gbedity/ui';

import { IntroScreen } from '../screens/intro-screen.tsx';
import { QuestionScreen } from '../screens/question-screen.tsx';
import { ScoresScreen } from '../screens/scores-screen.tsx';
import { FinalScoreScreen } from '../screens/final-score-screen.tsx';

// /wordshot-preview — bare-UI design surface for the Wordshot slice. Every screen with mock props,
// no logic. A floating switcher hops between screens; a toggle cycles the Scores screen
// between correct and wrong states so both paths can be reviewed.

const Screen = { INTRO: 'Intro', QUESTION: 'Question', SCORES: 'Scores', FINAL: 'Final' } as const;
type Screen = (typeof Screen)[keyof typeof Screen];

export function WordshotPreviewUiScreen() {
  const [screen, setScreen] = useState<Screen>(Screen.INTRO);
  const [guess, setGuess] = useState('');
  const [correct, setCorrect] = useState(true);

  return (
    <div className="relative min-h-screen bg-canvas">
      {/* Floating switcher */}
      <div className="fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface px-2 py-2 shadow-[0_8px_24px_rgba(31,107,74,0.18)]">
        <Segmented
          value={screen}
          onChange={setScreen}
          ariaLabel="Preview screen"
          options={[Screen.INTRO, Screen.QUESTION, Screen.SCORES, Screen.FINAL].map((s) => ({ value: s, label: s }))}
        />
        {screen === Screen.SCORES ? (
          <button
            type="button"
            onClick={() => setCorrect((c) => !c)}
            className="rounded-full bg-canvas px-3 py-1.5 font-sans text-[12px] font-bold text-ink hover:bg-canvas-deep"
          >
            {correct ? 'Show: correct' : 'Show: wrong'}
          </button>
        ) : null}
      </div>

      {screen === Screen.INTRO ? (
        <IntroScreen rounds={10} onStart={() => setScreen(Screen.QUESTION)} />
      ) : screen === Screen.QUESTION ? (
        <QuestionScreen
          letter="a"
          category="animal"
          roundIndex={2}
          rounds={10}
          secondsLeft={14}
          secondsPerRound={20}
          pointsOnOffer={1000}
          guess={guess}
          onGuessChange={setGuess}
          onSubmit={() => setScreen(Screen.SCORES)}
          locked={false}
        />
      ) : screen === Screen.SCORES ? (
        <ScoresScreen
          correct={correct}
          submittedWord={correct ? 'antelope' : 'apple'}
          letter="a"
          category="animal"
          pointsEarned={correct ? 850 : 0}
          roundIndex={2}
          rounds={10}
          suggestion={correct ? undefined : 'antelope'}
          onContinue={() => setScreen(Screen.QUESTION)}
          onExit={() => setScreen(Screen.INTRO)}
        />
      ) : (
        <FinalScoreScreen
          totalScore={6750}
          correctCount={7}
          rounds={10}
          onReplay={() => setScreen(Screen.INTRO)}
          onHome={() => setScreen(Screen.INTRO)}
        />
      )}
    </div>
  );
}
