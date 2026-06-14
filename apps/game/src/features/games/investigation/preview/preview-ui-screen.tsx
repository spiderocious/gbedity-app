import { useEffect, useState } from 'react';

import { Segmented } from '@gbedity/ui';

import { BriefingScreen } from '../screens/briefing-screen.tsx';
import { InvestigateScreen } from '../screens/investigate-screen.tsx';
import { AccuseScreen } from '../screens/accuse-screen.tsx';
import { RevealScreen } from '../screens/reveal-screen.tsx';
import { FinalBoardScreen } from '../screens/final-board-screen.tsx';
import { MOCK_CASE } from './mock-case.ts';

// /investigation-preview — the kinetic design surface for the Investigation slice. Every screen as
// BARE UI with the rich mock case, no logic. A floating switcher hops between screens; the investigate
// screen runs a live ticking clock so the workspace feels real. Preview-first: we iterate here before
// wiring backend/solo/multiplayer.

const Screen = {
  BRIEFING: 'Briefing',
  INVESTIGATE: 'Investigate',
  ACCUSE: 'Accuse',
  REVEAL: 'Reveal',
  FINAL: 'Final',
} as const;
type Screen = (typeof Screen)[keyof typeof Screen];

const INVESTIGATE_SECONDS = 300;

const MOCK_ROWS = [
  { name: 'Ada', score: 1000, detail: 'correct · fastest', seat: 1 as const },
  { name: 'Bisi', score: 720, detail: 'correct · 2nd', seat: 2 as const },
  { name: 'Chidi', score: 720, detail: 'correct · 3rd', seat: 3 as const },
  { name: 'Dare', score: 0, detail: 'wrong call', seat: 4 as const },
];

export function InvestigationPreviewScreen() {
  const [screen, setScreen] = useState<Screen>(Screen.BRIEFING);
  // A live clock so the Investigate workspace feels real in the preview.
  const [secondsLeft, setSecondsLeft] = useState(INVESTIGATE_SECONDS - 47);
  // Toggle the player's accusation right/wrong on the reveal screen.
  const [yourPick, setYourPick] = useState<string>(MOCK_CASE.solutionSuspectId);

  useEffect(() => {
    if (screen !== Screen.INVESTIGATE) return undefined;
    const id = window.setInterval(() => setSecondsLeft((s) => (s <= 0 ? INVESTIGATE_SECONDS : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [screen]);

  return (
    <div className="relative min-h-screen bg-canvas">
      <div className="fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface px-2 py-2 shadow-[0_8px_24px_rgba(31,107,74,0.18)]">
        <Segmented
          value={screen}
          onChange={setScreen}
          ariaLabel="Preview screen"
          options={[Screen.BRIEFING, Screen.INVESTIGATE, Screen.ACCUSE, Screen.REVEAL, Screen.FINAL].map((s) => ({ value: s, label: s }))}
        />
        {screen === Screen.REVEAL ? (
          <button
            type="button"
            onClick={() => setYourPick((p) => (p === MOCK_CASE.solutionSuspectId ? 's1' : MOCK_CASE.solutionSuspectId))}
            className="rounded-full bg-canvas px-3 py-1.5 font-sans text-[12px] font-bold text-ink hover:bg-canvas-deep"
          >
            {yourPick === MOCK_CASE.solutionSuspectId ? 'Show: correct' : 'Show: wrong'}
          </button>
        ) : null}
      </div>

      {screen === Screen.BRIEFING ? (
        <BriefingScreen theCase={MOCK_CASE} onOpen={() => setScreen(Screen.INVESTIGATE)} />
      ) : screen === Screen.INVESTIGATE ? (
        <InvestigateScreen
          theCase={MOCK_CASE}
          secondsLeft={secondsLeft}
          investigateSeconds={INVESTIGATE_SECONDS}
          onAccuse={() => setScreen(Screen.ACCUSE)}
        />
      ) : screen === Screen.ACCUSE ? (
        <AccuseScreen theCase={MOCK_CASE} onBack={() => setScreen(Screen.INVESTIGATE)} onSubmit={() => setScreen(Screen.REVEAL)} />
      ) : screen === Screen.REVEAL ? (
        <RevealScreen theCase={MOCK_CASE} yourSuspectId={yourPick} pointsEarned={1000} onContinue={() => setScreen(Screen.FINAL)} />
      ) : (
        <FinalBoardScreen rows={MOCK_ROWS} onReplay={() => setScreen(Screen.BRIEFING)} onHome={() => setScreen(Screen.BRIEFING)} />
      )}
    </div>
  );
}
