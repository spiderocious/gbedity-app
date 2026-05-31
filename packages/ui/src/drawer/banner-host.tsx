import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { Banner } from '../feedback/feedback.tsx';
import { cn } from '../utils/cn.ts';
import { DrawerService } from './drawer-service.ts';
import { drawerStore, type BannerEntry, type BannerPosition } from './drawer-store.ts';

const POSITIONS: readonly BannerPosition[] = ['top', 'bottom'];

const ZONE_CLASSES: Record<BannerPosition, string> = {
  top: 'top-0 inset-x-0 flex-col',
  bottom: 'bottom-0 inset-x-0 flex-col-reverse',
};

/**
 * BannerHost — mounts once at the app root. Renders the active banner queue
 * grouped by position (top or bottom), full-width, stacking vertically when
 * multiple banners share the same position.
 *
 * Imperative banners default to `sticky: true` (per Banner's natural semantics
 * — persistent until acted on). Pass `sticky: false` + `durationMs` to opt in
 * to auto-dismiss.
 */
export function BannerHost() {
  const state = useSyncExternalStore(drawerStore.subscribe, drawerStore.getState);
  if (state.banners.length === 0 || typeof document === 'undefined') return null;

  return createPortal(
    <>
      {POSITIONS.map((pos) => {
        const zoneBanners = state.banners.filter((b) => b.position === pos);
        if (zoneBanners.length === 0) return null;
        return (
          <div
            key={pos}
            className={cn(
              'pointer-events-none fixed z-[55] flex gap-2 p-4',
              ZONE_CLASSES[pos],
            )}
          >
            {zoneBanners.map((b) => (
              <BannerSlot key={b.id} banner={b} />
            ))}
          </div>
        );
      })}
    </>,
    document.body,
  );
}

interface BannerSlotProps {
  readonly banner: BannerEntry;
}

function BannerSlot({ banner }: BannerSlotProps) {
  const cta = banner.cta;
  // When a banner isn't sticky, wrap its CTA so calling it also dismisses; otherwise
  // provide a built-in dismiss action so non-sticky banners still have a way to close
  // without one. Sticky banners with no CTA can only be dismissed programmatically.
  const effectiveCta =
    cta !== undefined
      ? {
          label: cta.label,
          onClick: () => {
            cta.onClick();
            DrawerService.dismissBanner(banner.id);
          },
        }
      : !banner.sticky
        ? {
            label: 'Dismiss',
            onClick: () => DrawerService.dismissBanner(banner.id),
          }
        : undefined;

  return (
    <div className="pointer-events-auto mx-auto w-full max-w-[1100px]">
      <Banner
        tone={banner.tone}
        title={banner.title}
        {...(banner.description !== undefined ? { description: banner.description } : {})}
        {...(effectiveCta !== undefined ? { cta: effectiveCta } : {})}
        {...(banner.icon !== undefined ? { icon: banner.icon } : {})}
      />
    </div>
  );
}
