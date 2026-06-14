import { useState } from 'react';

import { Segmented } from '@gbedity/ui';

import { IntroScreen } from '../screens/intro-screen.tsx';
import { QuestionScreen } from '../screens/question-screen.tsx';
import { AnswerScreen } from '../screens/answer-screen.tsx';
import { FinalScoreScreen } from '../screens/final-score-screen.tsx';

// /wwtbam-preview — the kinetic design surface for the WWTBAM solo slice. Renders every screen as
// BARE UI with mock props and no logic, so we can review them before wiring any game logic.
// A floating switcher hops between screens; per-screen toggles let you review variants.

const LADDER = [100, 200, 500, 1_000, 2_000, 5_000, 10_000, 25_000, 50_000, 100_000] as const;

const MOCK_OPTIONS = [
  'Lagos',
  'Abuja',
  'Port Harcourt',
  'Ibadan',
] as const;

const Screen = {
  INTRO: 'Intro',
  QUESTION: 'Question',
  ANSWER: 'Answer',
  FINAL: 'Final',
} as const;
type Screen = (typeof Screen)[keyof typeof Screen];

export function PreviewUiScreen() {
  const [screen, setScreen] = useState<Screen>(Screen.INTRO);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [correct, setCorrect] = useState(true);
  const [fiftyUsed, setFiftyUsed] = useState(false);

  const MOCK_QUESTION_IDX = 3; // show rung 4 (₦1,000) as the current one

  return (
    <div className="relative min-h-screen bg-canvas">
      {/* Floating switcher */}
      <div className="fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface px-2 py-2 shadow-[0_8px_24px_rgba(31,107,74,0.18)]">
        <Segmented
          value={screen}
          onChange={setScreen}
          ariaLabel="Preview screen"
          options={[Screen.INTRO, Screen.QUESTION, Screen.ANSWER, Screen.FINAL].map((s) => ({
            value: s,
            label: s,
          }))}
        />
        {(screen === Screen.ANSWER || screen === Screen.FINAL) ? (
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
        <IntroScreen
          questionCount={10}
          onStart={() => setScreen(Screen.QUESTION)}
        />
      ) : screen === Screen.QUESTION ? (
        <QuestionScreen
          prompt="What is the capital city of Nigeria?"
          options={MOCK_OPTIONS}
          hiddenOptions={fiftyUsed ? [0, 3] : []}
          selectedIdx={selectedIdx}
          questionIdx={MOCK_QUESTION_IDX}
          questionCount={10}
          secondsLeft={18}
          secondsPerQuestion={30}
          rung={LADDER[MOCK_QUESTION_IDX]!}
          fiftyFiftyAvailable={!fiftyUsed}
          onSelect={(idx) => {
            setSelectedIdx(idx);
            setScreen(Screen.ANSWER);
          }}
          onFiftyFifty={() => setFiftyUsed(true)}
          locked={false}
        />
      ) : screen === Screen.ANSWER ? (
        <AnswerScreen
          correct={correct}
          selectedIdx={correct ? 1 : 0}
          answerIdx={1}
          options={MOCK_OPTIONS}
          rung={LADDER[MOCK_QUESTION_IDX]!}
          bankedThisQuestion={correct ? LADDER[MOCK_QUESTION_IDX]! : 0}
          questionIdx={MOCK_QUESTION_IDX}
          questionCount={10}
          eliminated={!correct}
          onContinue={() => setScreen(Screen.QUESTION)}
          onExit={() => setScreen(Screen.FINAL)}
        />
      ) : (
        <FinalScoreScreen
          totalBanked={correct ? 3_800 : 700}
          correctCount={correct ? 7 : 3}
          questionCount={10}
          eliminated={!correct}
          onReplay={() => setScreen(Screen.INTRO)}
          onHome={() => setScreen(Screen.INTRO)}
        />
      )}
    </div>
  );
}
