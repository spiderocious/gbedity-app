// Public surface of the Missing Letters multiplayer slice. The generic in-game screens import from
// here to branch by backend gameId — keeping the slice self-contained.

export { MpMissingLettersScreen } from './screens/mp-screen.tsx';
export { MpAudience } from './logic/use-mp-missing-letters.ts';

// The backend gameId this slice owns. The generic screens compare against this.
export const MpGameId = { MISSING_LETTERS: 'missing_letters' } as const;
