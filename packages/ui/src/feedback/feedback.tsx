import type { ReactNode } from 'react';

import { cn } from '../utils/cn.ts';

export type FeedbackTone = 'default' | 'success' | 'warn' | 'danger' | 'info';

// ============== TOAST ==============

export interface ToastProps {
  tone?: FeedbackTone;
  children: ReactNode;
  /** Optional inline action button — e.g. "Undo", "Skip". */
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

// Visual spec: design-system/projects/gbedity/preview/41-feedback.html
//
// Floating pill. Used for brief confirmations — joined the room, config saved,
// reconnecting, left. Renderable standalone; ToastHost (drawer service) stacks
// them via createPortal in the app shell.
const TOAST_TONE: Record<FeedbackTone, string> = {
  default: 'bg-ink text-white',
  success: 'bg-action text-white',
  warn: 'bg-warn text-ink',
  danger: 'bg-danger text-white',
  info: 'bg-info text-ink',
};

export function Toast({ tone = 'default', children, action, className }: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        'inline-flex max-w-full items-center gap-3 rounded-full px-[22px] py-3 pl-[18px]',
        'font-sans text-[14px] font-bold shadow-lift-card',
        TOAST_TONE[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="h-[10px] w-[10px] rounded-full bg-current opacity-80" />
      <span className="truncate">{children}</span>
      {action !== undefined ? (
        <button
          type="button"
          onClick={action.onClick}
          className={cn(
            'ml-1 cursor-pointer rounded-full border-0 bg-white/15 px-[10px] py-1',
            'font-sans text-[11px] font-extrabold uppercase tracking-[0.06em] text-inherit',
            'hover:bg-white/25',
          )}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

// ============== BANNER ==============

export interface BannerProps {
  tone?: FeedbackTone;
  title: ReactNode;
  description?: ReactNode;
  /** Optional inline action (text-only CTA at the right edge). */
  cta?: {
    label: string;
    onClick: () => void;
  };
  /** Icon glyph — usually a single character or small SVG. */
  icon?: ReactNode;
  className?: string;
}

const BANNER_TONE: Record<FeedbackTone, { bg: string; icon: string }> = {
  default: { bg: 'bg-canvas', icon: 'bg-ink text-white' },
  success: { bg: 'bg-action-soft', icon: 'bg-action text-white' },
  warn: { bg: 'bg-warn-soft', icon: 'bg-warn text-ink' },
  danger: { bg: 'bg-danger-soft', icon: 'bg-danger text-white' },
  info: { bg: 'bg-info-soft', icon: 'bg-info text-ink' },
};

const DEFAULT_GLYPH: Record<FeedbackTone, string> = {
  default: 'i',
  success: '✓',
  warn: '!',
  danger: '!',
  info: 'i',
};

/**
 * Banner — persistent full-width feedback. Lives inside a card or page.
 *
 * Visual spec: design-system/projects/gbedity/preview/41-feedback.html
 */
export function Banner({ tone = 'info', title, description, cta, icon, className }: BannerProps) {
  const { bg, icon: iconCls } = BANNER_TONE[tone];
  return (
    <div
      role={tone === 'danger' || tone === 'warn' ? 'alert' : 'status'}
      className={cn('flex items-center gap-[14px] rounded-[18px] px-5 py-4', bg, className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-black',
          iconCls,
        )}
      >
        {icon ?? DEFAULT_GLYPH[tone]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-serif text-[16px] font-semibold text-ink">{title}</p>
        {description !== undefined && description !== null ? (
          <p className="m-0 mt-[2px] text-[13px] leading-[1.5] text-ink-3">{description}</p>
        ) : null}
      </div>
      {cta !== undefined ? (
        <button
          type="button"
          onClick={cta.onClick}
          className="cursor-pointer border-0 bg-transparent px-0 font-sans text-[12px] font-extrabold uppercase tracking-[0.08em] text-ink hover:underline"
        >
          {cta.label}
        </button>
      ) : null}
    </div>
  );
}

// ============== INLINE ALERT ==============

export interface InlineAlertProps {
  tone?: FeedbackTone;
  children: ReactNode;
  className?: string;
}

/**
 * InlineAlert — compact alert for use inside forms or dense lists.
 *
 * Visual spec: design-system/projects/gbedity/preview/41-feedback.html
 *
 * Smaller than Banner, no icon disc, no CTA. Just a tone-tinted strip with
 * a single line of text.
 */
const INLINE_TONE: Record<FeedbackTone, string> = {
  default: 'bg-canvas text-ink',
  success: 'bg-action-soft text-action-deep',
  warn: 'bg-warn-soft text-[#8A6A0B]',
  danger: 'bg-danger-soft text-danger-deep',
  info: 'bg-info-soft text-[#1F7BA8]',
};

export function InlineAlert({ tone = 'info', children, className }: InlineAlertProps) {
  return (
    <div
      role={tone === 'danger' || tone === 'warn' ? 'alert' : 'status'}
      className={cn(
        'rounded-[12px] px-4 py-[10px] font-sans text-[13px] font-semibold',
        INLINE_TONE[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}
