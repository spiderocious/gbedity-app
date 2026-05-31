import { Navigate, useSearchParams } from 'react-router-dom';

import { ROUTES, pathWith } from '../../../shared/constants/routes.ts';
import { sessionStore } from '../../../shared/services/session-store.ts';

// The standalone league builder was a mock dead-end (BUG-02): it ignored the live room code,
// pre-seeded fake games, and "Start league" never called POST /rooms/:code/league. League is
// now built in the host lobby itself — queue ≥2 games → "Start league". So this route just
// redirects to the live host lobby (using the ?code or the stored host session).
export function LeagueBuilderScreen() {
  const [search] = useSearchParams();
  const code = search.get('code') ?? sessionStore.getHost()?.roomCode;
  if (code === undefined || code === '') {
    return <Navigate to={ROUTES.HOST_NEW} replace />;
  }
  return <Navigate to={`${pathWith(ROUTES.HOST_LOBBY, { code })}?league=1`} replace />;
}
