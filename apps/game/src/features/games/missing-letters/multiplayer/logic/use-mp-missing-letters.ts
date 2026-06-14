import { useCallback, useState } from 'react';

import { useRoomSocket } from '../../../../../shared/realtime/room-socket-context.tsx';
import { Audience } from '../../../../../shared/types/view.ts';
import { HostAction } from '../../../../../shared/services/socket.ts';
import { toMlView, type MlView } from './patch.ts';

// The multiplayer driver for Missing Letters. Engine-driven: it does NOT own a phase machine or a
// round clock — the backend does. It reads the live patch from useRoomSocket(), narrows it to a
// typed MlView, holds only the local guess text, and exposes submit + host controls. Audience-aware:
// the host/player play off the PLAYER projection; the spectator (display) reads the base patch.

export const MpAudience = { PLAYER: 'player', HOST: 'host', SPECTATOR: 'spectator' } as const;
export type MpAudience = (typeof MpAudience)[keyof typeof MpAudience];

const GUESS = 'missing_letters.guess';

export interface MpMissingLetters {
  readonly view: MlView | null; // null before the first patch arrives
  readonly gameOver: boolean;
  readonly guess: string;
  readonly setGuess: (value: string) => void;
  readonly submit: () => void;
  readonly skip: () => void; // host only
  readonly endGame: () => void; // host only
}

export function useMpMissingLetters(audience: MpAudience): MpMissingLetters {
  const { patches, patch, gameOver, sendAction } = useRoomSocket();
  const [guess, setGuess] = useState('');

  // Host + player play off the PLAYER-audience projection (the host seat is also a player, and the
  // player projection carries the private locked/solved/yourScore). The spectator/display reads the
  // base patch (DISPLAY audience), which has no per-player secrets.
  const source =
    audience === MpAudience.SPECTATOR
      ? (patches[Audience.DISPLAY] ?? patch)
      : (patches[Audience.PLAYER] ?? null);

  const view = source ? toMlView(source) : null;

  const submit = useCallback(() => {
    const text = guess.trim();
    if (text === '') return;
    sendAction({ type: GUESS, text });
    // Optimistic clear; the backend's TO_PLAYER patch will set locked:true.
    setGuess('');
  }, [guess, sendAction]);

  const skip = useCallback(() => sendAction({ type: HostAction.SKIP }), [sendAction]);
  const endGame = useCallback(() => sendAction({ type: HostAction.END_GAME }), [sendAction]);

  return { view, gameOver, guess, setGuess, submit, skip, endGame };
}
