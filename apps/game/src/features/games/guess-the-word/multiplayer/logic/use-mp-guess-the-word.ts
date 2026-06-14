import { useCallback } from 'react';

import { useRoomSocket } from '../../../../../shared/realtime/room-socket-context.tsx';
import { Audience } from '../../../../../shared/types/view.ts';
import { HostAction } from '../../../../../shared/services/socket.ts';
import { toGtwView, type GtwView } from './patch.ts';

// The multiplayer driver for Guess The Word. Engine-driven: no phase machine, no client clock.
// Host + player read the PLAYER-audience projection (per-player fields: isModerator, isGuesser).
// Spectator/display reads the DISPLAY projection (full word always visible).

export const MpAudience = { PLAYER: 'player', HOST: 'host', SPECTATOR: 'spectator' } as const;
export type MpAudience = (typeof MpAudience)[keyof typeof MpAudience];

export interface MpGuessTheWord {
  readonly view: GtwView | null;
  readonly gameOver: boolean;
  readonly submitGuess: (text: string) => void;
  readonly adjustCount: (delta: 1 | -1) => void;
  readonly skip: () => void;
  readonly endGame: () => void;
}

export function useMpGuessTheWord(audience: MpAudience): MpGuessTheWord {
  const { patches, patch, gameOver, sendAction } = useRoomSocket();

  const source =
    audience === MpAudience.SPECTATOR
      ? (patches[Audience.DISPLAY] ?? patch)
      : (patches[Audience.PLAYER] ?? null);

  const view = source ? toGtwView(source) : null;

  const submitGuess = useCallback(
    (text: string) => sendAction({ type: 'guess_the_word.submit_guess', text }),
    [sendAction],
  );

  const adjustCount = useCallback(
    (delta: 1 | -1) => sendAction({ type: 'guess_the_word.adjust_count', delta }),
    [sendAction],
  );

  const skip = useCallback(() => sendAction({ type: HostAction.SKIP }), [sendAction]);
  const endGame = useCallback(() => sendAction({ type: HostAction.END_GAME }), [sendAction]);

  return { view, gameOver, submitGuess, adjustCount, skip, endGame };
}
