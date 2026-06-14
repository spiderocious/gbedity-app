import { useState } from 'react';

import { Segmented } from '@gbedity/ui';

import { IntroScreen } from '../screens/intro-screen.tsx';
import { QuestionScreen } from '../screens/question-screen.tsx';
import { ScoresScreen } from '../screens/scores-screen.tsx';
import { FinalScoreScreen } from '../screens/final-score-screen.tsx';

// /preview-ui — the kinetic design surface for the Missing Letters slice. Renders every screen as
// BARE UI with mock props and no logic, so we can design + review them in isolation before wiring
// the client game. A floating switcher hops between screens; each is shown exactly as it renders in
// the app. (Going forward, every game slice gets one of these.)

const Screen = { INTRO: 'Intro', QUESTION: 'Question', SCORES: 'Scores', FINAL: 'Final' } as const;
type Screen = (typeof Screen)[keyof typeof Screen];

export function PreviewUiScreen() {
  const [screen, setScreen] = useState<Screen>(Screen.INTRO);
  // Local state so the bare Question screen feels alive (typing works) without any game logic.
  const [guess, setGuess] = useState('');
  // A toggle so the Scores screen can be reviewed in both correct + wrong states.
  const [correct, setCorrect] = useState(true);

  return (
    <div className="relative min-h-screen bg-canvas">
      {/* Floating switcher — fixed so it stays put across the full-screen slides. */}
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
        <IntroScreen rounds={8} onStart={() => setScreen(Screen.QUESTION)} />
      ) : screen === Screen.QUESTION ? (
        <QuestionScreen
          masked="b _ n _ n a"
          length={6}
          roundIndex={2}
          rounds={8}
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
          answer="banana"
          pointsEarned={correct ? 820 : 0}
          roundIndex={2}
          rounds={8}
          onContinue={() => setScreen(Screen.QUESTION)}
          onExit={() => setScreen(Screen.INTRO)}
        />
      ) : (
        <FinalScoreScreen
          totalScore={5240}
          correctCount={6}
          rounds={8}
          onReplay={() => setScreen(Screen.INTRO)}
          onHome={() => setScreen(Screen.INTRO)}
        />
      )}
    </div>
  );
}
