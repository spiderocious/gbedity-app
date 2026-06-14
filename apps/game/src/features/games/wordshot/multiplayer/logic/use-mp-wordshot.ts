import { useCallback, useState } from 'react';

import { useRoomSocket } from '../../../../../shared/realtime/room-socket-context.tsx';
import { Audience } from '../../../../../shared/types/view.ts';
import { HostAction } from '../../../../../shared/services/socket.ts';
import { toWsView, type WsView } from './patch.ts';

// The multiplayer driver for Wordshot. Engine-driven: owns no phase machine or round clock — the
// backend does. Reads the live patch from useRoomSocket(), narrows it to a typed WsView, holds
// only the local word input, and exposes submit + host controls. Audience-aware: host/player play
// off the PLAYER projection (carries yourSubmission/yourScore); spectator reads the base patch.

export const MpAudience = { PLAYER: 'player', HOST: 'host', SPECTATOR: 'spectator' } as const;
export type MpAudience = (typeof MpAudience)[keyof typeof MpAudience];

const SUBMIT = 'wordshot.submit';

export interface MpWordshot {
  readonly view: WsView | null; // null before the first patch arrives
  readonly gameOver: boolean;
  readonly word: string;
  readonly setWord: (value: string) => void;
  readonly submit: () => void;
  readonly skip: () => void;    // host only
  readonly endGame: () => void; // host only
}

export function useMpWordshot(audience: MpAudience): MpWordshot {
  const { patches, patch, gameOver, sendAction } = useRoomSocket();
  const [word, setWord] = useState('');

  // Host + player play off the PLAYER-audience projection (carries yourSubmission/yourScore).
  // The spectator/display reads the base patch — no per-player secrets.
  const source =
    audience === MpAudience.SPECTATOR
      ? (patches[Audience.DISPLAY] ?? patch)
      : (patches[Audience.PLAYER] ?? null);

  const view = source ? toWsView(source) : null;

  const submit = useCallback(() => {
    const text = word.trim();
    if (text === '') return;
    sendAction({ type: SUBMIT, text });
    setWord(''); // optimistic clear; backend confirms via TO_PLAYER patch (yourSubmission set)
  }, [word, sendAction]);

  const skip = useCallback(() => sendAction({ type: HostAction.SKIP }), [sendAction]);
  const endGame = useCallback(() => sendAction({ type: HostAction.END_GAME }), [sendAction]);

  return { view, gameOver, word, setWord, submit, skip, endGame };
}
