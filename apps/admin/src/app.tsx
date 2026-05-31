import { BannerHost, Button, DrawerService, ModalHost, ToastHost } from '@gbedity/ui';
import { LayoutDashboard } from '@icons';

export function App() {
  return (
    <>
      <main className="mx-auto mt-16 flex max-w-2xl flex-col items-start gap-4 px-6">
        <h1 className="font-serif text-[40px] font-semibold leading-none tracking-[-0.02em] text-ink">
          Gbedity Admin
        </h1>
        <p className="text-ink-3">Operator surface for hosts, content, and league templates.</p>
        <Button leadingIcon={<LayoutDashboard size={18} />}>Get started</Button>

        <p className="mt-10 text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">
          Drawer service wired
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => DrawerService.toast('Saved.', { tone: 'success' })}
          >
            Toast
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              DrawerService.banner('Operator banners live here', {
                tone: 'info',
                description: 'Triggered from admin via DrawerService.banner(...).',
                cta: { label: 'Got it', onClick: () => undefined },
              })
            }
          >
            Banner
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              DrawerService.confirm('Reset all session presets?', {
                description: 'This clears every saved league template for the workspace.',
                confirmLabel: 'Reset',
                destructive: true,
                onConfirm: () =>
                  DrawerService.toast('Presets reset', { tone: 'warn' }),
              })
            }
          >
            Confirm
          </Button>
        </div>
      </main>

      <BannerHost />
      <ModalHost />
      <ToastHost />
    </>
  );
}
