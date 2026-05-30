import type { ReactNode } from 'react';

import { cn } from '../utils/cn.ts';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

/** 8 seat colours. Never duplicated within a room. */
export type SeatIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface AvatarProps {
  /** Single character — typically the player's nickname initial. */
  initial: string;
  /** Seat assignment (1–8). Picks the avatar's background colour from the seat ramp. */
  seat?: SeatIndex;
  size?: AvatarSize;
  className?: string;
}

// Visual spec: design-system/projects/gbedity/preview/13-pills-badges.html
//
// Eight seat colours rotate from the brand secondary palette. Never duplicated
// within a single room. Initials in Nunito 800. Full-pill always.
export const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-10 w-10 text-[15px]',
  lg: 'h-14 w-14 text-[22px]',
  xl: 'h-[72px] w-[72px] text-[28px]',
};

const SEAT_CLASSES: Record<SeatIndex, string> = {
  1: 'bg-accent text-white',
  2: 'bg-stage text-white',
  3: 'bg-special text-white',
  4: 'bg-info text-ink',
  5: 'bg-action text-white',
  6: 'bg-warn text-ink',
  7: 'bg-danger text-white',
  8: 'bg-ink text-white',
};

export function Avatar({ initial, seat = 1, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center rounded-full font-sans font-extrabold',
        SIZE_CLASSES[size],
        SEAT_CLASSES[seat],
        className,
      )}
      aria-hidden="true"
    >
      {initial.slice(0, 1).toUpperCase()}
    </span>
  );
}

export interface AvatarStackProps {
  children: ReactNode;
  /** Optional overflow count badge (e.g. +3) appended after the children. */
  overflow?: number;
  size?: AvatarSize;
  className?: string;
}

/**
 * AvatarStack — overlapping avatars with optional overflow chip.
 *
 * Visual spec: design-system/projects/gbedity/preview/13-pills-badges.html
 *
 * Used in the lobby summary at the top of the catalogue ("7 players in the room").
 */
export function AvatarStack({ children, overflow, size = 'md', className }: AvatarStackProps) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      <span className="inline-flex [&>*]:-ml-[10px] [&>*]:ring-2 [&>*]:ring-surface [&>*:first-child]:ml-0">
        {children}
      </span>
      {overflow !== undefined && overflow > 0 ? (
        <span
          className={cn(
            '-ml-[10px] inline-flex items-center justify-center rounded-full bg-canvas font-sans font-extrabold text-ink ring-2 ring-surface',
            SIZE_CLASSES[size],
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}
