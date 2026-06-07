import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ServerEvent, SocketRole } from '../../services/socket.ts';
import type * as SocketModule from '../../services/socket.ts';
import { RoomSocketProvider } from '../room-socket-provider.tsx';

// A tiny fake socket whose `on` handlers we can fire by event name — lets us simulate the server
// emitting room_ended and assert the provider swaps its children for the closed screen.
const handlers = new Map<string, (arg?: unknown) => void>();
const fakeSocket = {
  on: (event: string, cb: (arg?: unknown) => void) => handlers.set(event, cb),
  off: () => undefined,
  emit: () => undefined,
  close: () => undefined,
  removeAllListeners: () => handlers.clear(),
  io: { on: () => undefined },
};

vi.mock('../../services/socket.ts', async (importActual) => {
  const actual = await importActual<typeof SocketModule>();
  return { ...actual, createSocket: () => fakeSocket };
});

afterEach(() => {
  handlers.clear();
  document.body.innerHTML = '';
});

describe('RoomSocketProvider — room ended', () => {
  it('shows the closed screen (not children) when the server ends the room', () => {
    render(
      <MemoryRouter>
        <RoomSocketProvider roomCode="GBE-4ZK" role={SocketRole.PLAYER}>
          <div>live game content</div>
        </RoomSocketProvider>
      </MemoryRouter>,
    );

    // Before the end signal, children render.
    expect(screen.getByText('live game content')).toBeInTheDocument();

    // Server boots the room → status flips to ENDED → closed screen replaces children.
    act(() => handlers.get(ServerEvent.ROOM_ENDED)?.());

    expect(screen.queryByText('live game content')).toBeNull();
    expect(screen.getByText(/this room has been closed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
  });
});
