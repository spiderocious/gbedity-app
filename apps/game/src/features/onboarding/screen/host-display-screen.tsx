import { Button, Card, DrawerService, RoomCodeChip } from '@gbedity/ui';
import { ArrowRight, Copy } from '@icons';

import { MOCK_ROOM_CODE, ROUTES, mockPath } from '../../../shared/constants/routes.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';
import { useStageNav } from '../../../shared/widgets/use-stage-nav.tsx';

// §1.6 — host display setup. Two options: this device IS the screen → display lobby; or
// open elsewhere → show a short link, then route to the host control lobby.
export function HostDisplayScreen() {
  const { go, curtain } = useStageNav();

  function openLinkModal() {
    DrawerService.openModal(
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="font-serif text-[24px] font-semibold text-ink">Open this on the shared screen</h2>
        <p className="font-sans text-[14px] text-ink-3">Go to this link on the TV, laptop, or projector:</p>
        <RoomCodeChip code="gbedity.app/d/4ZK" size="md" className="font-mono normal-case tracking-normal" />
        <Button
          variant="secondary"
          leadingIcon={<Copy size={16} aria-hidden="true" />}
          onClick={() => DrawerService.toast('Link copied', { tone: 'success' })}
        >
          Copy link
        </Button>
        <Button variant="primary" onClick={() => { DrawerService.closeModal(); go(mockPath(ROUTES.HOST_LOBBY)); }}>
          Done
        </Button>
      </div>,
      { position: 'center' },
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader backTo={ROUTES.HOST_NEW} />
      <main className="mx-auto flex max-w-lg flex-col px-6 pt-8">
        <Card size="lg" className="flex flex-col">
          <p className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
            Shared screen
          </p>
          <h1 className="mt-1 font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">
            Where should the game play?
          </h1>

          <div className="mt-6 flex flex-col gap-3">
            <div className="rounded-card bg-canvas p-4">
              <h2 className="font-sans text-[16px] font-bold text-ink">This device IS the shared screen.</h2>
              <p className="mt-1 font-sans text-[13px] text-ink-3">Best for laptops on a TV or projector.</p>
              <div className="mt-3">
                <Button variant="primary" trailingIcon={<ArrowRight size={16} aria-hidden="true" />} onClick={() => go(mockPath(ROUTES.DISPLAY_LOBBY))}>
                  Use this device
                </Button>
              </div>
            </div>
            <div className="rounded-card bg-canvas p-4">
              <h2 className="font-sans text-[16px] font-bold text-ink">I&apos;ll open it on another screen.</h2>
              <p className="mt-1 font-sans text-[13px] text-ink-3">We&apos;ll give you a link to open there.</p>
              <div className="mt-3">
                <Button variant="secondary" trailingIcon={<ArrowRight size={16} aria-hidden="true" />} onClick={openLinkModal}>
                  Get the link
                </Button>
              </div>
            </div>
          </div>

          <p className="mt-4 font-sans text-[12px] text-ink-3">You can change this any time. Room {MOCK_ROOM_CODE}.</p>
        </Card>
      </main>
      {curtain}
    </div>
  );
}
