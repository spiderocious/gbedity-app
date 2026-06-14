import { useMemo } from 'react';

import { Button } from '@gbedity/ui';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../../../../shared/constants/routes.ts';
import { BriefingScreen } from '../../screens/briefing-screen.tsx';
import { InvestigateScreen } from '../../screens/investigate-screen.tsx';
import { AccuseScreen } from '../../screens/accuse-screen.tsx';
import { RevealScreen } from '../../screens/reveal-screen.tsx';
import { FinalBoardScreen } from '../../screens/final-board-screen.tsx';
import { SlideFrame, SlideTone } from '../../ui/slide-frame.tsx';
import { toMockCase } from '../../to-mock-case.ts';
import { InvPhase } from '../logic/machine.ts';
import { useInvestigationSolo } from '../logic/use-investigation-solo.ts';

// Composition root for client-driven solo Investigation: owns the brain hook and routes the phase to
// the matching (pure) preview screens. No socket — the hook drives everything via REST. The case from
// the API carries no answer; the reveal answer comes from the accuse result, merged in via toMockCase
// for the reveal + final screens.

export function SoloInvestigationScreen({ config }: { readonly config?: Record<string, unknown> }) {
  const navigate = useNavigate();
  const game = useInvestigationSolo(config);
  const goHome = useMemo(() => () => navigate(ROUTES.LANDING), [navigate]);

  if (game.phase === InvPhase.STARTING || game.theCase === null) {
    return (
      <SlideFrame tone={SlideTone.STAGE}>
        <p className="font-sans text-[16px] font-bold text-surface">{game.phase === InvPhase.ERROR ? 'Could not open a case.' : 'Opening the case file…'}</p>
      </SlideFrame>
    );
  }

  if (game.phase === InvPhase.ERROR) {
    return (
      <SlideFrame tone={SlideTone.CANVAS}>
        <div className="flex flex-col items-center gap-5">
          <h1 className="font-serif text-[28px] font-semibold text-ink">Something went wrong</h1>
          <p className="max-w-sm font-sans text-[15px] text-ink-3">{game.errorMessage ?? 'Please try again.'}</p>
          <div className="flex gap-3">
            <Button variant="primary" size="lg" onClick={game.replay}>Try again</Button>
            <Button variant="ghost" size="lg" onClick={goHome}>Home</Button>
          </div>
        </div>
      </SlideFrame>
    );
  }

  const liveCase = toMockCase(game.theCase);

  switch (game.phase) {
    case InvPhase.BRIEFING:
      return <BriefingScreen theCase={liveCase} investigateMinutes={Math.round(game.investigateSeconds / 60)} onOpen={game.openFile} />;

    case InvPhase.INVESTIGATE:
      return <InvestigateScreen theCase={liveCase} secondsLeft={game.secondsLeft} investigateSeconds={game.investigateSeconds} onAccuse={game.toAccuse} />;

    case InvPhase.ACCUSE:
      return <AccuseScreen theCase={liveCase} onBack={game.backToInvestigate} onSubmit={(a) => game.submit(a)} />;

    case InvPhase.REVEAL: {
      const r = game.result;
      if (!r) return null;
      const revealed = toMockCase(game.theCase, r);
      return <RevealScreen theCase={revealed} yourSuspectId={r.correct ? r.solutionSuspectId : null} pointsEarned={r.points} onContinue={game.toFinal} />;
    }

    case InvPhase.FINAL:
    default: {
      const r = game.result;
      const correct = r?.correct ?? false;
      const points = r?.points ?? 0;
      return (
        <FinalBoardScreen
          rows={[{ name: 'You', score: points, detail: correct ? 'cracked the case' : 'wrong call', seat: 1 }]}
          onReplay={game.replay}
          onHome={goHome}
        />
      );
    }
  }
}
