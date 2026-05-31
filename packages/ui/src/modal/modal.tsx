import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../button/button.tsx';
import { cn } from '../utils/cn.ts';

export type ModalIntent = 'standard' | 'danger';

/** Modal positions. 'center' is the canonical confirm; edges become sheets/drawers. */
export type ModalPosition = 'center' | 'top' | 'bottom' | 'left' | 'right';

interface SharedModalConfig {
  /** Where on screen the modal renders. Default: 'center'. */
  position?: ModalPosition;
  /** When true, clicking the scrim closes the modal. Default: true. Ignored when sticky. */
  closeOnOutsideClick?: boolean;
  /** When true, pressing Escape closes the modal. Default: true. Ignored when sticky. */
  closeOnEscape?: boolean;
  /** When true, the only way out is confirm/cancel — no scrim click, no Escape, no X. */
  sticky?: boolean;
}

// ============================================================================
// ModalShell — the layout + behavior primitive shared by Modal, CriticalModal,
// and CustomModal. Handles scrim, position, outside-click, and Escape.
// ============================================================================

interface ModalShellProps extends SharedModalConfig {
  open: boolean;
  onClose: () => void;
  role?: 'dialog' | 'alertdialog';
  className?: string;
  children: ReactNode;
}

function ModalShell({
  open,
  onClose,
  role = 'dialog',
  position = 'center',
  closeOnOutsideClick = true,
  closeOnEscape = true,
  sticky = false,
  className,
  children,
}: ModalShellProps) {
  useEffect(() => {
    if (!open || sticky || !closeOnEscape) return undefined;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, sticky, closeOnEscape, onClose]);

  if (!open) return null;

  function handleScrimClick() {
    if (sticky || !closeOnOutsideClick) return;
    onClose();
  }

  function stop(e: MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  return createPortal(
    <div
      role={role}
      aria-modal="true"
      onClick={handleScrimClick}
      className={cn(
        'fixed inset-0 z-50 flex bg-ink/[0.18]',
        POSITION_ALIGN[position],
      )}
    >
      <div
        onClick={stop}
        className={cn(
          'bg-surface shadow-lift-modal',
          POSITION_PANEL[position],
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

const POSITION_ALIGN: Record<ModalPosition, string> = {
  center: 'items-center justify-center p-6',
  top: 'items-start justify-center',
  bottom: 'items-end justify-center',
  left: 'items-stretch justify-start',
  right: 'items-stretch justify-end',
};

const POSITION_PANEL: Record<ModalPosition, string> = {
  center: 'w-full max-w-[520px] rounded-card-lg p-8',
  top: 'w-full max-w-[680px] rounded-b-card-lg p-8',
  bottom: 'w-full max-w-[680px] rounded-t-card-lg p-8',
  left: 'h-full w-full max-w-[420px] rounded-r-card-lg p-8 overflow-y-auto',
  right: 'h-full w-full max-w-[420px] rounded-l-card-lg p-8 overflow-y-auto',
};

// ============================================================================
// Modal — standard / destructive confirm modal.
// ============================================================================

export interface ModalProps extends SharedModalConfig {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  intent?: ModalIntent;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string;
  children?: ReactNode;
  className?: string;
}

// Visual spec: design-system/projects/gbedity/preview/40-modals.html
//
// Standard / destructive modal. Used for reversible-but-loud actions
// (skip turn, restart round). For irreversible actions, use CriticalModal
// which requires typing the literal action.
export function Modal({
  open,
  onClose,
  title,
  description,
  intent = 'standard',
  confirmLabel,
  onConfirm,
  cancelLabel = 'Cancel',
  children,
  className,
  position,
  closeOnOutsideClick,
  closeOnEscape,
  sticky,
}: ModalProps) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      role="dialog"
      {...(position !== undefined ? { position } : {})}
      {...(closeOnOutsideClick !== undefined ? { closeOnOutsideClick } : {})}
      {...(closeOnEscape !== undefined ? { closeOnEscape } : {})}
      {...(sticky !== undefined ? { sticky } : {})}
      {...(className !== undefined ? { className } : {})}
    >
      <h2 className="m-0 mb-[6px] font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h2>
      {description !== undefined && description !== null ? (
        <p className="m-0 mb-[22px] text-[15px] leading-[1.55] text-ink-2">{description}</p>
      ) : null}
      {children}
      <div className="mt-[22px] flex justify-end gap-[10px]">
        <Button variant="ghost" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant={intent === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </ModalShell>
  );
}

// ============================================================================
// CriticalModal — irreversible, requires typing the literal action.
// ============================================================================

export interface CriticalModalProps extends SharedModalConfig {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** The word/phrase the user must type to confirm. Case-sensitive. */
  confirmPhrase: string;
  /** Label rendered above the input — e.g. "Type Kemi to confirm". */
  confirmPrompt: ReactNode;
  /** Label on the confirm button — e.g. "Boot Kemi". */
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * CriticalModal — for irreversible actions.
 *
 * Visual spec: design-system/projects/gbedity/preview/40-modals.html
 *
 * Wrapped in a 3px danger border. The confirm button is disabled until the
 * typed input matches confirmPhrase exactly (case-sensitive). Used for boot-
 * player, end-session-mid-game, void-round. Per the brand rule: colour alone
 * never carries the weight — words do.
 *
 * Defaults: closeOnOutsideClick=false, closeOnEscape=true. We want users to
 * be able to escape critical modals (it's not a confirmation of an action
 * already underway), but accidental outside-click shouldn't dismiss them.
 */
export function CriticalModal({
  open,
  onClose,
  title,
  description,
  confirmPhrase,
  confirmPrompt,
  confirmLabel,
  onConfirm,
  cancelLabel = 'Cancel',
  children,
  className,
  position,
  closeOnOutsideClick = false,
  closeOnEscape,
  sticky,
}: CriticalModalProps) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const matched = typed === confirmPhrase;

  useEffect(() => {
    if (open) {
      setTyped('');
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      role="alertdialog"
      closeOnOutsideClick={closeOnOutsideClick}
      {...(position !== undefined ? { position } : {})}
      {...(closeOnEscape !== undefined ? { closeOnEscape } : {})}
      {...(sticky !== undefined ? { sticky } : {})}
      className={cn(
        'border-[3px] border-danger',
        className,
      )}
    >
      <span className="mb-[14px] inline-flex items-center gap-[6px] rounded-full bg-danger-soft px-3 py-[6px] font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-danger-deep">
        Critical · cannot be undone
      </span>
      <h2 className="m-0 mb-[6px] font-serif text-[28px] font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h2>
      {description !== undefined && description !== null ? (
        <p className="m-0 mb-[18px] text-[15px] leading-[1.55] text-ink-2">{description}</p>
      ) : null}
      {children}
      <div className="my-[14px] rounded-[16px] bg-canvas px-[18px] py-4">
        <p className="m-0 mb-2 font-sans text-[12px] font-bold text-ink-3">{confirmPrompt}</p>
        <input
          ref={inputRef}
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className={cn(
            'w-full rounded-[12px] border-2 bg-surface px-[14px] py-3 font-sans text-[16px] font-bold tracking-[0.04em] text-ink',
            'focus:outline-none',
            matched
              ? 'border-danger bg-danger-soft text-danger-deep'
              : 'border-ink-5 focus:border-danger',
          )}
        />
      </div>
      <div className="mt-[22px] flex justify-end gap-[10px]">
        <Button variant="ghost" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={!matched}>
          {confirmLabel}
        </Button>
      </div>
    </ModalShell>
  );
}

// ============================================================================
// CustomModal — arbitrary body. Service still provides scrim + close behavior.
// ============================================================================

export interface CustomModalProps extends SharedModalConfig {
  open: boolean;
  onClose: () => void;
  /** The body content. Renders inside the standard modal frame (scrim, padding, radius). */
  children: ReactNode;
  /** Hide the X close button in the top-right of the panel. Default: false. */
  hideCloseButton?: boolean;
  className?: string;
}

/**
 * CustomModal — for one-off modals that don't fit Modal/CriticalModal.
 *
 * The service provides the scrim, the position, the X close button, and the
 * outside-click / Escape behavior. The caller provides the body. This keeps
 * all custom modals visually consistent with the design system; it's the
 * recommended way to render modals with non-standard layouts (image preview,
 * tutorial overlay, large form, side drawer, bottom sheet).
 */
export function CustomModal({
  open,
  onClose,
  children,
  hideCloseButton = false,
  className,
  position,
  closeOnOutsideClick,
  closeOnEscape,
  sticky,
}: CustomModalProps) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      role="dialog"
      {...(position !== undefined ? { position } : {})}
      {...(closeOnOutsideClick !== undefined ? { closeOnOutsideClick } : {})}
      {...(closeOnEscape !== undefined ? { closeOnEscape } : {})}
      {...(sticky !== undefined ? { sticky } : {})}
      {...(className !== undefined ? { className } : {})}
    >
      {hideCloseButton || sticky === true ? null : (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-canvas text-ink hover:bg-canvas-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-action"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="3" x2="13" y2="13" />
            <line x1="13" y1="3" x2="3" y2="13" />
          </svg>
        </button>
      )}
      <div className="relative">{children}</div>
    </ModalShell>
  );
}
