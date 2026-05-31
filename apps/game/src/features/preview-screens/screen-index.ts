import { ROUTES, mockPath } from '../../shared/constants/routes.ts';

// Flat index of every screen for the /preview-screens jump page. Paths are pre-filled with
// mock params (room GBE-4ZK, game 6) so each link lands on a working, visible screen.

export const ScreenContext = {
  PLAYER: 'Player phone',
  HOST: 'Host phone',
  DISPLAY: 'Display',
  ANY: 'Any device',
} as const;
export type ScreenContext = (typeof ScreenContext)[keyof typeof ScreenContext];

export interface ScreenLink {
  readonly label: string;
  readonly path: string;
  readonly context: ScreenContext;
  readonly note?: string;
}

export interface ScreenGroup {
  readonly section: string;
  readonly screens: readonly ScreenLink[];
}

// A game id to demo per-game in-game/result screens (Word Bomb = the spec template).
const G = '6';

export const SCREEN_INDEX: readonly ScreenGroup[] = [
  {
    section: '§1 · Entry & onboarding',
    screens: [
      { label: 'Landing', path: ROUTES.LANDING, context: ScreenContext.ANY },
      { label: 'Join — code entry', path: ROUTES.JOIN, context: ScreenContext.PLAYER },
      { label: 'Join — nickname', path: ROUTES.JOIN_NICKNAME, context: ScreenContext.PLAYER },
      { label: 'Join — QR scan', path: ROUTES.JOIN_QR, context: ScreenContext.PLAYER, note: 'auto-advances after 2s' },
      { label: 'Host — start', path: ROUTES.HOST_NEW, context: ScreenContext.ANY },
      { label: 'Host — display setup', path: ROUTES.HOST_DISPLAY, context: ScreenContext.ANY },
    ],
  },
  {
    section: '§2 · Lobby',
    screens: [
      { label: 'Display lobby', path: mockPath(ROUTES.DISPLAY_LOBBY), context: ScreenContext.DISPLAY },
      { label: 'Player lobby', path: mockPath(ROUTES.PLAYER_LOBBY), context: ScreenContext.PLAYER },
      { label: 'Host lobby', path: mockPath(ROUTES.HOST_LOBBY), context: ScreenContext.HOST },
    ],
  },
  {
    section: '§3 · Catalogue & selection',
    screens: [
      { label: 'Game catalogue', path: ROUTES.HOST_CATALOGUE, context: ScreenContext.HOST },
      { label: 'League queue builder', path: ROUTES.HOST_LEAGUE_NEW, context: ScreenContext.HOST },
    ],
  },
  {
    section: '§4 · Configure',
    screens: [
      { label: 'Configure — Word Bomb', path: mockPath(ROUTES.HOST_CONFIGURE, '6'), context: ScreenContext.HOST },
      { label: 'Configure — Millionaire', path: mockPath(ROUTES.HOST_CONFIGURE, '12'), context: ScreenContext.HOST },
      { label: 'Configure — Plead Your Case', path: mockPath(ROUTES.HOST_CONFIGURE, '18'), context: ScreenContext.HOST },
    ],
  },
  {
    section: '§5 · In-game',
    screens: [
      { label: 'Display in-game', path: `${mockPath(ROUTES.DISPLAY_GAME)}?mock=${G}`, context: ScreenContext.DISPLAY },
      { label: 'Host in-game', path: `${mockPath(ROUTES.HOST_GAME)}?mock=${G}`, context: ScreenContext.HOST },
      { label: 'Player in-game', path: `${mockPath(ROUTES.PLAYER_GAME)}?mock=${G}`, context: ScreenContext.PLAYER, note: 'toggle active/waiting/spectator' },
    ],
  },
  {
    section: '§6 · Post-game & §7 player result',
    screens: [
      { label: 'Display result', path: `${mockPath(ROUTES.DISPLAY_RESULT)}?mock=${G}`, context: ScreenContext.DISPLAY },
      { label: 'Host result', path: `${mockPath(ROUTES.HOST_RESULT)}?mock=${G}`, context: ScreenContext.HOST },
      { label: 'Round detail', path: mockPath(ROUTES.HOST_ROUND_DETAIL), context: ScreenContext.HOST },
      { label: 'League final', path: mockPath(ROUTES.DISPLAY_LEAGUE_RESULT), context: ScreenContext.DISPLAY },
      { label: 'Player result', path: mockPath(ROUTES.PLAYER_RESULT), context: ScreenContext.PLAYER },
    ],
  },
  {
    section: '§8 · Edge states',
    screens: [
      { label: 'Edge states (all)', path: ROUTES.EDGE_STATES, context: ScreenContext.ANY },
    ],
  },
  {
    section: 'Design system',
    screens: [
      { label: 'Component preview gallery', path: ROUTES.PREVIEW, context: ScreenContext.ANY },
    ],
  },
];

// Every in-game screen, one per game, for exhaustively checking each game's content.
export const PER_GAME_SCREENS: readonly { readonly id: number; readonly title: string }[] = [
  { id: 1, title: 'Quizzes' },
  { id: 2, title: 'Bible Quiz' },
  { id: 3, title: 'Spelling Fast' },
  { id: 4, title: 'Typing Fast' },
  { id: 5, title: 'Wordshot' },
  { id: 6, title: 'Word Bomb' },
  { id: 7, title: 'Scrambled Word' },
  { id: 8, title: 'Missing Letters' },
  { id: 9, title: 'Definition Race' },
  { id: 10, title: 'Synonyms' },
  { id: 11, title: 'Antonyms' },
  { id: 12, title: 'Millionaire' },
  { id: 13, title: 'Truth or Dare' },
  { id: 14, title: 'Catch the Lie' },
  { id: 16, title: 'Hot Take Court' },
  { id: 17, title: 'Investigation' },
  { id: 18, title: 'Plead Your Case' },
  { id: 19, title: 'Presentation' },
];
