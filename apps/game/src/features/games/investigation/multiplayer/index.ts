// Public surface of the Investigation multiplayer slice. The generic in-game screens import from
// here to branch by backend gameId — keeping the slice self-contained.

export { MpInvestigationScreen } from './screens/mp-screen.tsx';
export { MpAudience } from './logic/use-mp-investigation.ts';

// The backend gameId this slice owns. The generic screens compare against this.
export const MpGameId = { INVESTIGATION: 'investigation' } as const;
