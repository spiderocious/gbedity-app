// The final game board, stashed at game-over so the result screens have real data AFTER the live
// socket has unmounted (the result screens are separate routes). Keyed by room code in
// sessionStorage (same scope/pattern as session-store). Cleared when a new game starts.

export interface ResultRow {
  readonly playerId?: string;
  readonly name?: string;
  readonly score: number;
}

export interface GameResultSnapshot {
  readonly code: string;
  readonly rows: readonly ResultRow[];
}

const KEY = (code: string): string => `gbedity:result:${code}`;

export const resultStore = {
  save(code: string, snapshot: GameResultSnapshot): void {
    if (typeof window === 'undefined' || code === '') return;
    window.sessionStorage.setItem(KEY(code), JSON.stringify(snapshot));
  },
  get(code: string): GameResultSnapshot | undefined {
    if (typeof window === 'undefined' || code === '') return undefined;
    try {
      const raw = window.sessionStorage.getItem(KEY(code));
      return raw !== null ? (JSON.parse(raw) as GameResultSnapshot) : undefined;
    } catch {
      return undefined;
    }
  },
  clear(code: string): void {
    if (typeof window === 'undefined' || code === '') return;
    window.sessionStorage.removeItem(KEY(code));
  },
};
