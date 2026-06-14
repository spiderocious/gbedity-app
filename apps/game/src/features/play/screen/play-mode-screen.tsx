import { useState } from 'react';

import { Card, DrawerService, Pill } from '@gbedity/ui';
import { ArrowLeft, ArrowRight, KeyRound, PlusCircle, Settings2, Users, Zap, type LucideIcon } from '@icons';
import { useNavigate, useParams } from 'react-router-dom';
import { Show } from 'meemaw';

import { useCatalogueGame } from '../../../shared/catalogue/index.ts';
import { ROUTES, pathWith } from '../../../shared/constants/routes.ts';
import { useStartSolo } from '../../../shared/api/use-start-solo.ts';
import { clientDrivenSoloRoute } from '../../games/solo-entry.ts';
import { ApiError } from '../../../shared/services/api-error.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';

// Game-first entry — reached by clicking a game on the landing page (/play/:gameId). One decision:
// how do you want to play THIS game? Two stages so the screen never overwhelms:
//   Stage 1: Play Now (solo) · Multiplayer
//   Stage 2 (Play Now):     Start with defaults · Customise
//   Stage 2 (Multiplayer):  Create a room · Join with a code
// Multiplayer reuses the existing host/join flow untouched. Solo "Start with defaults" hits
// /solo/start directly; "Customise" routes to the shared configure screen in solo mode.

const Stage = { PICK: 'pick', SOLO: 'solo', MULTI: 'multi' } as const;
type Stage = (typeof Stage)[keyof typeof Stage];

interface Choice {
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly badge?: string;
  readonly onClick: () => void;
}

function ChoiceTile({ choice, disabled }: { readonly choice: Choice; readonly disabled?: boolean }) {
  const Icon = choice.icon;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={choice.onClick}
      className="group flex w-full items-center gap-4 rounded-card bg-canvas px-4 py-4 text-left transition-[transform,background-color] duration-150 ease-in-out hover:-translate-y-px hover:bg-canvas-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
    >
      <span aria-hidden="true" className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-surface text-action">
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="font-sans text-[16px] font-bold text-ink">{choice.title}</span>
          {choice.badge !== undefined ? <Pill tone="special">{choice.badge}</Pill> : null}
        </span>
        <span className="mt-[2px] block font-sans text-[13px] leading-[1.45] text-ink-3">{choice.description}</span>
      </span>
      <ArrowRight size={18} aria-hidden="true" className="flex-shrink-0 text-ink-4 group-hover:text-ink-3" />
    </button>
  );
}

export function PlayModeScreen() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const startSolo = useStartSolo();
  const { game, isLoading } = useCatalogueGame(gameId);
  const [stage, setStage] = useState<Stage>(Stage.PICK);

  function playWithDefaults() {
    if (game === undefined || startSolo.isPending) return;
    // A game with its own client-driven solo slice (e.g. Missing Letters) bypasses the room-based
    // /solo/start entirely — its route self-starts via REST.
    const clientRoute = clientDrivenSoloRoute(game.gameId);
    if (clientRoute !== null) {
      navigate(clientRoute);
      return;
    }
    startSolo.mutate(
      { gameId: game.gameId },
      {
        onSuccess: (res) => navigate(pathWith(ROUTES.PLAYER_GAME, { code: res.soloId })),
        onError: (e) => {
          const msg = e instanceof ApiError ? e.message : 'Couldn’t start this game.';
          DrawerService.toast(msg, { tone: 'danger' });
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader backTo={ROUTES.LANDING} />
        <p role="status" className="mx-auto max-w-md px-6 pt-10 text-center font-sans text-[15px] text-ink-3">
          Loading…
        </p>
      </div>
    );
  }

  if (game === undefined) {
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader backTo={ROUTES.LANDING} />
        <p className="mx-auto max-w-md px-6 pt-10 text-center font-sans text-[15px] text-ink-3">
          That game isn’t available.
        </p>
      </div>
    );
  }

  // Stage 2 choice sets. Multiplayer reuses host-start (create) and join-code (join) as-is.
  const pickChoices: readonly Choice[] = [
    { title: 'Play now', description: 'Just you, one device. Jump straight in.', icon: Zap, onClick: () => setStage(Stage.SOLO) },
    { title: 'Multiplayer', description: 'Play with the room — phones as controllers, a shared screen.', icon: Users, badge: 'Group', onClick: () => setStage(Stage.MULTI) },
  ];
  const soloChoices: readonly Choice[] = [
    { title: 'Start with defaults', description: 'Sensible settings, start in seconds.', icon: Zap, onClick: playWithDefaults },
    { title: 'Customise', description: 'Tune the rounds, timing, and difficulty first.', icon: Settings2, onClick: () => navigate(`${pathWith(ROUTES.HOST_CONFIGURE, { gameId: game.gameId })}?solo=1`) },
  ];
  const multiChoices: readonly Choice[] = [
    { title: 'Create a room', description: 'Open a room and invite the others to join.', icon: PlusCircle, onClick: () => navigate(`${ROUTES.HOST_NEW}?game=${game.gameId}`) },
    { title: 'Join with a code', description: 'Got a 6-character code? Hop into a friend’s room.', icon: KeyRound, onClick: () => navigate(ROUTES.JOIN) },
  ];

  const isPick = stage === Stage.PICK;
  const choices = stage === Stage.SOLO ? soloChoices : stage === Stage.MULTI ? multiChoices : pickChoices;
  const heading = isPick ? 'How do you want to play?' : stage === Stage.SOLO ? 'Solo it is.' : 'Playing together.';
  const sub = isPick
    ? 'Solo for a quick one, or gather the room.'
    : stage === Stage.SOLO
      ? 'One device, just you against the clock.'
      : 'Open a room or join one that’s already going.';

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <AppHeader backTo={ROUTES.LANDING} />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-5 px-6 py-8">
        <Card size="lg" className="flex flex-col">
          <p className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">{game.title}</p>
          <h1 className="mt-1 font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">{heading}</h1>
          <p className="mt-1 font-sans text-[14px] leading-[1.5] text-ink-3">{sub}</p>

          <div className="mt-6 flex flex-col gap-3">
            {choices.map((choice) => (
              <ChoiceTile key={choice.title} choice={choice} disabled={startSolo.isPending} />
            ))}
          </div>

          <Show when={startSolo.isPending}>
            <p className="mt-4 text-center font-sans text-[13px] text-ink-3">Starting your game…</p>
          </Show>

          <Show when={!isPick && !startSolo.isPending}>
            <button
              type="button"
              onClick={() => setStage(Stage.PICK)}
              className="mt-5 inline-flex items-center gap-1.5 self-start font-sans text-[13px] font-bold text-ink-3 hover:text-ink"
            >
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
          </Show>
        </Card>
      </main>
    </div>
  );
}
