import { forwardRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

import { SoundKey } from '../sound/sound-manifest.ts';
import { useSound } from '../sound/use-sound.ts';
import { cn } from '../utils/cn.ts';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'celebrate'
  | 'danger'
  | 'stage';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  /**
   * Tactile "raised key" treatment: a solid offset shadow at rest that the button presses
   * down into when active (it travels down by the shadow depth and the shadow collapses),
   * so it feels like a physical key being pushed. On by default; pass `elevated={false}` for
   * a flat button. (The `ghost` variant has no surface, so it's never elevated.)
   */
  elevated?: boolean;
  /**
   * Play the UI click SFX on press (via the shared sound hook). Default true — every button
   * clicks, matching the WordMaster reference. Pass `clickSound={false}` for silent buttons
   * (e.g. inside a list where a click also fires its own sound). Respects global mute.
   */
  clickSound?: boolean;
}

// Visual spec: design-system/projects/gbedity/preview/10-buttons.html
//
// Five intents, each with its own job:
//   primary    — forward motion. Action green. The default.
//   secondary  — outlined ink. The calm alternative.
//   ghost      — low-emphasis tertiary, no surface.
//   celebrate  — accent orange. Reserved for celebration moments only — never decoration.
//   danger     — tomato red. Reserved for destructive actions; CRITICAL idiom uses
//                the type-to-confirm Modal, not this variant alone.
//   stage      — white-on-cobalt. Used inside the stage-frame post-game scenes.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-action text-white hover:bg-action-deep',
  secondary:
    'bg-surface text-ink shadow-[inset_0_0_0_2px_currentColor] hover:bg-canvas-tint',
  ghost: 'bg-transparent text-ink font-semibold hover:bg-ink/[0.06]',
  celebrate: 'bg-accent text-white hover:bg-accent-deep hover:text-white',
  danger: 'bg-danger text-white hover:bg-danger-deep',
  stage: 'bg-surface text-stage hover:bg-stage-tint',
};

// Colour of the offset "halo" ring drawn by ::after, per intent. Borders the ring
// in the variant's own voice so the double-border reads as one object.
const RING_CLASSES: Record<ButtonVariant, string> = {
  primary: 'after:border-action',
  secondary: 'after:border-ink',
  ghost: 'after:border-ink/40',
  celebrate: 'after:border-accent',
  danger: 'after:border-danger',
  stage: 'after:border-stage',
};

// The button radius, plus the matching ring radius. The ring sits 3px outside the
// edge, so its corners are 3px rounder (16→19, 20→23, 24→27) to stay concentric.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-5 text-[14px] rounded-btn-sm after:rounded-[19px]',
  md: 'h-12 px-7 text-[16px] rounded-btn after:rounded-[23px]',
  lg: 'h-14 px-9 text-[17px] rounded-btn-lg after:rounded-[27px]',
};

// The offset halo. A ::after pseudo-element sized a few px larger than the button,
// sitting at a distance outside its edge to read as a second, detached border.
//
// Resting: invisible and collapsed onto the button edge (opacity 0, scaled in).
// Hover/active: fades in and springs out to its offset distance.
// Only opacity + transform animate, so it stays on the compositor (no layout/repaint).
// The button must be `relative` and must NOT clip overflow for the ring to show.
const RING_BASE = cn(
  "after:pointer-events-none after:absolute after:content-['']",
  // Sit one notch outside the button on every edge → the "small distance" gap.
  'after:-inset-[3px]',
  // Two-pixel detached border. Radius comes from SIZE_CLASSES (concentric per size),
  // colour from RING_CLASSES (per variant).
  'after:border-2',
  // Resting state: hidden, pulled in tight against the edge.
  'after:scale-[0.97] after:opacity-0',
  // Spring it out + fade in on hover and while pressed.
  'hover:after:scale-100 hover:after:opacity-100',
  'active:after:scale-100 active:after:opacity-100',
  // Pressing nudges the whole button down 1px for a tactile click.
  'active:translate-y-px',
  // A disabled/loading button never shows the halo or the press nudge.
  'disabled:after:hidden disabled:active:translate-y-0',
  // Animate the halo with a slight overshoot so it feels springy, not linear.
  'after:transition-[opacity,transform] after:duration-200 after:ease-spring',
);

const GHOST_SIZE_OVERRIDES: Record<ButtonSize, string> = {
  // Ghost variant tightens padding per the brand spec — less surface to draw less attention.
  sm: 'px-4',
  md: 'px-5',
  lg: 'px-6',
};

