import { useSearchParams } from 'react-router-dom';

// In this UI-only build the active game is carried as a ?game=<id> query param (default 6,
// Word Bomb — the spec's template). Real sessions will read it from room state instead.
export function useGameParam(): string {
  const [params] = useSearchParams();
  return params.get('game') ?? '6';
}
