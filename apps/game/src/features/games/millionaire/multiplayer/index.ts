// Public surface of the Millionaire multiplayer slice. The generic in-game screens import from
// here to branch by backend gameId — keeping the slice self-contained.

export { MpMillionaireScreen } from './screens/mp-screen.tsx';
export { MpAudience } from './logic/use-mp-millionaire.ts';

// The backend gameId this slice owns. The generic screens compare against this.
export const MpGameId = { MILLIONAIRE: 'millionaire' } as const;
