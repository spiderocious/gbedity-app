import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { previewRoute } from './features/preview/preview.routes.tsx';

const LandingScreen = lazy(() =>
  import('./features/landing/landing-screen.tsx').then((m) => ({ default: m.LandingScreen })),
);

const router = createBrowserRouter([
  { path: '/', Component: LandingScreen },
  previewRoute,
]);

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
