import { useState } from 'react';

import { Button, DrawerService } from '@gbedity/ui';
import { MoreHorizontal, SkipForward } from '@icons';

import { type HostControls } from '../host-controls.ts';

// Host controls during live play — a slim sticky utility strip pinned to the bottom of the viewport,
// NOT a dominant card. Spec: gameplay is the hero; host controls never exceed ~10–15% of the visual
// weight. End game is a quiet text link that opens a confirmation, not a loud red button. The strip
// collapses to a single overflow toggle when the host is also playing and wants it out of the way.
//
// The control SET is per-game and decided upstream by `hostControlsFor` (host-controls.ts): End game
// is universal; Skip only shows for round/timer games. "Open display" is intentionally NOT here — the
// display is a spectator surface opened independently, not a host control.

interface HostControlStripProps {
  /** Which controls this game exposes (End game is always present). */
  readonly controls: HostControls;
  /** Advance the current round/phase early. Only invoked when `controls.skip`. */
  readonly onSkip: () => void;
  /** End the game now (after confirm). */
  readonly onEndGame: () => void;
}

export function HostControlStrip({ controls, onSkip, onEndGame }: Readonly<HostControlStripProps>) {
  const [open, setOpen] = useState(true);

  function confirmEnd(): void {
    DrawerService.confirm('End the game now?', {
      description: 'Current scores will count.',
      confirmLabel: 'End game',
      cancelLabel: 'Keep playing',
      destructive: true,
      onConfirm: onEndGame,
    });
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
      <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 border-t border-canvas-deep bg-canvas/95 px-6 py-2.5 backdrop-blur">
        <span className="hidden font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-4 sm:inline">
          Host
        </span>

        {open ? (
          <div className="flex flex-1 items-center gap-2">
            {controls.skip ? (
              <Button
                variant="ghost"
                size="sm"
                elevated={false}
                leadingIcon={<SkipForward size={15} aria-hidden="true" />}
                onClick={onSkip}
                title="Skip advances to the next round."
              >
                Skip round
              </Button>
            ) : null}
            <button
              type="button"
              onClick={confirmEnd}
              className="ml-auto rounded-btn-sm px-2 py-1 font-sans text-[13px] font-bold text-danger-deep underline-offset-2 transition-colors hover:bg-danger-soft hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
            >
              End game
            </button>
          </div>
        ) : (
          <span className="flex-1 font-sans text-[12px] text-ink-4">Controls hidden</span>
        )}

        <button
          type="button"
          aria-label={open ? 'Hide host controls' : 'Show host controls'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-canvas-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
