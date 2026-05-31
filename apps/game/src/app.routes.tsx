import { Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { landingRoute } from './features/landing/landing.routes.tsx';
import { previewRoute } from './features/preview/preview.routes.tsx';

const router = createBrowserRouter([landingRoute, previewRoute]);

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
