import { useSearchParams } from 'react-router-dom';

// Mock/preview game id for the static screens (host-game + result, reached from
// /preview-screens). Prefers ?mock=<id> (the current convention — live is the default and
// ?mock opts into static); ?game= is still accepted for older links. Default 6 (Word Bomb).
export function useGameParam(): string {
  const [params] = useSearchParams();
  return params.get('mock') ?? params.get('game') ?? '6';
}
