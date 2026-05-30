import type { ReactNode } from 'react';

import { cn } from '../utils/cn.ts';

export type PillTone =
  | 'default'
  | 'action'
  | 'info'
  | 'warn'
  | 'danger'
  | 'special'
  | 'accent';

export interface PillProps {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}

// Visual spec: design-system/projects/gbedity/preview/13-pills-badges.html
//
// State at a glance. Full pill radius, uppercase Nunito 12px 700. Never serif,
// never sentence case. Player-state pills (Ready, Watching, Eliminated, etc.)
// live in lobby rows and in-game chrome.
const TONE_CLASSES: Record<PillTone, string> = {
  default: 'bg-canvas text-ink',
  action: 'bg-action-soft text-action-deep',
  info: 'bg-info-soft text-[#1F7BA8]',
  warn: 'bg-warn-soft text-[#8A6A0B]',
  danger: 'bg-danger-soft text-danger-deep',
  special: 'bg-special-soft text-special',
  accent: 'bg-accent-soft text-[#B85A12]',
};

export function Pill({ tone = 'default', children, className }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[6px] rounded-full px-3 py-[6px]',
        'font-sans text-[12px] font-bold uppercase tracking-[0.12em]',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type CategoryKey = 'casual' | 'brain' | 'party' | 'immersive';

export interface CategoryChipProps {
  category: CategoryKey;
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

const CATEGORY_ACTIVE: Record<CategoryKey, string> = {
  casual: 'bg-action text-white',
  brain: 'bg-stage text-white',
  party: 'bg-special text-white',
  immersive: 'bg-ink text-white',
};

const CATEGORY_INACTIVE = 'bg-surface text-ink-2 hover:text-ink';

/**
 * CategoryChip — filter row on the game catalogue.
 *
 * Visual spec: design-system/projects/gbedity/preview/13-pills-badges.html
 *
 * Each tints to the same category colour used on the catalogue tile top.
 * Clickable when `onClick` is provided.
 */
export function CategoryChip({
  category,
  children,
  active,
  onClick,
  className,
}: CategoryChipProps) {
  const isInteractive = onClick !== undefined;
  const Component = isInteractive ? 'button' : 'span';

  return (
    <Component
      {...(isInteractive
        ? { type: 'button' as const, onClick }
        : {})}
      className={cn(
        'inline-flex items-center gap-[6px] rounded-full border-0 px-[14px] py-[8px]',
        'font-sans text-[12px] font-bold tracking-[0.02em]',
        active === true ? CATEGORY_ACTIVE[category] : CATEGORY_INACTIVE,
        isInteractive && 'cursor-pointer transition-colors duration-150 ease-in-out',
        className,
      )}
    >
      {children}
    </Component>
  );
}
