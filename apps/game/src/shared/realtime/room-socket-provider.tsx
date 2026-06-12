import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  ClientEvent,
  HostAction,
  ServerEvent,
  createSocket,
  type JoinPayload,
  type SocketRole,
} from '../services/socket.ts';
import { resultStore, type ResultRow } from '../services/result-store.ts';
import { log } from '../observability/logger.ts';
import { LogEvent } from '../observability/events.ts';
import { Audience, Phase, ServerView } from '../types/view.ts';
import {
  ConnectionStatus,
  RoomSocketContext,
  type PatchesByAudience,
  type RoomSocketValue,
} from './room-socket-context.tsx';
import { RoomClosedScreen } from './room-closed-screen.tsx';

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
  const [gameOver, setGameOver] = useState(false);
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);
  // The latest board-bearing patch — stashed at game-over so the (separate) result screens have the
  // real final standings after this socket unmounts.
  const lastBoardRef = useRef<ResultRow[] | null>(null);

  useEffect(() => {
    if (roomCode === '') return undefined;
    const l = log.scope(`RoomSocket:${role}`);
    l.event(LogEvent.WS_CONNECTING, { roomCode, role, hasReconnectToken: reconnectToken !== undefined, playerId });
    const socket = createSocket();
    socketRef.current = socket;

    const join: JoinPayload = {
      roomCode,
      role,
      ...(reconnectToken !== undefined ? { reconnectToken } : {}),
      ...(playerId !== undefined ? { playerId } : {}),
    };

    function emitJoin() {
      l.event(LogEvent.WS_CONNECTED, { socketId: socket.id });
      l.event(LogEvent.WS_JOIN_SENT, { roomCode, role, playerId });
      socket.emit(ClientEvent.JOIN, join);
    }

    socket.on('connect', emitJoin);
    socket.on(ServerEvent.JOINED, () => {
      l.event(LogEvent.ROOM_JOINED, { roomCode, role });
      setStatus(ConnectionStatus.LIVE);
    });
    socket.on(ServerEvent.VIEW, (raw: unknown) => {
      const parsed = ServerView.safeParse(raw);
      if (parsed.success) {
        const aud = (parsed.data.audience as Audience) ?? Audience.PLAYER;
        const p = parsed.data.patch;
        // The hot path. Mute via __gbedityLog.mute('ws_view_received') if it's too chatty. We log the
        // diagnostic fields that drive the flow (phase/idx/masked/board) — not the whole patch.
        l.event(LogEvent.WS_VIEW_RECEIVED, {
          audience: aud,
          phase: p.phase,
          idx: p.idx,
          masked: typeof p.masked === 'string' ? p.masked : undefined,
          solved: p.solved,
          deadline: p.deadline,
          rounds: p.rounds,
          boardLen: Array.isArray(p.board) ? p.board.length : undefined,
        });
        setStatus(ConnectionStatus.LIVE);
        // A FRESH game started after a previous game-over (the spectator/display loop): the host
        // queued the next game and its first live patch arrived on the same socket. Clear the
        // game-over latch so loop surfaces resume rendering the flow instead of holding the result.
        // Guard on a live phase (not lobby/done/leaderboard) so the terminal patch of the *just-
        // ended* game doesn't immediately un-latch it.
        const livePhase = p.phase !== Phase.LOBBY && p.phase !== Phase.DONE && p.phase !== Phase.LEADERBOARD;
        if (livePhase) setGameOver(false);
        // Store per audience so host- and player-audience patches don't overwrite each other
        // (the host seat receives both). Unknown audiences fall under 'player' as a safe default.
        setPatches((prev) => ({ ...prev, [aud]: p }));
        // Keep the freshest standings around for the result screen (board carries running totals).
        const board = p.board;
        if (Array.isArray(board) && board.length > 0) {
          lastBoardRef.current = board.map((b) => ({
            ...(b.playerId !== undefined ? { playerId: b.playerId } : {}),
            ...(b.name !== undefined ? { name: b.name } : {}),
            score: typeof b.points === 'number' ? b.points : 0,
          }));
        }
      } else {
        l.event(LogEvent.WS_VIEW_PARSE_FAILED, { issues: parsed.error.issues.slice(0, 5) });
      }
    });
    socket.on(ServerEvent.ERROR, (e: { code?: string }) => {
      l.event(LogEvent.WS_ERROR, { code: e?.code ?? 'unknown' });
      setErrorCode(e?.code ?? 'unknown');
      setStatus(ConnectionStatus.ERROR);
    });
    socket.on(ServerEvent.ROOM_SUSPENDED, () => {
      l.event(LogEvent.ROOM_SUSPENDED, { roomCode });
      setStatus(ConnectionStatus.SUSPENDED);
    });
    socket.on(ServerEvent.RESUMED, () => {
      l.event(LogEvent.ROOM_RESUMED, { roomCode });
      setStatus(ConnectionStatus.LIVE);
    });
    socket.on(ServerEvent.ROOM_ENDED, () => {
      l.event(LogEvent.ROOM_ENDED, { roomCode });
      setStatus(ConnectionStatus.ENDED);
    });
    // The active game ended (natural finish or host end_game). The room stays open (back to lobby);
    // in-game screens watch this flag to leave the play surface. Persist the final board first so
    // the result screen (a separate route, no socket) can render the real standings. Reset on (re)join.
    socket.on(ServerEvent.GAME_OVER, () => {
      l.event(LogEvent.ROOM_GAME_OVER, { roomCode, hadBoard: lastBoardRef.current !== null });
      if (lastBoardRef.current !== null) {
        resultStore.save(roomCode, { code: roomCode, rows: lastBoardRef.current });
      }
      setGameOver(true);
    });
    socket.on(ServerEvent.JOINED, () => setGameOver(false));
    socket.io.on('reconnect_attempt', (attempt: number) => {
      l.event(LogEvent.WS_RECONNECT_ATTEMPT, { attempt });
      setStatus(ConnectionStatus.RECONNECTING);
    });
    socket.on('disconnect', (reason: string) => {
      l.event(LogEvent.WS_DISCONNECTED, { reason });
      setStatus(ConnectionStatus.RECONNECTING);
    });

    return () => {
      l.event(LogEvent.WS_TEARDOWN, { roomCode, role });
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [roomCode, role, reconnectToken, playerId]);

  const value = useMemo<RoomSocketValue>(
    () => ({
      status,
      patches,
      gameOver,
      // The patch to render: player projection wins (host + player seats both play off it),
      // then display, then host. Surfaces that need a specific audience read `patches` directly.
      patch: patches[Audience.PLAYER] ?? patches[Audience.DISPLAY] ?? patches[Audience.HOST] ?? null,
      errorCode,
      sendAction: (action) => {
        log.event(LogEvent.WS_PACKET_SENT, { event: ClientEvent.ACTION, action, role }, { component: `RoomSocket:${role}` });
        socketRef.current?.emit(ClientEvent.ACTION, { action });
      },
      // Host-only: ask the server to end the room for everyone. The server boots all sockets and
      // emits ROOM_ENDED, which flips every client to status=ENDED (the closed screen below).
      endSession: () => {
        log.event(LogEvent.WS_PACKET_SENT, { event: ClientEvent.ACTION, action: { type: HostAction.END_SESSION }, role }, { component: `RoomSocket:${role}` });
        socketRef.current?.emit(ClientEvent.ACTION, { action: { type: HostAction.END_SESSION } });
      },
    }),
    [status, patches, errorCode, gameOver],
  );

  // Room ended (host ended it / grace expired) → every socket-backed screen shows the terminal
  // closed screen in one place, no per-screen handling.
  if (status === ConnectionStatus.ENDED) {
    return (
      <RoomSocketContext.Provider value={value}>
        <RoomClosedScreen />
      </RoomSocketContext.Provider>
    );
  }

  return <RoomSocketContext.Provider value={value}>{children}</RoomSocketContext.Provider>;
}
