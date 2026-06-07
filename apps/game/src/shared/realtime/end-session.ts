import { ClientEvent, HostAction, ServerEvent, createSocket, SocketRole } from '../services/socket.ts';
import { sessionStore } from '../services/session-store.ts';

// Host-ends-session from a SOCKETLESS screen (the host lobby polls; it holds no live socket).
// Opens a one-shot host socket, joins with the host token (server verifies), emits the end-session
// action, then closes. Fire-and-forget — the server boots every other client to the closed screen;
// the host navigates home itself. Resolves once the action is sent (or on a short timeout, so a
// flaky socket never blocks the host's own navigation).
export function endSessionOnce(roomCode: string): Promise<void> {
  return new Promise((resolve) => {
    const host = sessionStore.getHost();
    if (host === undefined || roomCode === '') {
      resolve();
      return;
    }

    const socket = createSocket();
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      socket.removeAllListeners();
      socket.close();
      resolve();
    };

    // Don't hang the host if the socket can't connect — bail after a short grace.
    const timer = setTimeout(finish, 2500);

    socket.on('connect', () => {
      socket.emit(ClientEvent.JOIN, { roomCode, role: SocketRole.HOST, reconnectToken: host.hostToken });
    });
    socket.on(ServerEvent.JOINED, () => {
      socket.emit(ClientEvent.ACTION, { action: { type: HostAction.END_SESSION } });
      // Give the emit a tick to flush before we close.
      setTimeout(() => {
        clearTimeout(timer);
        finish();
      }, 150);
    });
    socket.on(ServerEvent.ERROR, () => {
      clearTimeout(timer);
      finish();
    });
  });
}
