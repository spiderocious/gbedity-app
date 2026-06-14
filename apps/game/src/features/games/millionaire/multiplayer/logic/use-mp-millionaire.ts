import { useCallback } from 'react';

import { useRoomSocket } from '../../../../../shared/realtime/room-socket-context.tsx';
import { Audience } from '../../../../../shared/types/view.ts';
import { HostAction } from '../../../../../shared/services/socket.ts';
import { toMmView, type MmView } from './patch.ts';

// The multiplayer driver for Who Wants to Be a Millionaire. Engine-driven: NO phase machine,
// NO client clock. Reads the live patch from useRoomSocket(), narrows it to a typed MmView, and
// exposes the game's action senders. Audience-aware (host/player → PLAYER patch, spectator → DISPLAY).
//
// Lifelines in multiplayer: only 50/50 is exposed here. ask_audience + phone_friend are disabled
// in the UI for now (the backend phases exist but we render a waiting fallback panel instead).

export const MpAudience = { PLAYER: 'player', HOST: 'host', SPECTATOR: 'spectator' } as const;
export type MpAudience = (typeof MpAudience)[keyof typeof MpAudience];

export interface MpMillionaire {
  readonly view: MmView | null;
  readonly gameOver: boolean;
  readonly answer: (choiceIdx: number) => void;
  readonly useFiftyFifty: () => void;
  readonly skip: () => void;
  readonly endGame: () => void;
}

export function useMpMillionaire(audience: MpAudience): MpMillionaire {
  const { patches, patch, gameOver, sendAction } = useRoomSocket();

  // Host + player play off the PLAYER projection (private fields: yourTurn, lifelinesUsed, etc.).
  // Spectator/display reads the base patch (no per-player secrets).
  const source =
    audience === MpAudience.SPECTATOR
      ? (patches[Audience.DISPLAY] ?? patch)
      : (patches[Audience.PLAYER] ?? null);

  const view = source ? toMmView(source) : null;

  const answer = useCallback(
    (choiceIdx: number) => sendAction({ type: 'millionaire.answer', choiceIdx }),
    [sendAction],
  );

  const useFiftyFifty = useCallback(
    () => sendAction({ type: 'millionaire.lifeline', lifeline: 'fifty_fifty' }),
    [sendAction],
  );

  const skip = useCallback(() => sendAction({ type: HostAction.SKIP }), [sendAction]);
  const endGame = useCallback(() => sendAction({ type: HostAction.END_GAME }), [sendAction]);

  return { view, gameOver, answer, useFiftyFifty, skip, endGame };
}