// ── Elevation (tactile "raised key") ────────────────────────────────────────────────────
// A solid (blur-less) offset shadow under the button at rest. On press the button travels
// DOWN by the shadow depth while the shadow collapses to nothing — reading as a key pushed
// flat into the surface. Depth scales with size (sm 3 / md 4 / lg 5px).
//
// Shadow colour = a darker shade of the variant ("the side of the key"). Secondary (white
// surface) uses a forest-ink tint; ghost is never elevated (handled at the call site).
//
// IMPORTANT: Tailwind's JIT only compiles class names it can read as COMPLETE LITERALS in the
// source — interpolated `shadow-[0_${d}px_...]` would never be generated. So every (variant,
// size) elevation string below is written out in full, literally.
const ELEVATION: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: {
    sm: 'shadow-[0_3px_0_0_#1F9A60] active:shadow-[0_0_0_0_#1F9A60] active:translate-y-[3px]',
    md: 'shadow-[0_4px_0_0_#1F9A60] active:shadow-[0_0_0_0_#1F9A60] active:translate-y-[4px]',
    lg: 'shadow-[0_5px_0_0_#1F9A60] active:shadow-[0_0_0_0_#1F9A60] active:translate-y-[5px]',
  },
  // Secondary keeps its 2px inset border AND gains the offset shadow — both in one box-shadow
  // (a `shadow-[…]` utility replaces the whole property, so the inset must be re-stated here).
  secondary: {
    sm: 'shadow-[inset_0_0_0_2px_currentColor,0_3px_0_0_rgba(31,107,74,0.22)] active:shadow-[inset_0_0_0_2px_currentColor,0_0_0_0_rgba(31,107,74,0.22)] active:translate-y-[3px]',
    md: 'shadow-[inset_0_0_0_2px_currentColor,0_4px_0_0_rgba(31,107,74,0.22)] active:shadow-[inset_0_0_0_2px_currentColor,0_0_0_0_rgba(31,107,74,0.22)] active:translate-y-[4px]',
    lg: 'shadow-[inset_0_0_0_2px_currentColor,0_5px_0_0_rgba(31,107,74,0.22)] active:shadow-[inset_0_0_0_2px_currentColor,0_0_0_0_rgba(31,107,74,0.22)] active:translate-y-[5px]',
  },
  ghost: { sm: '', md: '', lg: '' }, // never elevated
  celebrate: {
    sm: 'shadow-[0_3px_0_0_#E8731A] active:shadow-[0_0_0_0_#E8731A] active:translate-y-[3px]',
    md: 'shadow-[0_4px_0_0_#E8731A] active:shadow-[0_0_0_0_#E8731A] active:translate-y-[4px]',
    lg: 'shadow-[0_5px_0_0_#E8731A] active:shadow-[0_0_0_0_#E8731A] active:translate-y-[5px]',
  },
  danger: {
    sm: 'shadow-[0_3px_0_0_#C44035] active:shadow-[0_0_0_0_#C44035] active:translate-y-[3px]',
    md: 'shadow-[0_4px_0_0_#C44035] active:shadow-[0_0_0_0_#C44035] active:translate-y-[4px]',
    lg: 'shadow-[0_5px_0_0_#C44035] active:shadow-[0_0_0_0_#C44035] active:translate-y-[5px]',
  },
  stage: {
    sm: 'shadow-[0_3px_0_0_#1E3FB8] active:shadow-[0_0_0_0_#1E3FB8] active:translate-y-[3px]',
    md: 'shadow-[0_4px_0_0_#1E3FB8] active:shadow-[0_0_0_0_#1E3FB8] active:translate-y-[4px]',
    lg: 'shadow-[0_5px_0_0_#1E3FB8] active:shadow-[0_0_0_0_#1E3FB8] active:translate-y-[5px]',
  },
};

// Snappy, compositor-friendly transition + disabled reset, shared across all elevated buttons.
const ELEVATION_BASE = cn(
  'transition-[box-shadow,transform,background-color,color] duration-100 ease-out',
  'disabled:shadow-none disabled:active:translate-y-0',
);

/**
 * Button — the primary interactive primitive.
 *
 * Visual spec: design-system/projects/gbedity/preview/10-buttons.html
 * Tokens: tailwind.preset.ts (theme.extend.colors, borderRadius)
 *
 * Fraunces never on buttons — Nunito 700 everywhere. Pill radii (16/20/24)
 * scale with size. The `stage` variant is for use inside the cobalt poster
 * frame on post-game scenes.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    elevated = true,
    clickSound = true,
    className,
    loading,
    leadingIcon,
    trailingIcon,
    children,
    disabled,
    type,
    onClick,
    ...rest
  },
  ref,
) {
  const isGhost = variant === 'ghost';
  // Ghost has no surface, so elevation is meaningless — never elevate it.
  const isElevated = elevated && !isGhost;
  const { play } = useSound();
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (clickSound) play(SoundKey.BUTTON_CLICK);
    onClick?.(event);
  };
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled === true || loading === true}
      aria-busy={loading === true ? true : undefined}
      onClick={handleClick}
      className={cn(
        // `relative` anchors the ::after halo; no overflow-clip so it can sit outside.
        'relative inline-flex items-center justify-center whitespace-nowrap gap-2',
        'font-sans font-bold tracking-[0.005em]',
        'transition-[background-color,color,transform] duration-150 ease-in-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:opacity-40',
        SIZE_CLASSES[size],
        isGhost ? GHOST_SIZE_OVERRIDES[size] : '',
        VARIANT_CLASSES[variant],
        // Offset double-border halo on hover/active.
        RING_BASE,
        RING_CLASSES[variant],
        // Tactile elevation owns the press travel; the base 1px nudge applies only when flat.
        isElevated ? cn(ELEVATION_BASE, ELEVATION[variant][size]) : 'active:translate-y-px',
        className,
      )}
      {...rest}
    >
      {leadingIcon !== undefined && leadingIcon !== null ? (
        <span className="inline-flex shrink-0">{leadingIcon}</span>
      ) : null}
      <span>{children}</span>
      {trailingIcon !== undefined && trailingIcon !== null ? (
        <span className="inline-flex shrink-0">{trailingIcon}</span>
      ) : null}
    </button>
  );
});
