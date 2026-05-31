import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { Toast } from '../feedback/feedback.tsx';
import { cn } from '../utils/cn.ts';
import { DrawerService } from './drawer-service.ts';
import { drawerStore, type ToastEntry, type ToastPosition } from './drawer-store.ts';
import { SwipeableToast } from './swipeable-toast.tsx';

const POSITIONS: readonly ToastPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

const ZONE_CLASSES: Record<ToastPosition, string> = {
  'top-left': 'top-6 left-6 items-start',
  'top-center': 'top-6 left-1/2 -translate-x-1/2 items-center',
  'top-right': 'top-6 right-6 items-end',
  'bottom-left': 'bottom-6 left-6 items-start flex-col-reverse',
  'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2 items-center flex-col-reverse',
  'bottom-right': 'bottom-6 right-6 items-end flex-col-reverse',
};

/**
 * ToastHost — mounts once at the app root. Renders the active toast queue
 * grouped into six position zones via createPortal. Subscribes to drawerStore
 * via useSyncExternalStore.
 *
 * Each toast is wrapped in SwipeableToast, which lets users drag horizontally
 * to dismiss — except when `sticky: true`, in which case the toast can only
 * be dismissed programmatically via DrawerService.dismissToast(id).
 */
export function ToastHost() {
  const state = useSyncExternalStore(drawerStore.subscribe, drawerStore.getState);
  if (state.toasts.length === 0 || typeof document === 'undefined') return null;

  return createPortal(
    <>
      {POSITIONS.map((pos) => {
        const zoneToasts = state.toasts.filter((t) => t.position === pos);
        if (zoneToasts.length === 0) return null;
        return (
          <div
            key={pos}
            className={cn(
              'pointer-events-none fixed z-[60] flex max-w-[calc(100vw-3rem)] flex-col gap-3',
              ZONE_CLASSES[pos],
            )}
          >
            {zoneToasts.map((t) => (
              <ToastSlot key={t.id} toast={t} />
            ))}
          </div>
        );
      })}
    </>,
    document.body,
  );
}

interface ToastSlotProps {
  readonly toast: ToastEntry;
}

function ToastSlot({ toast }: ToastSlotProps) {
  const action = toast.action;
  return (
    <div className="pointer-events-auto">
      <SwipeableToast
        disabled={toast.sticky}
        onDismiss={() => DrawerService.dismissToast(toast.id)}
      >
        <Toast
          tone={toast.tone}
          {...(action !== undefined
            ? {
                action: {
                  label: action.label,
                  onClick: () => {
                    action.onClick();
                    DrawerService.dismissToast(toast.id);
                  },
                },
              }
            : {})}
        >
          {toast.message}
        </Toast>
      </SwipeableToast>
    </div>
  );
}
