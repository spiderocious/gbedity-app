export { MpGuessTheWordScreen } from './screens/mp-screen.tsx';
export { MpAudience } from './logic/use-mp-guess-the-word.ts';

export const MpGameId = { GUESS_THE_WORD: 'guess_the_word' } as const;
export type MpGameId = (typeof MpGameId)[keyof typeof MpGameId];
