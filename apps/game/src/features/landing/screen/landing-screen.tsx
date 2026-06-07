import { GamesShowcase } from './parts/games-showcase.tsx';
import { HeroDemoPanel } from './parts/hero-demo-panel.tsx';
import { HeroCopy } from './parts/landing-hero.tsx';
import { HostRoomCard } from './parts/host-room-card.tsx';
import { HowItWorks } from './parts/how-it-works.tsx';
import { JoinRoomCard } from './parts/join-room-card.tsx';
import { LandingFooter } from './parts/landing-footer.tsx';
import { LandingTopBar } from './parts/landing-top-bar.tsx';
import { MadeForNights } from './parts/made-for-nights.tsx';
import { RoamingMonkeys } from './parts/roaming-monkeys.tsx';

// The `/` route — the dual-intent entry funnel (join a room · host a room) plus the
// catalogue showcase. Composition only; every section is a part. See
// docs/frontend/entrypoint-plan.md.
//
// Bare UI: no room logic, no API. Join/host/tile actions toast placeholders until the
// join, host, and game features are wired against the backend.
export function LandingScreen() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* <HeroConfetti /> */}
      <LandingTopBar />
      <main>
        {/* Entry section — hero copy, demo panel, and the two entry cards in one grid so
            their order can differ between mobile and desktop:
              mobile (1 col): copy → Join → demo → Host
              desktop (2 col): [copy | demo] then [Join | Host] */}
        <section className="relative mx-auto w-full max-w-6xl overflow-hidden px-6 pb-8 pt-8">
          <div className="grid grid-cols-1 items-start gap-x-10 gap-y-6 lg:grid-cols-2">
            <div className="order-1 self-center lg:order-1 lg:py-6">
              <HeroCopy />
            </div>
            <div className="order-3 flex justify-center lg:order-2 lg:justify-end lg:py-6">
              <HeroDemoPanel />
            </div>
            <div className="order-2 lg:order-3">
              <JoinRoomCard />
            </div>
            <div className="order-4 lg:order-4">
              <HostRoomCard />
            </div>
          </div>
        </section>

        <GamesShowcase />
        <MadeForNights />
        <HowItWorks />
      </main>
      <LandingFooter />
      <RoamingMonkeys />
    </div>
  );
}
