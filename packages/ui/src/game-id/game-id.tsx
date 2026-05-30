import { cn } from '../utils/cn.ts';
import type { CategoryKey } from '../pill/pill.tsx';

export type GameIdSize = 'sm' | 'md' | 'lg';

export interface GameIdProps {
  /** The numeric ID 1–19 (auto zero-padded to two digits). */
  id: number;
  /** Category tints the numeral at the canonical 55% opacity. */
  category: CategoryKey;
  size?: GameIdSize;
  className?: string;
}

// Visual spec: design-system/projects/gbedity/preview/15-numerals.html
//
// Permanent brand-system element — two-digit zero-pad, Fraunces SemiBold,
// tinted to the game's category colour at ~55% opacity. Shows up consistently
// on catalogue tiles, in-game headers, post-game headers, config head chips,
// and league queue rows. Presence, not noise.
const SIZE_CLASSES: Record<GameIdSize, string> = {
  sm: 'text-[22px]',
  md: 'text-[30px]',
  lg: 'text-[34px]',
};

const CATEGORY_TINT: Record<CategoryKey, string> = {
  casual: 'text-action',
  brain: 'text-stage',
  party: 'text-special',
  immersive: 'text-ink',
};

export function GameId({ id, category, size = 'md', className }: GameIdProps) {
  const padded = id.toString().padStart(2, '0');
  return (
    <span
      className={cn(
        'inline-block font-serif font-semibold leading-none tracking-[-0.02em] tabular-nums opacity-55',
        SIZE_CLASSES[size],
        CATEGORY_TINT[category],
        className,
      )}
      style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144' }}
      aria-hidden="true"
    >
      {padded}
    </span>
  );
}
