import { logger } from '@lib/logger';

import { getPlugin } from '../registry';
import { noopSink, type OutputSink } from '../output-sink';
import { deleteSnapshot, listActiveSnapshots, readSnapshot } from '../snapshot';
import { roomRegistry, type RoomRegistry } from '../room/room-registry';
import { listActiveRooms, readRoomSnapshot } from '../room/room-snapshot';
import { RoomPhase } from '../room/room.types';
import type { GameRuntime } from '../game-runtime';
import type { PlayerRef } from '../types';
import { SingleSession } from './single-session';
import { LeagueSession } from './league-session';
import type { LeagueConfig } from './session.types';

// Owns active game sessions, keyed by room code — the single authority for "what game is running
// in this room." Lives in the ENGINE layer and imports NO transport (socket.io): the OutputSink is
// injected via setSink() at boot. This is what keeps the gateway pure-transport and lets the rooms
// service depend on game lifecycle without reaching into the socket layer.

export class SessionManager {
  private readonly sessions = new Map<string, SingleSession>();
  private readonly leagues = new Map<string, LeagueSession>();
  private sink: OutputSink = noopSink;

  constructor(private readonly registry: RoomRegistry = roomRegistry) {}

  // The transport edge (gateway) injects its real sink at boot. Until then it's a no-op.
  setSink(sink: OutputSink): void {
    this.sink = sink;
  }

  get(roomCode: string): SingleSession | undefined {
    return this.sessions.get(roomCode);
  }

  has(roomCode: string): boolean {
    return this.sessions.has(roomCode) || this.leagues.has(roomCode);
  }

  // The active GameRuntime for a room — whether a single game or the league's current game. The
  // gateway routes WS actions here so it doesn't care which session kind is running.
  activeRuntime(roomCode: string): GameRuntime | undefined {
    return this.sessions.get(roomCode)?.runtime ?? this.leagues.get(roomCode)?.currentRuntime() ?? undefined;
  }

  // Start a configured league (4.x). Entries (plugin + config + resolved content + weight) are
  // prepared by the league service; this drives the queue and auto-advances on game end.
  startLeague(args: { roomCode: string; players: PlayerRef[]; league: LeagueConfig; onEnded?: () => void }): LeagueSession {
    const session = new LeagueSession({
      roomCode: args.roomCode,
      players: args.players,
      league: args.league,
      sink: this.sink,
    });
    this.leagues.set(args.roomCode, session);
    session.startNext();
    return session;
  }

  league(roomCode: string): LeagueSession | undefined {
    return this.leagues.get(roomCode);
  }

  // Start a new game in a room. Caller (rooms service) has done host/phase/min-player checks.
  create(args: {
    roomCode: string;
    gameId: string;
    players: PlayerRef[];
    config: unknown;
    content: unknown;
    onEnded?: () => void;
  }): SingleSession | null {
    const plugin = getPlugin(args.gameId);
    if (!plugin) return null;
    const session = SingleSession.start({
      roomCode: args.roomCode,
      plugin,
      players: args.players,
      config: args.config,
      content: args.content,
      sink: this.sink,
      ...(args.onEnded !== undefined && { onEnded: args.onEnded }),
    });
    this.sessions.set(args.roomCode, session);
    return session;
  }

  async end(roomCode: string): Promise<void> {
    const session = this.sessions.get(roomCode);
    if (session) {
      await session.dispose();
      this.sessions.delete(roomCode);
    }
    const league = this.leagues.get(roomCode);
    if (league) {
      await league.dispose();
      this.leagues.delete(roomCode);
    }
  }

  // Boot-time recovery (PRD §12). Rebuilds rooms from their Redis snapshots, then rebuilds any
  // in-flight game session from its self-sufficient game snapshot and rehydrates it. Runs after
  // Redis connects and before the server accepts traffic. Best-effort: a snapshot that can't be
  // resolved (unknown plugin, missing room) is logged and skipped, not fatal.
  async recoverAll(): Promise<{ rooms: number; games: number }> {
    let recoveredRooms = 0;
    let recoveredGames = 0;

    // 1. Restore rooms.
    for (const code of await listActiveRooms()) {
      const room = await readRoomSnapshot(code);
      if (room) {
        this.registry.restore(room);
        recoveredRooms += 1;
      }
    }

    // 2. Restore in-flight games. Best-effort + ISOLATED: a snapshot that can't be rehydrated
    // (unknown plugin, or an incompatible/partial state shape from an older plugin version) is
    // logged and skipped — one bad snapshot must NEVER take down the whole boot (which it did:
    // a stale state crashed a plugin's view() during rehydrate). The bad snapshot is deleted so
    // it can't wedge every subsequent restart.
    for (const code of await listActiveSnapshots()) {
      try {
        const snapshot = await readSnapshot(code);
        if (!snapshot) continue;
        const plugin = getPlugin(snapshot.gameId);
        if (!plugin) {
          logger.warn({ code, gameId: snapshot.gameId }, 'recovery skipped: unknown plugin');
          continue;
        }
        const room = this.registry.get(code);
        const session = SingleSession.recover({
          plugin,
          snapshot,
          sink: this.sink,
          onEnded: (): void => {
            if (room) {
              room.phase = RoomPhase.LOBBY;
              room.activeGame = null;
              this.registry.touch(room);
            }
            void this.end(code);
          },
        });
        this.sessions.set(code, session);
        recoveredGames += 1;
      } catch (err) {
        // Drop the un-rehydratable snapshot so it doesn't crash this boot AND every future one.
        logger.error({ code, err }, 'recovery skipped: snapshot could not be rehydrated');
        void deleteSnapshot(code);
      }
    }

    if (recoveredRooms > 0 || recoveredGames > 0) {
      logger.info({ rooms: recoveredRooms, games: recoveredGames }, 'recovery complete');
    }
    return { rooms: recoveredRooms, games: recoveredGames };
  }
}

// Process-wide singleton.
export const sessionManager = new SessionManager();
