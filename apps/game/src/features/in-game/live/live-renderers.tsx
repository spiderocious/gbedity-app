import { useState } from 'react';

import { RealGameId } from '../../../shared/types/api.ts';
import type { ViewPatch } from '../../../shared/types/view.ts';
import {
  CategoryBadge,
  HeroNumeral,
  McqOptions,
  RankedGuesses,
  SubmissionFeed,
  TimerPill,
} from '../../../shared/games/content-primitives.tsx';

// Live patch → JSX, per real game, per surface (display vs player). The player renderer gets
// `send` to emit client.action. Renders defensively: patches vary by phase, fields are
// optional (integration-plan §8), so absence is handled. These replace the mock content for
// the 5 backed games; the 13 others keep the static registry.

type Send = (action: Record<string, unknown>) => void;

interface LiveRenderer {
  readonly display: (p: ViewPatch) => React.ReactNode;
  readonly player: (p: ViewPatch, send: Send) => React.ReactNode;
}

function RoundHeader({ left, timer }: { readonly left: string; readonly timer?: string }) {
  return (
    <div className="flex w-full items-center justify-between">
      <span className="font-sans text-[13px] font-bold uppercase tracking-[0.08em] text-ink-3">{left}</span>
      {timer !== undefined ? <TimerPill value={timer} /> : null}
    </div>
  );
}

// --- quizzes ---
function QuizPlayer(p: ViewPatch, send: Send) {
  const [chosen, setChosen] = useState<number | null>(null);
  const opts = p.options ?? [];
  return (
    <div className="flex flex-col gap-3">
      <p className="font-serif text-[20px] font-semibold text-ink">{p.prompt ?? 'Question'}</p>
      <McqOptions
        options={opts.map((text, i) => ({
          letter: String.fromCharCode(65 + i),
          text,
          state: chosen === i ? 'correct' : 'idle',
        }))}
      />
      <div className="grid grid-cols-2 gap-2">
        {opts.map((_, i) => (
          <button
            key={i}
            type="button"
            disabled={p.answered === true || chosen !== null}
            onClick={() => {
              setChosen(i);
              send({ type: 'quizzes.answer', questionIdx: p.qIndex ?? 0, choiceIdx: i });
            }}
            className="rounded-btn-sm bg-canvas py-2 font-sans text-[14px] font-bold text-ink hover:bg-canvas-deep disabled:opacity-50"
          >
            {String.fromCharCode(65 + i)}
          </button>
        ))}
      </div>
      {p.answered === true || chosen !== null ? <p className="font-sans text-[13px] font-bold text-action-deep">Answer locked in</p> : null}
    </div>
  );
}

// --- wordshot / synonyms-style live feed ---
function WordPlayer(p: ViewPatch, send: Send, type: string) {
  const [text, setText] = useState('');
  return (
    <div className="flex flex-col gap-3">
      <RoundHeader left={`${(p.letter ?? '').toUpperCase()} · ${p.category ?? ''}`} />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your answer…"
        className="rounded-input border-2 border-mist-soft bg-surface px-4 py-3 font-sans text-[17px] text-ink focus:border-action focus:outline-none"
      />
      <button
        type="button"
        onClick={() => { if (text.trim() !== '') { send({ type, text: text.trim() }); setText(''); } }}
        className="rounded-btn bg-action py-3 font-sans text-[15px] font-bold text-white hover:bg-action-deep"
      >
        Submit
      </button>
      {typeof p.yourScore === 'number' ? <p className="font-sans text-[13px] font-bold text-ink-3">Your score: {p.yourScore}</p> : null}
    </div>
  );
}

// --- word_bomb ---
function BombPlayer(p: ViewPatch, send: Send) {
  const [text, setText] = useState('');
  const yourTurn = p.yourTurn === true;
  return (
    <div className="flex flex-col gap-3 text-center">
      {yourTurn ? (
        <>
          <p className="font-serif text-[20px] font-semibold text-ink">It&apos;s your turn — go!</p>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`A ${p.category ?? 'word'}…`} className="rounded-input border-2 border-action bg-surface px-4 py-3 text-center font-sans text-[17px] text-ink focus:outline-none" />
          <button type="button" onClick={() => { if (text.trim() !== '') { send({ type: 'word_bomb.submit', text: text.trim() }); setText(''); } }} className="rounded-btn bg-action py-3 font-sans text-[15px] font-bold text-white hover:bg-action-deep">Submit</button>
        </>
      ) : (
        <p className="font-serif text-[18px] font-semibold text-ink-3">Someone else has the bomb — get ready.</p>
      )}
    </div>
  );
}

