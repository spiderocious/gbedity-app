import { useEffect, useRef, useState } from 'react';

import { X } from '@icons';

import { useCatalogue } from './use-catalogue.ts';
import { CatalogueGrid } from './catalogue-grid.tsx';
import type { CatalogueCategory, CatalogueGame } from './catalogue.types.ts';

// Game-selection flow (overlay, locked). Any screen can request a pick and get the chosen
// CatalogueGame back via a promise — without owning the catalogue UI:
//
//   const { selectGame } = useGameSelection();
//   const game = await selectGame({ filterCategory?, exclude? }); // CatalogueGame | null (cancelled)
//
// A single <GameSelectionHost /> mounted at app root renders the overlay grid (fed by the same
// useCatalogue() cache — no extra fetch) and resolves the caller's promise on pick/cancel. This
// mirrors DrawerService's imperative ergonomics; no context plumbing needed at call sites.

export interface SelectGameOptions {
  readonly title?: string;
  readonly filterCategory?: CatalogueCategory;
  /** gameIds / keys to omit (e.g. games already queued). */
  readonly exclude?: readonly string[];
}

interface PendingRequest extends SelectGameOptions {
  resolve: (game: CatalogueGame | null) => void;
}

// Tiny module-level pub/sub so useGameSelection() needs no provider in the React tree above the
// caller — only the single host subscribes. Same pattern as the UI lib's DrawerService.
let listener: ((req: PendingRequest) => void) | null = null;

function request(opts: SelectGameOptions): Promise<CatalogueGame | null> {
  return new Promise((resolve) => {
    if (!listener) {
      // No host mounted — fail safe (cancel) rather than hang.
      resolve(null);
      return;
    }
    listener({ ...opts, resolve });
  });
}

export function useGameSelection(): { selectGame: (opts?: SelectGameOptions) => Promise<CatalogueGame | null> } {
  return { selectGame: (opts = {}) => request(opts) };
}

// Mount once at app root (sibling to ModalHost/ToastHost). Owns the overlay + promise resolution.
export function GameSelectionHost() {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const { data, isLoading, isError, refetch } = useCatalogue();
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    listener = (req): void => setPending(req);
    return () => {
      listener = null;
    };
  }, []);

  // Esc cancels; focus the close button on open (a11y). `pending` is a dep, so the captured
  // resolve is always the current request's — no stale closure.
  useEffect(() => {
    if (!pending) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        pending.resolve(null);
        setPending(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);

  if (!pending) return null;

  function finish(game: CatalogueGame | null): void {
    pending?.resolve(game);
    setPending(null);
  }
  const cancel = (): void => finish(null);

  // Apply caller filters (category + exclusions) over the live store.
  const excluded = new Set(pending.exclude ?? []);
  const games = (data ?? []).filter(
    (g) =>
      (pending.filterCategory === undefined || g.category === pending.filterCategory) &&
      !excluded.has(g.gameId) &&
      !excluded.has(g.key),
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={pending.title ?? 'Pick a game'}
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-5 bg-canvas/95 px-6 py-4 backdrop-blur">
        <h2 className="font-serif text-[24px] font-semibold tracking-[-0.01em] text-ink">
          {pending.title ?? 'Pick a game'}
        </h2>
        <button
          ref={closeBtn}
          type="button"
          aria-label="Cancel"
          onClick={cancel}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-3 hover:bg-surface hover:text-ink"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        {isLoading ? (
          <p role="status" className="py-16 text-center font-sans text-[15px] text-ink-3">
            Loading games…
          </p>
        ) : isError ? (
          <div role="alert" className="py-16 text-center">
            <p className="font-sans text-[15px] text-ink-3">Couldn’t load games.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 font-sans text-[14px] font-bold text-action hover:text-action-deep"
            >
              Retry
            </button>
          </div>
        ) : games.length === 0 ? (
          <p className="py-16 text-center font-sans text-[15px] text-ink-3">No games available.</p>
        ) : (
          <CatalogueGrid games={games} onPick={finish} />
        )}
      </div>
    </div>
  );
}
