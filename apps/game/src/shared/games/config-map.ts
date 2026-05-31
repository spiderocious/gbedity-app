import { RealGameId } from '../types/api.ts';
import { GameKey } from './games-manifest.ts';

// Maps our UI GameKey → the backend gameId for the 5 implemented games. The other 13 have
// no engine yet (integration-plan §7), so they return undefined and stay mock-only.
const KEY_TO_BACKEND: Partial<Record<GameKey, RealGameId>> = {
  [GameKey.QUIZZES]: RealGameId.QUIZZES,
  [GameKey.WORDSHOT]: RealGameId.WORDSHOT,
  [GameKey.WORD_BOMB]: RealGameId.WORD_BOMB,
  [GameKey.HOT_TAKE_COURT]: RealGameId.HOT_TAKE_COURT,
  [GameKey.PLEAD_YOUR_CASE]: RealGameId.PLEAD_YOUR_CASE,
};

export function backendGameId(key: GameKey): RealGameId | undefined {
  return KEY_TO_BACKEND[key];
}

export function isRealGame(key: GameKey): boolean {
  return KEY_TO_BACKEND[key] !== undefined;
}

// Conservative config sent to POST /rooms/:code/start. We deliberately DO NOT send `rounds`
// (the backend 422s when it exceeds seeded content — integration-plan §8 B3); the engine's
// defaults are safe. Only timing/scoring fields the docs list as free are forwarded. For
// this pass we let the engine apply full defaults and send no config, which always starts.
export function buildStartConfig(): Record<string, unknown> {
  return {};
}
