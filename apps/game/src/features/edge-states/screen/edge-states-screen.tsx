import { Banner, Button, Card, InlineAlert } from '@gbedity/ui';
import { RefreshCw, Trophy, WifiOff } from '@icons';

import { ROUTES } from '../../../shared/constants/routes.ts';
import { AppHeader } from '../../../shared/widgets/app-header.tsx';

// §8 — API-drift insurance states, built upfront and shown together. Each block is a
// reusable treatment that screens drop in inline (empty / loading / error / reconnecting /
// awaiting). Presentational; nothing here calls a backend.

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">{title}</h2>
      {children}
    </section>
  );
}

function WaitingDots() {
  return (
    <span className="inline-flex gap-1" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 rounded-full bg-ink-4 animate-[bob-dot_1.2s_ease-in-out_infinite]" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </span>
  );
}

export function EdgeStatesScreen() {
  return (
    <div className="min-h-screen bg-canvas pb-16">
      <AppHeader backTo={ROUTES.LANDING} />
      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-6 pt-2">
        <h1 className="font-serif text-[32px] font-semibold tracking-[-0.01em] text-ink">Edge states</h1>

        <Section title="Empty states">
          <Card size="lg" className="flex flex-col items-center gap-3 py-8 text-center">
            <Trophy size={40} aria-hidden="true" className="text-ink-4" />
            <p className="font-serif text-[18px] font-semibold text-ink">No games yet</p>
            <Button variant="primary">Add a game</Button>
          </Card>
        </Section>

        <Section title="Loading states">
          <Card size="lg" className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="font-serif text-[18px] font-semibold text-ink">Joining GBE-4ZK…</p>
            <WaitingDots />
          </Card>
          <Card size="lg" className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="font-serif text-[18px] font-semibold text-ink">The AI is reading the arguments…</p>
            <WaitingDots />
            <p className="font-sans text-[12px] text-ink-3">Usually 6–10 seconds</p>
          </Card>
        </Section>

        <Section title="Reconnecting">
          <Banner tone="warn" title="Reconnecting…" description="Hold tight — we’re re-establishing the connection." icon={<WifiOff size={16} aria-hidden="true" />} />
        </Section>

        <Section title="Error states">
          <InlineAlert tone="danger">Couldn’t find that room. Check the code and try again.</InlineAlert>
          <InlineAlert tone="danger">Word Bomb needs at least 3 players.</InlineAlert>
          <Card size="lg" className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="font-serif text-[18px] font-semibold text-ink">Something went sideways on our end.</p>
            <div className="flex gap-2">
              <Button variant="primary" leadingIcon={<RefreshCw size={16} aria-hidden="true" />}>Try again</Button>
              <Button variant="ghost">Tell us what happened</Button>
            </div>
          </Card>
        </Section>

        <Section title="Awaiting (missing-backend insurance)">
          <Card size="lg" className="flex items-center justify-between">
            <span className="font-sans text-[14px] text-ink-2">Waiting for others…</span>
            <span className="font-sans text-[14px] font-bold text-ink">3 / 4 submitted</span>
          </Card>
          <Card size="lg" className="flex items-center gap-3">
            <span className="font-sans text-[14px] text-ink-2">Waiting for the host…</span>
            <WaitingDots />
          </Card>
        </Section>
      </main>
    </div>
  );
}
