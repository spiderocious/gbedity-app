import type { ReactNode } from 'react';

import { cn } from '../utils/cn.ts';
import type { CategoryKey } from '../pill/pill.tsx';

export interface GameTileProps {
  /** Numeric ID 1–19. Without `icon` it's the Fraunces watermark anchor; with `icon` it
   *  demotes to a faint corner reference. */
  id: number;
  category: CategoryKey;
  /** Short category tag in the tile top — e.g. "Quick", "Brain", "Party", "Immersive". */
  tag: string;
  /** Game title in Fraunces. */
  title: string;
  /** Meta line under the title — e.g. "3–10 · 8m". Nunito Bold uppercase. */
  meta: string;
  /** Plain-English description, Nunito Regular 13 Deep Mist. */
  description: string;
  /** Optional signature glyph (e.g. a lucide icon). When set it becomes the tile-top
   *  anchor and the numeric ID demotes to a faint corner reference. */
  icon?: ReactNode;
  /** Optional trailing slot in the body — typically a small Pill (e.g. "Default"). */
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}

// Visual spec: design-system/projects/gbedity/preview/14-cards-tiles-rows.html
//                design-system/projects/gbedity/preview/31-catalogue.html
//
// The signature catalogue tile. Category-tinted top with the game ID watermark,
// title, and tag. White body with meta + plain-English description. Three-up
// grid in the catalogue. Optional onClick makes the whole tile a button.
const CATEGORY_TOP: Record<CategoryKey, string> = {
  casual: 'bg-action',
  brain: 'bg-stage',
  party: 'bg-special',
  immersive: 'bg-ink',
};

export function GameTile({
  id,
  category,
  tag,
  title,
  meta,
  description,
  icon,
  trailing,
  onClick,
  className,
}: GameTileProps) {
  const isInteractive = onClick !== undefined;
  const Wrapper = isInteractive ? 'button' : 'div';
  const padded = id.toString().padStart(2, '0');
  const hasIcon = icon !== undefined && icon !== null;

  return (
    <Wrapper
      {...(isInteractive
        ? { type: 'button' as const, onClick }
        : {})}
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-[22px] bg-surface text-left',
        isInteractive &&
          'cursor-pointer transition-transform duration-150 ease-in-out hover:-translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        className,
      )}
    >
      <div className={cn('relative px-[18px] pb-[14px] pt-[18px] text-white', CATEGORY_TOP[category])}>
        {hasIcon ? (
          <>
            {/* Number demotes to a faint corner reference when a signature icon is present. */}
            <span
              className="absolute right-[14px] top-[12px] font-serif text-[13px] font-semibold leading-none tabular-nums opacity-40"
              style={{ fontVariationSettings: '"SOFT" 100, "opsz" 48' }}
              aria-hidden="true"
            >
              {padded}
            </span>
            <span
              aria-hidden="true"
              className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20"
            >
              {icon}
            </span>
          </>
        ) : (
          <p
            className="m-0 mb-2 font-serif text-[32px] font-semibold leading-none tracking-[-0.02em] tabular-nums opacity-55"
            style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144' }}
            aria-hidden="true"
          >
            {padded}
          </p>
        )}
        <p className="m-0 mb-1 font-sans text-[10px] font-extrabold uppercase tracking-[0.14em] opacity-85">
          {tag}
        </p>
        <p className="m-0 font-serif text-[19px] font-semibold leading-[1.1] tracking-[-0.005em]">
          {title}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-[18px] pb-[18px] pt-3">
        <div className="flex items-center gap-2">
          <span className="font-sans text-[11px] font-bold uppercase tracking-[0.04em] text-ink">
            {meta}
          </span>
          {trailing !== undefined && trailing !== null ? (
            <span className="ml-auto">{trailing}</span>
          ) : null}
        </div>
        <p className="m-0 font-sans text-[13px] font-normal leading-[1.4] text-ink-3">
          {description}
        </p>
      </div>
    </Wrapper>
  );
}
