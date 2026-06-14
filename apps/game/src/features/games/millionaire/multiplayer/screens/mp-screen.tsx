import { useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import { ROUTES, pathWith } from '../../../../../shared/constants/routes.ts';
import { useLobby } from '../../../../../shared/api/use-lobby.ts';
import { sessionStore } from '../../../../../shared/services/session-store.ts';
import { QuestionScreen } from '../../screens/question-screen.tsx';
import { AnswerScreen } from '../../screens/answer-screen.tsx';
import { FinalScoreScreen } from '../../screens/final-score-screen.tsx';
import { SlideFrame, SlideTone } from '../../ui/slide-frame.tsx';
import { HostControlStrip } from '../../../../in-game/widgets/host-control-strip.tsx';
import { MmPhase } from '../logic/patch.ts';
import { useDeadline } from '../logic/use-deadline.ts';
import { MpAudience, useMpMillionaire } from '../logic/use-mp-millionaire.ts';

// The multiplayer container for Who Wants to Be a Millionaire: engine-driven, audience-aware.
// Maps the live backend patch → the SHARED screens. Timing from patch.deadline (never a client clock).
// Lifelines supported: 50/50 only. AUDIENCE_POLL + PHONE_WAIT render a waiting fallback panel.
// The three generic in-game screens branch to this when backendId === 'millionaire'.

interface MpMillionaireScreenProps {
  readonly audience: MpAudience;
  readonly code: string;
}

export function MpMillionaireScreen({ audience, code }: MpMillionaireScreenProps) {
  const navigate = useNavigate();
  const game = useMpMillionaire(audience);
  const { view, gameOver } = game;

  // Round clock — derived from the backend absolute deadline so all devices stay in lockstep.
  const secondsLeft = useDeadline(view?.deadline ?? null);

  const isHost = audience === MpAudience.HOST;
  const isSpectator = audience === MpAudience.SPECTATOR;
  const myId = sessionStore.getPlayer()?.playerId;

  // Nickname resolver — lobby snapshot is stable during a game session (no polling needed).
  const lobby = useLobby(code, code !== '', false);
  const nameOf = (id: string): string =>
    lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;

  // Player / host leave on game-over; spectator (display) holds the board for the hands-free loop.
  useEffect(() => {
    if (!gameOver || isSpectator) return;
    navigate(pathWith(isHost ? ROUTES.HOST_RESULT : ROUTES.PLAYER_RESULT, { code }));
  }, [gameOver, isSpectator, isHost, code, navigate]);

  if (view === null) {
    return (
      <SlideFrame tone={SlideTone.ACTION}>
        <p className="font-sans text-[16px] font-bold text-surface">
          {gameOver ? 'Wrapping up…' : 'Starting the game…'}
        </p>
      </SlideFrame>
    );
  }

  const amEliminated = myId !== undefined && view.eliminated.includes(myId);

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
    case MmPhase.TURN_INTRO: {
      // "Question X — [HolderName] is playing" interstitial before each question.
      const holderName = view.holderId !== null ? nameOf(view.holderId) : 'Someone';
      const isMyTurn = view.holderId === myId;
      // Upcoming rotation: everyone after the holder in order, wrapping around (exclude holder).
      const holderPos = view.order.indexOf(view.holderId ?? '');
      const upNext = [
        ...view.order.slice(holderPos + 1),
        ...view.order.slice(0, holderPos),
      ].slice(0, 3);
      return withHostControls(
        <SlideFrame tone={SlideTone.ACTION} compact animateKey={`turn-intro-${view.qIndex}`}>
          <div className="flex flex-col items-center gap-5 text-center">
            <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.18em] text-surface/70">
              Question {view.qIndex + 1} of {view.questionCount}
            </span>
            <div className="flex flex-col items-center gap-1">
              <span className="font-sans text-[13px] font-bold text-surface/80">Up now</span>
              <p className="font-serif text-[42px] font-semibold leading-none text-surface sm:text-[56px]">
                {isMyTurn ? 'You' : holderName}
              </p>
            </div>
            {upNext.length > 0 ? (
              <div className="flex flex-col items-center gap-2">
                <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-surface/60">
                  Up next
                </span>
                <div className="flex flex-col gap-1">
                  {upNext.map((id, i) => (
                    <span key={id} className="font-sans text-[14px] text-surface/80">
                      {i + 2}.&nbsp;{id === myId ? 'You' : nameOf(id)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </SlideFrame>,
      );
    }

    case MmPhase.QUESTION: {
      // Non-holder, non-spectator: waiting panel showing who's on the hot seat.
      if (!view.yourTurn && !isSpectator && !amEliminated) {
        const currentName = view.holderId !== null ? nameOf(view.holderId) : 'Someone';
        return withHostControls(
          <SlideFrame tone={SlideTone.ACTION} compact animateKey={view.qIndex}>
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.18em] text-surface/70">
                Question {view.qIndex + 1} of {view.questionCount}
              </span>
              <p className="font-serif text-[32px] font-semibold text-surface">
                {currentName} is answering
              </p>
              <p className="font-sans text-[14px] text-surface/75">Your turn is coming up.</p>
            </div>
          </SlideFrame>,
        );
      }
      if (amEliminated) {
        return withHostControls(
          <SlideFrame tone={SlideTone.CANVAS} compact animateKey={`elim-${view.qIndex}`}>
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="font-serif text-[28px] font-semibold text-ink">You're eliminated</span>
              <p className="font-sans text-[15px] text-ink-3">Watch along while the others play.</p>
            </div>
          </SlideFrame>,
        );
      }
      const fiftyFiftyAvailable =
        !view.lifelinesUsed.includes('fifty_fifty') && view.hiddenOptions.length === 0;
      return withHostControls(
        <QuestionScreen
          prompt={view.prompt}
          options={view.options}
          hiddenOptions={view.hiddenOptions}
          selectedIdx={null}
          questionIdx={view.qIndex}
          questionCount={view.questionCount}
          secondsLeft={secondsLeft}
          secondsPerQuestion={view.secondsPerRound}
          rung={view.rung}
          fiftyFiftyAvailable={fiftyFiftyAvailable}
          onSelect={game.answer}
          onFiftyFifty={game.useFiftyFifty}
          locked={false}
          readOnly={isSpectator}
        />,
      );
    }

    // AUDIENCE_POLL + PHONE_WAIT: not implemented in the UI yet — show a neutral waiting beat.
    case MmPhase.AUDIENCE_POLL:
    case MmPhase.PHONE_WAIT:
      return withHostControls(
        <SlideFrame tone={SlideTone.ACTION} compact animateKey={view.phase}>
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="font-serif text-[28px] font-semibold text-surface">
              {view.phase === MmPhase.AUDIENCE_POLL ? 'Audience voting…' : 'Phone a friend…'}
            </span>
            <p className="font-sans text-[15px] text-surface/80">Stand by.</p>
          </div>
        </SlideFrame>,
      );

    case MmPhase.REVEAL: {
      const myRow = myId !== undefined ? view.board.find((r) => r.playerId === myId) : undefined;
      const earnedThisQ = myRow?.roundDelta ?? 0;
      const wasCorrect = isSpectator ? (view.answerIdx !== null) : earnedThisQ > 0;
      const selectedGuess = view.answerIdx ?? 0;
      const isLastQ = view.qIndex + 1 >= view.ladder.length;
      return withHostControls(
        <AnswerScreen
          correct={wasCorrect}
          selectedIdx={selectedGuess}
          answerIdx={view.answerIdx ?? 0}
          options={view.options}
          rung={view.rung}
          bankedThisQuestion={earnedThisQ}
          questionIdx={view.qIndex}
          questionCount={view.ladder.length}
          eliminated={amEliminated}
          onContinue={() => undefined}
          onExit={() => undefined}
          autoAdvance
          caption={isLastQ ? 'Final scores coming up…' : 'Next question coming up…'}
        />,
      );
    }

    case MmPhase.DONE:
    default: {
      const myRow = myId !== undefined ? view.board.find((r) => r.playerId === myId) : undefined;
      const totalBanked = isSpectator
        ? (view.board[0]?.points ?? 0)
        : (myRow?.points ?? view.yourScore);
      const correctCount = Object.entries(view.banked).filter(([id, v]) => id === myId && v > 0).length;
      return withHostControls(
        <FinalScoreScreen
          totalBanked={totalBanked}
          correctCount={correctCount}
          questionCount={view.ladder.length}
          eliminated={amEliminated}
          onReplay={() => navigate(pathWith(isHost ? ROUTES.HOST_LOBBY : ROUTES.PLAYER_LOBBY, { code }))}
          onHome={() => navigate(isHost ? pathWith(ROUTES.HOST_LOBBY, { code }) : ROUTES.LANDING)}
        />,
      );
    }
  }
}
