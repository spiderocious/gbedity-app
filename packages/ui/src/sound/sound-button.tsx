import { cn } from '../utils/cn.ts';
import { SoundKey } from './sound-manifest.ts';
import { useSound } from './use-sound.ts';

export type SoundButtonPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left';

export interface SoundButtonProps {
  /** Which corner the button floats in. Default 'bottom-right'. */
  position?: SoundButtonPosition;
  className?: string;
}

// Visual spec: design-system/projects/gbedity/branding.md §6 (badges/chips, full pill radius)
//
// SoundButton — the genuinely-global floating mute toggle. Mounted ONCE at the app root
// (next to ToastHost / ModalHost) so it floats over every screen. Reactive via useSound:
// when mute flips anywhere, this re-renders. Icons are inline SVG (the @gbedity/ui package
// carries no lucide dependency — see logo.tsx / feedback.tsx).

const POSITION_CLASSES: Record<SoundButtonPosition, string> = {
  'bottom-right': 'bottom-5 right-5',
  'bottom-left': 'bottom-5 left-5',
  'top-right': 'top-5 right-5',
  'top-left': 'top-5 left-5',
};

export function SoundButton({ position = 'bottom-right', className }: Readonly<SoundButtonProps>) {
  const { isMuted, toggleMute, play } = useSound();

  const handleClick = (): void => {
    // Flip first, then play — so the confirming click is audible only when unmuting (when
    // muting, the service is already silent). play() no-ops while muted, which is the intent.
    toggleMute();
    play(SoundKey.BUTTON_CLICK);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={isMuted}
      className={cn(
        'fixed z-[70] grid h-12 w-12 place-items-center rounded-full',
        'bg-surface text-ink shadow-[0_8px_24px_rgba(31,107,74,0.18)]',
        'ring-1 ring-ink/10',
        'transition-transform duration-150 ease-spring motion-reduce:transition-none',
        'hover:scale-105 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        POSITION_CLASSES[position],
        className,
      )}
    >
      {isMuted ? <VolumeOffGlyph /> : <VolumeOnGlyph />}
    </button>
  );
}

// Inline SVG glyphs — lucide's Volume2 / VolumeX shapes, drawn here so the library stays
// lucide-free. `currentColor` + aria-hidden, sized to the button.
const GLYPH_PROPS = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function VolumeOnGlyph() {
  return (
    <svg {...GLYPH_PROPS}>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function VolumeOffGlyph() {
  return (
    <svg {...GLYPH_PROPS}>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="m22 9-6 6" />
      <path d="m16 9 6 6" />
    </svg>
  );
}
