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
  const [patch, setPatch] = useState<ViewPatch | null>(null);
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
        setPatch(parsed.data.patch);
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
      patch,
      errorCode,
      sendAction: (action) => socketRef.current?.emit(ClientEvent.ACTION, { action }),
    }),
    [status, patch, errorCode],
  );

  return <RoomSocketContext.Provider value={value}>{children}</RoomSocketContext.Provider>;
}
