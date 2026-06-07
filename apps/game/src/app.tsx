import { BannerHost, ModalHost, SoundButton, ToastHost, soundService } from '@gbedity/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AppRoutes } from './app.routes.tsx';
import { GameSelectionHost } from './shared/catalogue/index.ts';

// Preload the gaming SFX once at boot (idempotent). Audio still won't play until the first
// user gesture — browsers block autoplay — but the clips are warm by then.
soundService.preload();

// One QueryClient for all REST. Retries are conservative: a coded ApiError (e.g.
// room_not_found) shouldn't be retried, so default retry is off — hooks opt in where useful.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
      <BannerHost />
      <ModalHost />
      <ToastHost />
      <GameSelectionHost />
      <SoundButton />
    </QueryClientProvider>
  );
}
