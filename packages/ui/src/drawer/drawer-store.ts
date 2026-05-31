import type { ReactNode } from 'react';

import type { FeedbackTone } from '../feedback/feedback.tsx';

// The drawer store backs the imperative DrawerService. It tracks three queues:
//
//   toasts  — auto-dismissing pills (or sticky undismissable ones) stacked in any of 6 zones
//   banners — persistent strips at top or bottom of the viewport
//   modal   — at most one open modal at a time (standard / danger / critical / custom)
//
// Subscription uses a tiny pub-sub so React's useSyncExternalStore (in the host components)
// keeps state in sync without any framework dependency.

// ============== Toast ==============

/** Six zones cover all real toast positions. */
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ToastEntry {
  id: string;
  tone: FeedbackTone;
  message: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Auto-dismiss after this many ms. Ignored when `sticky: true`. */
  durationMs: number;
  /** When true, toast won't auto-dismiss and can't be swiped away. */
  sticky: boolean;
  position: ToastPosition;
}

// ============== Modal ==============

/** Modal positions. 'center' is the canonical confirm modal; edges become sheets/drawers. */
export type ModalPosition = 'center' | 'top' | 'bottom' | 'left' | 'right';

interface ModalEntryBase {
  position: ModalPosition;
  closeOnOutsideClick: boolean;
  closeOnEscape: boolean;
  /** When true, no close-by-outside-click, no close-by-escape. Only confirm/cancel dismisses. */
  sticky: boolean;
  onCancel?: () => void;
  children?: ReactNode;
}

export interface StandardModalEntry extends ModalEntryBase {
  kind: 'standard' | 'danger';
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

export interface CriticalModalEntry extends ModalEntryBase {
  kind: 'critical';
  title: ReactNode;
  description?: ReactNode;
  confirmPhrase: string;
  confirmPrompt: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

export interface CustomModalEntry extends ModalEntryBase {
  kind: 'custom';
  /** Arbitrary JSX body. The service still provides scrim + close button. */
  body: ReactNode;
  /** Hide the X close button (e.g. when the body has its own dismiss UI). */
  hideCloseButton: boolean;
}

export type ModalEntry = StandardModalEntry | CriticalModalEntry | CustomModalEntry;

// ============== Banner ==============

export type BannerPosition = 'top' | 'bottom';

export interface BannerEntry {
  id: string;
  tone: FeedbackTone;
  title: ReactNode;
  description?: ReactNode;
  cta?: {
    label: string;
    onClick: () => void;
  };
  icon?: ReactNode;
  position: BannerPosition;
  /** When true, banner won't auto-dismiss. Banners default sticky; opt out by setting false + durationMs. */
  sticky: boolean;
  /** Auto-dismiss after this many ms. Ignored when `sticky: true`. */
  durationMs: number;
}

// ============== Store ==============

interface DrawerState {
  toasts: readonly ToastEntry[];
  banners: readonly BannerEntry[];
  modal: ModalEntry | null;
}

type Listener = () => void;

class DrawerStore {
  private state: DrawerState = { toasts: [], banners: [], modal: null };
  private listeners = new Set<Listener>();
  private nextId = 0;

  getState = (): DrawerState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private set(next: Partial<DrawerState>) {
    this.state = { ...this.state, ...next };
    this.emit();
  }

  // ----- Toasts -----
  pushToast = (entry: Omit<ToastEntry, 'id'>): string => {
    const id = `t-${this.nextId++}`;
    const toast: ToastEntry = { id, ...entry };
    this.set({ toasts: [...this.state.toasts, toast] });
    if (!entry.sticky && entry.durationMs > 0) {
      setTimeout(() => this.dismissToast(id), entry.durationMs);
    }
    return id;
  };

  dismissToast = (id: string): void => {
    this.set({ toasts: this.state.toasts.filter((t) => t.id !== id) });
  };

  // ----- Banners -----
  pushBanner = (entry: Omit<BannerEntry, 'id'>): string => {
    const id = `b-${this.nextId++}`;
    const banner: BannerEntry = { id, ...entry };
    this.set({ banners: [...this.state.banners, banner] });
    if (!entry.sticky && entry.durationMs > 0) {
      setTimeout(() => this.dismissBanner(id), entry.durationMs);
    }
    return id;
  };

  dismissBanner = (id: string): void => {
    this.set({ banners: this.state.banners.filter((b) => b.id !== id) });
  };

  // ----- Modal -----
  openModal = (entry: ModalEntry): void => {
    this.set({ modal: entry });
  };

  closeModal = (): void => {
    this.set({ modal: null });
  };
}

export const drawerStore = new DrawerStore();
