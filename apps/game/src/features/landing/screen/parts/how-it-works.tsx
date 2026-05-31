import { Tv, Smartphone, PartyPopper, type LucideIcon } from '@icons';

// F — three-step explainer. Removes the "what even is this" friction for first-timers
// (PRD §1, §5). Numerals in Fraunces per the brand; icons carry the meaning alongside.

interface Step {
  readonly n: number;
  readonly icon: LucideIcon;
  readonly title: string;
  readonly body: string;
}

const STEPS: readonly Step[] = [
  {
    n: 1,
    icon: Tv,
    title: 'Open on a screen',
    body: 'Put Gbedity on any screen with a browser — Smart TV, laptop, or projector.',
  },
  {
    n: 2,
    icon: Smartphone,
    title: 'Phones join in',
    body: 'Everyone scans the code or types it in. No app, no sign-up, no fuss.',
  },
  {
    n: 3,
    icon: PartyPopper,
    title: 'Play together',
    body: 'Answer, vote, draw, argue. The shared screen keeps score.',
  },
];

interface StepCardProps {
  readonly step: Step;
}

function StepCard({ step }: StepCardProps) {
  const Icon = step.icon;
  return (
    <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
      <div className="flex items-center gap-3">
        <span
          className="font-serif text-[34px] font-semibold leading-none tabular-nums text-ink-4"
          style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144' }}
          aria-hidden="true"
        >
          {step.n.toString().padStart(2, '0')}
        </span>
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-action-soft text-action-deep"
        >
          <Icon size={20} />
        </span>
      </div>
      <h3 className="mt-3 font-sans text-[17px] font-bold text-ink">{step.title}</h3>
      <p className="mt-1 max-w-[34ch] font-sans text-[14px] leading-[1.5] text-ink-3">
        {step.body}
      </p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="mx-auto w-full max-w-6xl scroll-mt-6 px-6 py-12"
    >
      <h2
        id="how-it-works-title"
        className="mb-8 text-center font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink sm:text-[34px]"
      >
        How it works
      </h2>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        {STEPS.map((step) => (
          <StepCard key={step.n} step={step} />
        ))}
      </div>
    </section>
  );
}
