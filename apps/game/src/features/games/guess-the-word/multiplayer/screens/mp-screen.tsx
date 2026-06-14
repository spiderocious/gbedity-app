import { useEffect, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { ROUTES, pathWith } from '../../../../../shared/constants/routes.ts';
import { useLobby } from '../../../../../shared/api/use-lobby.ts';
import { sessionStore } from '../../../../../shared/services/session-store.ts';
import { SlideFrame, SlideTone } from '../../../millionaire/ui/slide-frame.tsx';
import { HostControlStrip } from '../../../../in-game/widgets/host-control-strip.tsx';
import { GtwPhase } from '../logic/patch.ts';
import { useDeadline } from '../logic/use-deadline.ts';
import { MpAudience, useMpGuessTheWord } from '../logic/use-mp-guess-the-word.ts';

// The multiplayer container for Guess The Word: engine-driven, audience-aware.
// Three audience surfaces:
//   Guesser (isGuesser)    — sees word length only; types their guess.
//   Audience (audience player, not guesser) — sees the full word + question count; Moderator gets +/- buttons.
//   Spectator/Display      — sees everything (word, guess, outcome).

interface MpGuessTheWordScreenProps {
  readonly audience: MpAudience;
  readonly code: string;
}

export function MpGuessTheWordScreen({ audience, code }: MpGuessTheWordScreenProps) {
  const navigate = useNavigate();
  const game = useMpGuessTheWord(audience);
  const { view, gameOver } = game;

  const secondsLeft = useDeadline(view?.deadline ?? null);

  const isHost = audience === MpAudience.HOST;
  const isSpectator = audience === MpAudience.SPECTATOR;
  const myId = sessionStore.getPlayer()?.playerId;

  const lobby = useLobby(code, code !== '', false);
  const nameOf = (id: string): string =>
    lobby.data?.players.find((p) => p.id === id)?.nickname ?? id;

  useEffect(() => {
    if (!gameOver || isSpectator) return;
    navigate(pathWith(isHost ? ROUTES.HOST_RESULT : ROUTES.PLAYER_RESULT, { code }));
  }, [gameOver, isSpectator, isHost, code, navigate]);

  if (view === null) {
    return (
      <SlideFrame tone={SlideTone.ACCENT}>
        <p className="font-sans text-[16px] font-bold text-surface">
          {gameOver ? 'Wrapping up…' : 'Starting the game…'}
        </p>
      </SlideFrame>
    );
  }

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
    case GtwPhase.TURN_INTRO: {
      const guesserName = view.guesserId !== null ? nameOf(view.guesserId) : 'Someone';
      const isMyTurn = view.guesserId === myId;
      const holderPos = view.order.indexOf(view.guesserId ?? '');
      const upNext = [
        ...view.order.slice(holderPos + 1),
        ...view.order.slice(0, holderPos),
      ].slice(0, 3);
      return withHostControls(
        <SlideFrame tone={SlideTone.ACCENT} compact animateKey={`intro-${view.turnIdx}`}>
          <div className="flex flex-col items-center gap-5 text-center">
            <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.18em] text-surface/70">
              Round {view.turnIdx + 1} of {view.order.length}
            </span>
            <div className="flex flex-col items-center gap-1">
              <span className="font-sans text-[13px] font-bold text-surface/80">Guessing now</span>
              <p className="font-serif text-[42px] font-semibold leading-none text-surface sm:text-[56px]">
                {isMyTurn ? 'You' : guesserName}
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

    case GtwPhase.GUESSING: {
      const amGuesser = view.isGuesser || (isSpectator && view.guesserId === null);

      if (amGuesser || isSpectator) {
        return withHostControls(
          <GuesserPanel
            view={{
              wordLength: view.wordLength,
              questionCount: view.questionCount,
              word: isSpectator ? view.word : null,
            }}
            secondsLeft={secondsLeft}
            guessSeconds={view.guessSeconds}
            onSubmit={isSpectator ? undefined : game.submitGuess}
            animateKey={view.turnIdx}
          />,
        );
      }

      // Audience / Moderator view
      const guesserName = view.guesserId !== null ? nameOf(view.guesserId) : 'Someone';
      return withHostControls(
        <AudiencePanel
          word={view.word ?? ''}
          guesserName={guesserName}
          questionCount={view.questionCount}
          secondsLeft={secondsLeft}
          isModerator={view.isModerator}
          onAdjust={game.adjustCount}
          animateKey={view.turnIdx}
        />,
      );
    }

    case GtwPhase.REVEAL: {
      const guesserName = view.guesserId !== null ? nameOf(view.guesserId) : 'Someone';
      const isMyReveal = view.guesserId === myId;
      const correct = view.correct;
      const tone = correct ? SlideTone.ACTION : SlideTone.CANVAS;

      return withHostControls(
        <SlideFrame tone={tone} compact animateKey={`reveal-${view.turnIdx}`}>
          <div className="flex flex-col items-center gap-5 text-center">
            <span className={`font-sans text-[12px] font-extrabold uppercase tracking-[0.18em] ${correct ? 'text-surface/70' : 'text-ink-3'}`}>
              Round {view.turnIdx + 1} · Reveal
            </span>
            <p className={`font-serif text-[36px] font-semibold leading-tight ${correct ? 'text-surface' : 'text-ink'}`}>
              {isMyReveal ? (correct ? 'You got it!' : 'Not this time') : (correct ? `${guesserName} got it!` : `${guesserName} missed it`)}
            </p>
            {view.word !== null ? (
              <div className={`flex flex-col items-center gap-1 ${correct ? 'text-surface/80' : 'text-ink-3'}`}>
                <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em]">The word</span>
                <span className="font-sans text-[22px] font-bold">{view.word}</span>
              </div>
            ) : null}
            {view.guessText !== null ? (
              <div className={`flex flex-col items-center gap-1 ${correct ? 'text-surface/70' : 'text-ink-3'}`}>
                <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em]">
                  {isMyReveal ? 'Your guess' : 'Their guess'}
                </span>
                <span className="font-sans text-[16px] font-semibold">{view.guessText}</span>
              </div>
            ) : (
              <p className={`font-sans text-[14px] ${correct ? 'text-surface/70' : 'text-ink-3'}`}>
                {isMyReveal ? 'Time ran out' : `${guesserName} didn't guess in time`}
              </p>
            )}
            <p className={`font-sans text-[13px] ${correct ? 'text-surface/60' : 'text-ink-4'}`}>
              Next round coming up…
            </p>
          </div>
        </SlideFrame>,
      );
    }

    case GtwPhase.DONE:
    default: {
      const myRow = myId !== undefined ? view.board.find((r) => r.playerId === myId) : undefined;
      const totalScore = isSpectator ? (view.board[0]?.points ?? 0) : (myRow?.points ?? view.yourScore);
      const topPlayer = view.board[0];
      const topName = topPlayer ? nameOf(topPlayer.playerId) : null;

      return withHostControls(
        <SlideFrame tone={SlideTone.ACTION} compact animateKey="done">
          <div className="flex flex-col items-center gap-6 text-center">
            <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.18em] text-surface/70">
              Game Over
            </span>
            {isSpectator && topName !== null ? (
              <p className="font-serif text-[40px] font-semibold text-surface">{topName} wins!</p>
            ) : (
              <>
                <p className="font-serif text-[40px] font-semibold text-surface">
                  {totalScore} pts
                </p>
                <p className="font-sans text-[15px] text-surface/80">Your final score</p>
              </>
            )}
            {view.board.length > 0 ? (
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {view.board.slice(0, 5).map((row, i) => (
                  <div key={row.playerId} className="flex items-center justify-between gap-2 rounded-xl bg-surface/10 px-4 py-2">
                    <span className="font-sans text-[14px] text-surface/80">
                      {i + 1}. {row.playerId === myId ? 'You' : nameOf(row.playerId)}
                    </span>
                    <span className="font-sans text-[14px] font-bold text-surface">{row.points} pts</span>
                  </div>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => navigate(pathWith(isHost ? ROUTES.HOST_LOBBY : ROUTES.PLAYER_LOBBY, { code }))}
              className="mt-2 rounded-xl bg-surface px-6 py-3 font-sans text-[15px] font-bold text-action"
            >
              Back to lobby
            </button>
          </div>
        </SlideFrame>,
      );
    }
  }
}

// ── Sub-screens ───────────────────────────────────────────────────────────────

interface GuesserPanelProps {
  readonly view: { wordLength: number | null; questionCount: number; word: string | null };
  readonly secondsLeft: number;
  readonly guessSeconds: number;
  readonly onSubmit?: (text: string) => void;
  readonly animateKey: string | number;
}

function GuesserPanel({ view, secondsLeft, guessSeconds, onSubmit, animateKey }: GuesserPanelProps) {
  const [guess, setGuess] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (): void => {
    if (!guess.trim() || submitted || onSubmit === undefined) return;
    setSubmitted(true);
    onSubmit(guess.trim());
  };

  const pct = guessSeconds > 0 ? Math.min(1, secondsLeft / guessSeconds) : 0;
  const timerColor = pct > 0.5 ? 'text-surface' : pct > 0.25 ? 'text-warn' : 'text-warn-deep';

  return (
    <SlideFrame tone={SlideTone.ACCENT} compact animateKey={animateKey}>
      <div className="flex flex-col items-center gap-6 text-center">
        <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.18em] text-surface/70">
          Your turn to guess
        </span>

        <div className={`font-mono text-[52px] font-black leading-none ${timerColor}`}>
          {Math.ceil(secondsLeft)}
          <span className="font-sans text-[16px] font-normal text-surface/60">s</span>
        </div>

        {view.wordLength !== null ? (
          <div className="flex flex-col items-center gap-2">
            <span className="font-sans text-[13px] text-surface/70">The word has</span>
            <span className="font-serif text-[36px] font-bold text-surface">{view.wordLength}</span>
            <span className="font-sans text-[13px] text-surface/70">letters</span>
          </div>
        ) : null}

        {view.word !== null ? (
          // Spectator display: show the word
          <div className="flex flex-col items-center gap-1">
            <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-surface/60">The word</span>
            <span className="font-sans text-[28px] font-bold text-surface">{view.word}</span>
          </div>
        ) : null}

        <div className="flex flex-col items-center gap-3 text-surface/80">
          <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.12em] text-surface/60">
            Questions asked: {view.questionCount}
          </span>
        </div>

        {onSubmit !== undefined ? (
          <div className="flex w-full max-w-xs flex-col gap-3">
            <input
              ref={inputRef}
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="Type your guess…"
              disabled={submitted}
              className="w-full rounded-xl border-2 border-surface/30 bg-surface/10 px-4 py-3 font-sans text-[16px] text-surface placeholder:text-surface/40 focus:border-surface/60 focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!guess.trim() || submitted}
              className="rounded-xl bg-surface px-6 py-3 font-sans text-[15px] font-bold text-accent disabled:opacity-40"
            >
              {submitted ? 'Submitted!' : 'Submit guess'}
            </button>
          </div>
        ) : null}
      </div>
    </SlideFrame>
  );
}

