// Admin tokens. accessToken in memory (not localStorage — XSS rule); refreshToken in
// sessionStorage so a refresh survives a reload within the tab.
let accessToken: string | null = null;

const REFRESH_KEY = 'gbedity:admin:refresh';

export const authStore = {
  setTokens(access: string, refresh: string): void {
    accessToken = access;
    if (typeof window !== 'undefined') window.sessionStorage.setItem(REFRESH_KEY, refresh);
  },
  getAccessToken(): string | null {
    return accessToken;
  },
  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(REFRESH_KEY);
  },
  clear(): void {
    accessToken = null;
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(REFRESH_KEY);
  },
  isAuthed(): boolean {
    return accessToken !== null;
  },
};
