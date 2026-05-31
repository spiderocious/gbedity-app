import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  ClientEvent,
  ServerEvent,
  createSocket,
  type JoinPayload,
  type SocketRole,
} from '../services/socket.ts';
import { Audience, ServerView } from '../types/view.ts';
import {
  ConnectionStatus,
  RoomSocketContext,
  type PatchesByAudience,
  type RoomSocketValue,
} from './room-socket-context.tsx';

interface RoomSocketProviderProps {
  readonly roomCode: string;
  readonly role: SocketRole;
  readonly reconnectToken?: string;
  readonly playerId?: string;
  readonly children: ReactNode;
}

// Owns one Socket.IO connection for a room view (display / host / player). Joins on mount,
// parses incoming server.view patches with Zod, tracks connection + lifecycle status, and
// exposes sendAction. In-game screens consume this via useRoomSocket().
export function RoomSocketProvider({
  roomCode,
  role,
  reconnectToken,
  playerId,
  children,
}: RoomSocketProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.CONNECTING);
  const [patches, setPatches] = useState<PatchesByAudience>({});
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);

  useEffect(() => {
    if (roomCode === '') return undefined;
    const socket = createSocket();
    socketRef.current = socket;

    const join: JoinPayload = {
      roomCode,
      role,
      ...(reconnectToken !== undefined ? { reconnectToken } : {}),
      ...(playerId !== undefined ? { playerId } : {}),
    };

    function emitJoin() {
      socket.emit(ClientEvent.JOIN, join);
    }

    socket.on('connect', emitJoin);
    socket.on(ServerEvent.JOINED, () => setStatus(ConnectionStatus.LIVE));
    socket.on(ServerEvent.VIEW, (raw: unknown) => {
      const parsed = ServerView.safeParse(raw);
      if (parsed.success) {
        setStatus(ConnectionStatus.LIVE);
        // Store per audience so host- and player-audience patches don't overwrite each other
        // (the host seat receives both). Unknown audiences fall under 'player' as a safe default.
        const aud = (parsed.data.audience as Audience) ?? Audience.PLAYER;
        setPatches((prev) => ({ ...prev, [aud]: parsed.data.patch }));
      }
    });
    socket.on(ServerEvent.ERROR, (e: { code?: string }) => {
      setErrorCode(e?.code ?? 'unknown');
      setStatus(ConnectionStatus.ERROR);
    });
    socket.on(ServerEvent.ROOM_SUSPENDED, () => setStatus(ConnectionStatus.SUSPENDED));
    socket.on(ServerEvent.RESUMED, () => setStatus(ConnectionStatus.LIVE));
    socket.on(ServerEvent.ROOM_ENDED, () => setStatus(ConnectionStatus.ENDED));
    socket.io.on('reconnect_attempt', () => setStatus(ConnectionStatus.RECONNECTING));
    socket.on('disconnect', () => setStatus(ConnectionStatus.RECONNECTING));

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [roomCode, role, reconnectToken, playerId]);

  const value = useMemo<RoomSocketValue>(
    () => ({
      status,
      patches,
      // The patch to render: player projection wins (host + player seats both play off it),
      // then display, then host. Surfaces that need a specific audience read `patches` directly.
      patch: patches[Audience.PLAYER] ?? patches[Audience.DISPLAY] ?? patches[Audience.HOST] ?? null,
      errorCode,
      sendAction: (action) => socketRef.current?.emit(ClientEvent.ACTION, { action }),
    }),
    [status, patches, errorCode],
  );

  return <RoomSocketContext.Provider value={value}>{children}</RoomSocketContext.Provider>;
}
