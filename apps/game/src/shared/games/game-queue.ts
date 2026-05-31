import { useSyncExternalStore } from 'react';

import type { GameKey } from './games-manifest.ts';

// The host's per-room queue of configured games. Configure adds to it; the room renders it
// and starts games from it. Lives client-side (sessionStorage) so it survives the
// room → catalogue → configure → room round trip without a backend round-trip. Reactive via
// a tiny pub-sub + useSyncExternalStore (same pattern as the drawer store).

export interface QueuedGame {
  /** Stable id for list keys / removal. */
  readonly uid: string;
  /** Catalogue game id (PRD numbering). */
  readonly gameId: number;
  readonly key: GameKey;
  readonly title: string;
  /** Backend gameId when this game is engine-backed; undefined for mock-only games. */
  readonly backendId?: string;
  /** Config snapshot (free-form; sent to the backend for real games). */
  readonly config: Record<string, unknown>;
  readonly weight: 1 | 2 | 3;
}

const STORAGE_PREFIX = 'gbedity:queue:';

type Listener = () => void;
const listeners = new Set<Listener>();
let seq = 0;

// Cache the parsed array per code so getSnapshot returns a stable reference between writes
// (useSyncExternalStore requires referential stability or it loops).
const cache = new Map<string, readonly QueuedGame[]>();

function storageKey(code: string): string {
  return `${STORAGE_PREFIX}${code}`;
}

function read(code: string): readonly QueuedGame[] {
  const cached = cache.get(code);
  if (cached !== undefined) return cached;
  let parsed: readonly QueuedGame[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(storageKey(code));
      if (raw !== null) parsed = JSON.parse(raw) as QueuedGame[];
    } catch {
      parsed = [];
    }
  }
  cache.set(code, parsed);
  return parsed;
}

function write(code: string, next: readonly QueuedGame[]): void {
  cache.set(code, next);
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(storageKey(code), JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

export const gameQueue = {
  list(code: string): readonly QueuedGame[] {
    return read(code);
  },
  add(code: string, game: Omit<QueuedGame, 'uid'>): void {
    seq += 1;
    const uid = `q${seq}`;
    write(code, [...read(code), { ...game, uid }]);
  },
  remove(code: string, uid: string): void {
    write(code, read(code).filter((g) => g.uid !== uid));
  },
  setWeight(code: string, uid: string, weight: 1 | 2 | 3): void {
    write(code, read(code).map((g) => (g.uid === uid ? { ...g, weight } : g)));
  },
  clear(code: string): void {
    write(code, []);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

// React binding — re-renders when the queue for `code` changes.
export function useGameQueue(code: string): readonly QueuedGame[] {
  return useSyncExternalStore(
    gameQueue.subscribe,
    () => gameQueue.list(code),
    () => gameQueue.list(code),
  );
}
