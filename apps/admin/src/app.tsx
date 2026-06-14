import { BannerHost, ModalHost, ToastHost } from "@gbedity/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { ROUTES } from "./shared/constants/routes.ts";

const LoginScreen = lazy(() =>
  import("./features/auth/login-screen.tsx").then((m) => ({
    default: m.LoginScreen,
  })),
);
const AdminShell = lazy(() =>
  import("./features/shell/admin-shell.tsx").then((m) => ({
    default: m.AdminShell,
  })),
);
const MetricsScreen = lazy(() =>
  import("./features/metrics/metrics-screen.tsx").then((m) => ({
    default: m.MetricsScreen,
  })),
);
const ContentScreen = lazy(() =>
  import("./features/content/content-screen.tsx").then((m) => ({
    default: m.ContentScreen,
  })),
);
const CatalogueScreen = lazy(() =>
  import("./features/catalogue/screen/catalogue-screen.tsx").then((m) => ({
    default: m.CatalogueScreen,
  })),
);
const WordBankScreen = lazy(() =>
  import("./features/word-bank/screen/word-bank-screen.tsx").then((m) => ({
    default: m.WordBankScreen,
  })),
);
const HistoryScreen = lazy(() =>
  import("./features/history/screen/history-screen.tsx").then((m) => ({
    default: m.HistoryScreen,
  })),
);
const HistoryDetailScreen = lazy(() =>
  import("./features/history/screen/history-detail-screen.tsx").then((m) => ({
    default: m.HistoryDetailScreen,
  })),
);
const RubricScreen = lazy(() =>
  import("./features/rubric/rubric-screen.tsx").then((m) => ({
    default: m.RubricScreen,
  })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

const router = createBrowserRouter([
  { path: ROUTES.LOGIN, Component: LoginScreen },
  {
    path: ROUTES.METRICS,
    Component: AdminShell,
    children: [
      { index: true, Component: MetricsScreen },
      { path: "content", Component: ContentScreen },
      { path: "catalogue", Component: CatalogueScreen },
      { path: "word-bank", Component: WordBankScreen },
      { path: "history", Component: HistoryScreen },
      { path: "history/:id", Component: HistoryDetailScreen },
      { path: "rubric", Component: RubricScreen },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <RouterProvider router={router} />
      </Suspense>
      <BannerHost />
      <ModalHost />
      <ToastHost />
    </QueryClientProvider>
  );
}
