import type { ReactNode } from 'react';

import type { FeedbackTone } from '../feedback/feedback.tsx';
import {
  drawerStore,
  type BannerPosition,
  type ModalPosition,
  type ToastPosition,
} from './drawer-store.ts';

// Imperative service. Call from anywhere — no props, no context, no Provider.
// The host components (ToastHost, BannerHost, ModalHost) live once at the app
// root and subscribe to drawerStore via useSyncExternalStore.

// ============== Shared modal config ==============

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

// ============== Toast ==============

export interface ToastOptions {
  tone?: FeedbackTone;
  /** Auto-dismiss after this many ms. Default: 3500. Ignored when sticky. */
  durationMs?: number;
  /** When true, won't auto-dismiss and can't be swiped away. Default: false. */
  sticky?: boolean;
  /** Which screen zone the toast renders in. Default: 'bottom-center'. */
  position?: ToastPosition;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function toast(message: ReactNode, opts: ToastOptions = {}): string {
  const sticky = opts.sticky ?? false;
  return drawerStore.pushToast({
    tone: opts.tone ?? 'default',
    message,
    durationMs: opts.durationMs ?? 3500,
    sticky,
    position: opts.position ?? 'bottom-center',
    ...(opts.action ? { action: opts.action } : {}),
  });
}

function dismissToast(id: string): void {
  drawerStore.dismissToast(id);
}

// ============== Banner ==============

export interface BannerOptions {
  tone?: FeedbackTone;
  description?: ReactNode;
  icon?: ReactNode;
  cta?: {
    label: string;
    onClick: () => void;
  };
  /** Top or bottom of the viewport. Default: 'top'. */
  position?: BannerPosition;
  /** When true, won't auto-dismiss. Default: true (banners are sticky by default). */
  sticky?: boolean;
  /** Auto-dismiss after this many ms when not sticky. Default: 0 (never). */
  durationMs?: number;
}

function banner(title: ReactNode, opts: BannerOptions = {}): string {
  return drawerStore.pushBanner({
    tone: opts.tone ?? 'info',
    title,
    ...(opts.description !== undefined ? { description: opts.description } : {}),
    ...(opts.icon !== undefined ? { icon: opts.icon } : {}),
    ...(opts.cta !== undefined ? { cta: opts.cta } : {}),
    position: opts.position ?? 'top',
    sticky: opts.sticky ?? true,
    durationMs: opts.durationMs ?? 0,
  });
}

function dismissBanner(id: string): void {
  drawerStore.dismissBanner(id);
}

// ============== Confirm (Modal — standard / destructive) ==============

export interface ConfirmOptions extends SharedModalConfig {
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  children?: ReactNode;
  onCancel?: () => void;
}

function confirm(
  title: ReactNode,
  options: ConfirmOptions & { onConfirm: () => void },
): void {
  const {
    onConfirm,
    description,
    confirmLabel,
    cancelLabel,
    destructive,
    children,
    onCancel,
    position,
    closeOnOutsideClick,
    closeOnEscape,
    sticky,
  } = options;
  drawerStore.openModal({
    kind: destructive === true ? 'danger' : 'standard',
    title,
    ...(description !== undefined ? { description } : {}),
    confirmLabel: confirmLabel ?? (destructive === true ? 'Confirm' : 'OK'),
    ...(cancelLabel !== undefined ? { cancelLabel } : {}),
    onConfirm: () => {
      drawerStore.closeModal();
      onConfirm();
    },
    ...(onCancel !== undefined
      ? {
          onCancel: () => {
            drawerStore.closeModal();
            onCancel();
          },
        }
      : {}),
    ...(children !== undefined ? { children } : {}),
    position: position ?? 'center',
    closeOnOutsideClick: closeOnOutsideClick ?? true,
    closeOnEscape: closeOnEscape ?? true,
    sticky: sticky ?? false,
  });
}

// ============== Critical (Modal — irreversible, type-to-confirm) ==============

export interface CriticalOptions extends SharedModalConfig {
  description?: ReactNode;
  confirmLabel: string;
  /** Word/phrase the user must type. Case-sensitive. */
  confirmPhrase: string;
  /** Label rendered above the input. */
  confirmPrompt: ReactNode;
  cancelLabel?: string;
  children?: ReactNode;
  onCancel?: () => void;
}

function critical(title: ReactNode, options: CriticalOptions & { onConfirm: () => void }): void {
  const {
    onConfirm,
    description,
    confirmPhrase,
    confirmPrompt,
    confirmLabel,
    cancelLabel,
    children,
    onCancel,
    position,
    closeOnOutsideClick,
    closeOnEscape,
    sticky,
  } = options;
  drawerStore.openModal({
    kind: 'critical',
    title,
    ...(description !== undefined ? { description } : {}),
    confirmPhrase,
    confirmPrompt,
    confirmLabel,
    ...(cancelLabel !== undefined ? { cancelLabel } : {}),
    onConfirm: () => {
      drawerStore.closeModal();
      onConfirm();
    },
    ...(onCancel !== undefined
      ? {
          onCancel: () => {
            drawerStore.closeModal();
            onCancel();
          },
        }
      : {}),
    ...(children !== undefined ? { children } : {}),
    position: position ?? 'center',
    closeOnOutsideClick: closeOnOutsideClick ?? false, // safer default for critical
    closeOnEscape: closeOnEscape ?? true,
    sticky: sticky ?? false,
  });
}

// ============== Custom modal (arbitrary body) ==============

export interface CustomModalOptions extends SharedModalConfig {
  /** When true, hide the built-in X close button. Default: false. */
  hideCloseButton?: boolean;
  /** Called when the modal closes (any path — scrim click, Escape, X). */
  onClose?: () => void;
}

function openModal(body: ReactNode, options: CustomModalOptions = {}): void {
  const {
    onClose,
    hideCloseButton,
    position,
    closeOnOutsideClick,
    closeOnEscape,
    sticky,
  } = options;
  drawerStore.openModal({
    kind: 'custom',
    body,
    hideCloseButton: hideCloseButton ?? false,
    ...(onClose !== undefined
      ? {
          onCancel: () => {
            drawerStore.closeModal();
            onClose();
          },
        }
      : {}),
    position: position ?? 'center',
    closeOnOutsideClick: closeOnOutsideClick ?? true,
    closeOnEscape: closeOnEscape ?? true,
    sticky: sticky ?? false,
  });
}

function closeModal(): void {
  drawerStore.closeModal();
}

/**
 * DrawerService — imperative toast + banner + modal singleton.
 *
 * Mount <ToastHost />, <BannerHost />, and <ModalHost /> once at the app root,
 * then call from anywhere:
 *
 *   DrawerService.toast('Saved.', { tone: 'success' });
 *   DrawerService.toast('Network down', { sticky: true, position: 'top-right' });
 *
 *   DrawerService.banner('Open the display URL on your TV', {
 *     tone: 'info',
 *     cta: { label: 'Open', onClick: () => {} },
 *   });
 *
 *   DrawerService.confirm('Skip turn?', { onConfirm: () => {}, destructive: true });
 *
 *   DrawerService.critical('Boot Kemi?', {
 *     confirmPhrase: 'Kemi',
 *     confirmPrompt: <>Type <strong>Kemi</strong> to confirm</>,
 *     confirmLabel: 'Boot Kemi',
 *     onConfirm: () => {},
 *   });
 *
 *   DrawerService.openModal(<MyCustomBody />, {
 *     position: 'right',          // bottom sheet, side drawer, etc.
 *     closeOnOutsideClick: false, // hard-to-dismiss modal
 *     sticky: true,               // only confirm/cancel dismisses
 *   });
 */
export const DrawerService = {
  toast,
  dismissToast,
  banner,
  dismissBanner,
  confirm,
  critical,
  openModal,
  closeModal,
};
