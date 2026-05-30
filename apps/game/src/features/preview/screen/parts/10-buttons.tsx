import { Button, type ButtonSize, type ButtonVariant } from '@gbedity/ui';
import { ArrowRight, Sparkles, Trash2 } from '@icons';

import { PageHead, RefBlock, RefRow } from './preview-canvas.tsx';

const VARIANTS: readonly ButtonVariant[] = [
  'primary',
  'secondary',
  'ghost',
  'celebrate',
  'danger',
];
const SIZES: readonly ButtonSize[] = ['sm', 'md', 'lg'];

export function ButtonsPart() {
  return (
    <div>
      <PageHead index="10 / PRIMITIVES" title="Button" subtitle="@gbedity/ui · button" />

      <p className="mb-6 max-w-[64ch] text-[13px] leading-[1.65] text-ink-3">
        Six intents. Primary is forward motion (action green); secondary is the calm alternative;
        ghost recedes. <strong>Celebrate</strong> is accent orange — reserved for celebration
        moments, never decoration. <strong>Danger</strong> is for destructive actions; irreversible
        ones use the CRITICAL modal idiom. <strong>Stage</strong> is the white-on-cobalt variant
        used inside post-game stage frames.
      </p>

      <RefBlock title="Variants">
        {VARIANTS.map((variant) => (
          <RefRow key={variant} label={variant}>
            <Button variant={variant}>Start game</Button>
            <Button variant={variant} trailingIcon={<ArrowRight size={16} />}>
              Continue
            </Button>
            <Button variant={variant} disabled>
              Disabled
            </Button>
          </RefRow>
        ))}
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Stage variant — used inside the cobalt poster frame">
        <div className="-mx-[22px] -mb-[22px] rounded-b-[20px] bg-stage p-7">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="stage">Play again</Button>
            <Button variant="stage" trailingIcon={<ArrowRight size={16} />}>
              Pick another
            </Button>
            <Button variant="stage" disabled>
              End session
            </Button>
          </div>
        </div>
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="Sizes">
        {SIZES.map((size) => (
          <RefRow key={size} label={size}>
            <Button size={size}>Start game</Button>
            <Button size={size} variant="secondary">
              Use defaults
            </Button>
            <Button size={size} variant="ghost">
              Back
            </Button>
          </RefRow>
        ))}
      </RefBlock>

      <div className="h-6" />

      <RefBlock title="States">
        <RefRow label="loading">
          <Button loading>Starting…</Button>
          <Button variant="secondary" loading>
            Saving config
          </Button>
        </RefRow>
        <RefRow label="with leading icon">
          <Button leadingIcon={<Sparkles size={16} />}>Configure</Button>
          <Button variant="celebrate" leadingIcon={<Sparkles size={16} />}>
            +250 points
          </Button>
        </RefRow>
        <RefRow label="destructive">
          <Button variant="danger" leadingIcon={<Trash2 size={16} />}>
            Boot player
          </Button>
        </RefRow>
        <RefRow label="full width">
          <div className="w-full">
            <Button className="w-full">Start game</Button>
          </div>
        </RefRow>
      </RefBlock>
    </div>
  );
}