// --- hot_take_court ---
function HotTakePlayer(p: ViewPatch, send: Send) {
  const [text, setText] = useState('');
  if (p.phase === 'voting') {
    return (
      <div className="flex flex-col gap-2">
        <p className="font-sans text-[13px] font-bold text-ink-3">Vote the most convincing</p>
        {(p.defences ?? []).map((d) => (
          <button key={d.id ?? d.text} type="button" onClick={() => send({ type: 'hot_take.vote', defenceId: d.id })} className="rounded-card bg-canvas px-4 py-3 text-left font-serif text-[15px] italic text-ink hover:bg-canvas-deep">
            “{d.text}”
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="font-serif text-[18px] font-semibold text-ink">{p.prompt ?? 'Defend your position'}</p>
      <textarea value={text} maxLength={180} onChange={(e) => setText(e.target.value)} placeholder="One sentence…" rows={3} className="rounded-input border-2 border-mist-soft bg-surface px-4 py-3 font-sans text-[15px] text-ink focus:border-action focus:outline-none" />
      <button type="button" disabled={p.submitted === true} onClick={() => { if (text.trim() !== '') send({ type: 'hot_take.submit', text: text.trim() }); }} className="rounded-btn bg-action py-3 font-sans text-[15px] font-bold text-white hover:bg-action-deep disabled:opacity-50">
        {p.submitted === true ? 'Submitted' : 'Submit defence'}
      </button>
    </div>
  );
}

// --- plead_your_case ---
function PleadPlayer(p: ViewPatch, send: Send) {
  const [text, setText] = useState('');
  const sc = p.scenario;
  return (
    <div className="flex flex-col gap-3">
      {sc !== undefined ? (
        <div className="rounded-card bg-canvas px-4 py-3">
          <p className="font-serif text-[16px] font-semibold text-ink">{sc.charge}</p>
          <p className="mt-1 font-sans text-[13px] text-ink-3">{sc.facts}</p>
        </div>
      ) : null}
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your defence…" rows={5} className="rounded-input border-2 border-mist-soft bg-surface px-4 py-3 font-sans text-[15px] text-ink focus:border-action focus:outline-none" />
      <button type="button" disabled={p.submitted === true} onClick={() => { if (text.trim() !== '') send({ type: 'plead.submit', argument: text.trim() }); }} className="rounded-btn bg-action py-3 font-sans text-[15px] font-bold text-white hover:bg-action-deep disabled:opacity-50">
        {p.submitted === true ? 'Submitted' : 'Submit defence'}
      </button>
    </div>
  );
}

// Shared display renderers (public projection).
const RENDERERS: Record<string, LiveRenderer> = {
  [RealGameId.QUIZZES]: {
    display: (p) => (
      <div className="flex flex-col items-center gap-5 text-center">
        <RoundHeader left={`Q ${(p.qIndex ?? 0) + 1} / ${p.rounds ?? '?'}`} />
        <h2 className="font-serif text-[32px] font-semibold leading-[1.1] text-ink">{p.prompt ?? '…'}</h2>
        <McqOptions options={(p.options ?? []).map((t, i) => ({ letter: String.fromCharCode(65 + i), text: t }))} />
      </div>
    ),
    player: QuizPlayer,
  },
  [RealGameId.WORDSHOT]: {
    display: (p) => (
      <div className="flex flex-col items-center gap-5 text-center">
        <RoundHeader left={`Round ${(p.roundIndex ?? 0) + 1} / ${p.rounds ?? '?'}`} />
        <CategoryBadge>{p.category ?? ''}</CategoryBadge>
        <HeroNumeral value={(p.letter ?? '').toUpperCase()} tone="accent" />
        <SubmissionFeed items={(p.ranked ?? []).map((r) => r.name ?? '').filter(Boolean)} />
      </div>
    ),
    player: (p, send) => WordPlayer(p, send, 'wordshot.submit'),
  },
  [RealGameId.WORD_BOMB]: {
    display: (p) => (
      <div className="flex flex-col items-center gap-4 text-center">
        <CategoryBadge>{p.category ?? ''}</CategoryBadge>
        <HeroNumeral value="💣" tone="danger" />
        <p className="font-serif text-[22px] font-semibold text-ink">Round {(p.round ?? 0) + 1}</p>
        <SubmissionFeed items={p.used ?? []} />
      </div>
    ),
    player: BombPlayer,
  },
  [RealGameId.HOT_TAKE_COURT]: {
    display: (p) => (
      <div className="flex flex-col gap-4">
        <h2 className="text-center font-serif text-[28px] font-semibold leading-[1.15] text-ink">“{p.prompt ?? '…'}”</h2>
        <div className="flex flex-col gap-2">
          {(p.defences ?? []).map((d) => (
            <div key={d.id ?? d.text} className="flex items-center justify-between rounded-card bg-canvas px-4 py-3">
              <span className="font-serif text-[16px] font-semibold italic text-ink">“{d.text}”</span>
              <span className="font-sans text-[13px] font-bold text-ink-3">{d.votes ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    player: HotTakePlayer,
  },
  [RealGameId.PLEAD_YOUR_CASE]: {
    display: (p) => (
      <div className="flex flex-col gap-3">
        <span className="font-sans text-[13px] font-bold uppercase tracking-[0.08em] text-ink-3">Verdict pending</span>
        <h2 className="font-serif text-[24px] font-semibold text-ink">{p.scenario?.charge ?? 'The case'}</h2>
        <p className="font-sans text-[14px] text-ink-2">{p.scenario?.facts ?? ''}</p>
      </div>
    ),
    player: PleadPlayer,
  },
};

export function getLiveRenderer(gameId: string): LiveRenderer | undefined {
  return RENDERERS[gameId];
}

// Generic ranked board for the in-round reveal phase. When the reveal patch carries no rows
// (some games send a bare reveal between rounds), show a clear interstitial rather than "…".
export function LiveBoard({ patch }: { readonly patch: ViewPatch }) {
  const rows = (patch.board ?? patch.ranked ?? []).map((r) => ({
    name: r.name ?? r.playerId ?? '—',
    pct: typeof (r as { points?: number }).points === 'number' ? (r as { points: number }).points : (r as { pct?: number }).pct ?? 0,
  }));
  if (rows.length === 0) {
    return <p className="text-center font-serif text-[20px] font-semibold text-ink">Next round coming up…</p>;
  }
  return <RankedGuesses guesses={rows} />;
}
