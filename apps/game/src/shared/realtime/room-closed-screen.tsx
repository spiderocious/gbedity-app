import { useEffect } from 'react';

import { Button, Logo } from '@gbedity/ui';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../constants/routes.ts';
import { sessionStore } from '../services/session-store.ts';

// Shown to every connected client when the room ends — the host ended the session, or the
// host-leave grace expired (PRD §10). The server has already booted the socket; this is the
// terminal "you've been removed" state. Clears the room/seat identity so a stale reconnect token
// isn't reused on the next room.
export function RoomClosedScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    sessionStore.clearRoom();
  }, []);

  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-6 text-center"
    >
      <Logo size="lg" />
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">
          This room has been closed
        </h1>
        <p className="max-w-[40ch] font-sans text-[15px] text-ink-3">
          The host ended the session. Thanks for playing — start or join another room any time.
        </p>
      </div>
      <Button variant="primary" size="lg" onClick={() => navigate(ROUTES.LANDING)}>
        Back to home
      </Button>
    </div>
  );
}
