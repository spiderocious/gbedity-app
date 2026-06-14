// Public surface of the Wordshot multiplayer slice. The generic in-game screens import from
// here to branch by backend gameId — keeping the slice self-contained.

export { MpWordshotScreen } from './screens/mp-screen.tsx';
export { MpAudience } from './logic/use-mp-wordshot.ts';

// The backend gameId this slice owns. The generic screens compare against this.
export const MpGameId = { WORDSHOT: 'wordshot' } as const;