interface AudiencePanelProps {
  readonly word: string;
  readonly guesserName: string;
  readonly questionCount: number;
  readonly secondsLeft: number;
  readonly isModerator: boolean;
  readonly onAdjust: (delta: 1 | -1) => void;
  readonly animateKey: string | number;
}

function AudiencePanel({ word, guesserName, questionCount, secondsLeft, isModerator, onAdjust, animateKey }: AudiencePanelProps) {
  return (
    <SlideFrame tone={SlideTone.STAGE} compact animateKey={animateKey}>
      <div className="flex flex-col items-center gap-6 text-center">
        <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.18em] text-surface/70">
          {guesserName} is guessing
        </span>

        <div className="flex flex-col items-center gap-1">
          <span className="font-sans text-[13px] font-bold text-surface/80">The word is</span>
          <p className="font-serif text-[52px] font-semibold leading-none text-surface sm:text-[64px]">
            {word}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="font-sans text-[13px] text-surface/70">Time left</span>
          <span className="font-mono text-[28px] font-bold text-surface">{Math.ceil(secondsLeft)}s</span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="font-sans text-[13px] font-bold text-surface/80">
            Questions remaining: <span className="text-surface">{questionCount}</span>
          </span>

          {isModerator ? (
            <div className="flex flex-col items-center gap-2">
              <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-surface/60">
                Moderator — adjust count
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onAdjust(-1)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-surface/20 font-sans text-[22px] font-bold text-surface hover:bg-surface/30"
                  aria-label="Decrease question count"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => onAdjust(1)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-surface/20 font-sans text-[22px] font-bold text-surface hover:bg-surface/30"
                  aria-label="Increase question count"
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <p className="font-sans text-[13px] text-surface/60">Answer questions out loud</p>
          )}
        </div>
      </div>
    </SlideFrame>
  );
}
