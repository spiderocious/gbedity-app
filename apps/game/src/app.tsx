import { BannerHost, ModalHost, ToastHost } from '@gbedity/ui';

import { AppRoutes } from './app.routes.tsx';

export function App() {
  return (
    <>
      <AppRoutes />
      <BannerHost />
      <ModalHost />
      <ToastHost />
    </>
  );
}
