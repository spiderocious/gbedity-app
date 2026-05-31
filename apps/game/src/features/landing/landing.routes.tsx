import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

const LandingScreen = lazy(() =>
  import('./screen/landing-screen.tsx').then((m) => ({ default: m.LandingScreen })),
);

// The `/` route. Route definition lives with its feature, mirroring previewRoute.
export const landingRoute: RouteObject = {
  path: '/',
  Component: LandingScreen,
};
