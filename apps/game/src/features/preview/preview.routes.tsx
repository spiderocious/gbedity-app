import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

const PreviewScreen = lazy(() =>
  import('./screen/preview-screen.tsx').then((m) => ({ default: m.PreviewScreen })),
);

// Dev-facing component gallery for @gbedity/ui. Mounted at /preview.
export const previewRoute: RouteObject = {
  path: '/preview',
  Component: PreviewScreen,
};
