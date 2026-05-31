import { useParams, useSearchParams } from 'react-router-dom';

import { MOCK_ROOM_CODE } from '../constants/routes.ts';
import { sessionStore } from '../services/session-store.ts';

// Resolve the active room code for a screen, in priority order:
//   1. :code route param (player/display/host-lobby paths carry it)
//   2. ?code= query param (host flow carries it forward from room creation)
//   3. stored session (host/player reconnect)
//   4. mock fallback (so mock-only screens still render in /preview-screens)
export function useRoomCode(): string {
  const params = useParams();
  const [search] = useSearchParams();
  const stored = sessionStore.getHost()?.roomCode ?? sessionStore.getPlayer()?.roomCode;
  return params.code ?? search.get('code') ?? stored ?? MOCK_ROOM_CODE;
}
