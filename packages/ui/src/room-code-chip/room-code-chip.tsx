import { cn } from '../utils/cn.ts';

export type RoomCodeChipSize = 'sm' | 'md' | 'lg' | 'hero';

export interface RoomCodeChipProps {
  code: string;
  size?: RoomCodeChipSize;
  className?: string;
}

// Visual spec: screens-spec §2 (lobby chrome)
//
// The room code shown as a monospace, wide-tracked chip. Small in top bars, hero-scale
// on the display lobby. Forest Ink on canvas; never pure black.
const SIZE_CLASSES: Record<RoomCodeChipSize, string> = {
  sm: 'px-3 py-1 text-[13px] tracking-[0.2em]',
  md: 'px-4 py-[6px] text-[16px] tracking-[0.24em]',
  lg: 'px-5 py-2 text-[24px] tracking-[0.3em]',
  hero: 'px-7 py-3 text-[44px] tracking-[0.32em]',
};

export function RoomCodeChip({ code, size = 'md', className }: Readonly<RoomCodeChipProps>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-canvas font-mono font-bold uppercase text-ink',
        SIZE_CLASSES[size],
        className,
      )}
    >
      {code}
    </span>
  );
}
