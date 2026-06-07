// Reconnect tokens + identity for the room/play flow. Per PRD §11 the only client-side
// persistence is nickname + reconnect token, so a refresh can reclaim a seat. Scoped to
// sessionStorage (cleared when the tab closes) — never localStorage (security rule).

const KEYS = {
  HOST_ID: 'gbedity:hostId',
  HOST_TOKEN: 'gbedity:hostToken',
  PLAYER_ID: 'gbedity:playerId',
  RECONNECT_TOKEN: 'gbedity:reconnectToken',
  NICKNAME: 'gbedity:nickname',
  ROOM_CODE: 'gbedity:roomCode',
} as const;

function get(key: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.sessionStorage.getItem(key) ?? undefined;
}

function set(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(key, value);
}

function remove(key: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(key);
}

export interface HostSession {
  readonly hostId: string;
  readonly hostToken: string;
  readonly roomCode: string;
}

export interface PlayerSession {
  readonly playerId: string;
  readonly reconnectToken: string;
  readonly nickname: string;
  readonly roomCode: string;
}

export const sessionStore = {
  saveHost(s: HostSession): void {
    set(KEYS.HOST_ID, s.hostId);
    set(KEYS.HOST_TOKEN, s.hostToken);
    set(KEYS.ROOM_CODE, s.roomCode);
  },
  getHost(): HostSession | undefined {
    const hostId = get(KEYS.HOST_ID);
    const hostToken = get(KEYS.HOST_TOKEN);
    const roomCode = get(KEYS.ROOM_CODE);
    if (hostId === undefined || hostToken === undefined || roomCode === undefined) return undefined;
    return { hostId, hostToken, roomCode };
  },
  savePlayer(s: PlayerSession): void {
    set(KEYS.PLAYER_ID, s.playerId);
    set(KEYS.RECONNECT_TOKEN, s.reconnectToken);
    set(KEYS.NICKNAME, s.nickname);
    set(KEYS.ROOM_CODE, s.roomCode);
  },
  getPlayer(): PlayerSession | undefined {
    const playerId = get(KEYS.PLAYER_ID);
    const reconnectToken = get(KEYS.RECONNECT_TOKEN);
    const nickname = get(KEYS.NICKNAME);
    const roomCode = get(KEYS.ROOM_CODE);
    if (playerId === undefined || reconnectToken === undefined || nickname === undefined || roomCode === undefined) {
      return undefined;
    }
    return { playerId, reconnectToken, nickname, roomCode };
  },
  getNickname(): string | undefined {
    return get(KEYS.NICKNAME);
  },
  saveNickname(nickname: string): void {
    set(KEYS.NICKNAME, nickname);
  },
  // Drop the room/seat identity (e.g. after a room closes) so a stale reconnect token isn't reused.
  // Nickname is kept — it's a harmless convenience for the next room.
  clearRoom(): void {
    remove(KEYS.HOST_ID);
    remove(KEYS.HOST_TOKEN);
    remove(KEYS.PLAYER_ID);
    remove(KEYS.RECONNECT_TOKEN);
    remove(KEYS.ROOM_CODE);
  },
};
