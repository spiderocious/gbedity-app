import { useMemo, useState } from 'react';

import { cn } from '../utils/cn.ts';
import { Avatar, SIZE_CLASSES, type AvatarSize, type SeatIndex } from './avatar.tsx';
import { generateDicebearSvg } from './helpers/generate-dicebear-svg.ts';
import { seatFromId } from './helpers/seat-from-id.ts';

export interface GameAvatarProps {
  /** Seed for the DiceBear avatar — a stable player or room id. */
  id: string;
  /** Override the fallback initial. Defaults to a letter derived from `id`. */
  initial?: string;
  /** Override the fallback seat colour (1–8). Defaults to a hash of `id`. */
  seat?: SeatIndex;
  size?: AvatarSize;
  className?: string;
  /**
   * Accessible label. When omitted, the avatar is decorative (`aria-hidden`),
   * matching the underlying Avatar — the player's name is shown alongside it.
   */
  label?: string;
}

// Visual spec: design-system/projects/gbedity/preview/13-pills-badges.html
//
// GameAvatar — a DiceBear `adventurer-neutral` portrait seeded from a stable id,
// with a graceful fallback to the seat-coloured initial Avatar.
//
// The SVG is generated synchronously and locally (no network), so there is no
// loading state. Fallback happens in two ways, both ending on the existing Avatar:
//   1. generateDicebearSvg returns null (empty id, or library error)
//   2. the generated <img> fails to render at runtime (onError)
//
// Seat colour and initial both derive from the id, so a given player always falls
// back to the same colour + letter — no bookkeeping at the call site. Callers may
// still override either via the `seat` / `initial` props.
export function GameAvatar({
  id,
  initial,
  seat,
  size = 'md',
  className,
  label,
}: Readonly<GameAvatarProps>) {
  const src = useMemo(() => generateDicebearSvg(id), [id]);
  const [imageFailed, setImageFailed] = useState(false);

  const useFallback = src === null || imageFailed;

  if (useFallback) {
    const derived = seatFromId(id);
    return (
      <Avatar
        initial={initial ?? derived.initial}
        seat={seat ?? derived.seat}
        size={size}
        className={className}
      />
    );
  }

  return (
    <img
      src={src}
      alt={label ?? ''}
      aria-hidden={label === undefined ? true : undefined}
      onError={() => setImageFailed(true)}
      className={cn(
        'inline-block flex-shrink-0 rounded-full object-cover',
        SIZE_CLASSES[size],
        className,
      )}
    />
  );
}
