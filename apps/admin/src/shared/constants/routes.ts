// Single source of truth for admin route paths. Never inline a path string in a <Link>/<NavLink>
// or createBrowserRouter entry — use ROUTES. Parametric routes are functions.
export const ROUTES = {
  LOGIN: '/login',
  METRICS: '/',
  CONTENT: '/content',
  CATALOGUE: '/catalogue',
  WORD_BANK: '/word-bank',
  RUBRIC: '/rubric',
  HISTORY: '/history',
  HISTORY_DETAIL: (id: string) => `/history/${id}`,
} as const;
