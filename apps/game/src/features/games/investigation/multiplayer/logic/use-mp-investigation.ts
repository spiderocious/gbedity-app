import { useCallback } from 'react';

import { useRoomSocket } from '../../../../../shared/realtime/room-socket-context.tsx';
import { Audience } from '../../../../../shared/types/view.ts';
import { HostAction } from '../../../../../shared/services/socket.ts';
import { toInvView, type InvView } from './patch.ts';

// The multiplayer driver for Investigation. Engine-driven: owns no phase machine or clock — the
// backend does. Reads the live patch from useRoomSocket(), narrows it to a typed InvView, and exposes
// the reasoned-accusation action + host controls. Audience-aware: host/player play off the PLAYER
// projection (carries yourAccusation/locked/yourScore); spectator reads the base patch.

export const MpAudience = { PLAYER: 'player', HOST: 'host', SPECTATOR: 'spectator' } as const;
export type MpAudience = (typeof MpAudience)[keyof typeof MpAudience];

const ACCUSE = 'investigation.accuse';

export interface MpInvestigation {
  readonly view: InvView | null;
  readonly gameOver: boolean;
  readonly accuse: (a: { suspectId: string; evidenceId: string; confidence: string }) => void;
  readonly endGame: () => void; // host only
}

export function useMpInvestigation(audience: MpAudience): MpInvestigation {
  const { patches, patch, gameOver, sendAction } = useRoomSocket();

  const source =
    audience === MpAudience.SPECTATOR ? (patches[Audience.DISPLAY] ?? patch) : (patches[Audience.PLAYER] ?? null);
  const view = source ? toInvView(source) : null;

  const accuse = useCallback(
    (a: { suspectId: string; evidenceId: string; confidence: string }) => {
      if (a.suspectId === '') return;
      sendAction({ type: ACCUSE, suspectId: a.suspectId, evidenceId: a.evidenceId, confidence: a.confidence });
    },
    [sendAction],
  );

  const endGame = useCallback(() => sendAction({ type: HostAction.END_GAME }), [sendAction]);

  return { view, gameOver, accuse, endGame };
}
