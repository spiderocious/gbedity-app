import { BannerHost, ModalHost, ToastHost } from '@gbedity/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AppRoutes } from './app.routes.tsx';

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
    </QueryClientProvider>
  );
}
