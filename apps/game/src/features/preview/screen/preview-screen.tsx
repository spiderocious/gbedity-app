import { Suspense, useState } from 'react';

import { DEFAULT_PART_ID, findPart } from '../shared/registry.ts';
import { PreviewSidebar } from './parts/preview-sidebar.tsx';

export function PreviewScreen() {
  const [activeId, setActiveId] = useState(DEFAULT_PART_ID);

  const part = findPart(activeId);
  const ActivePart = part?.Component;

  return (
    <div className="grid h-screen grid-cols-[300px_1fr] overflow-hidden bg-canvas">
      <PreviewSidebar activeId={activeId} onSelect={setActiveId} />

      <main className="flex min-h-0 min-w-0 flex-col bg-canvas">
        <header className="flex flex-shrink-0 items-baseline gap-4 border-b border-ink-5 bg-canvas px-7 py-[18px]">
          <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
            @gbedity/ui
          </span>
          <span className="text-[11px] text-ink-4">·</span>
          <span className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink">
            {part?.label ?? activeId}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto px-16 pb-24 pt-12">
          <Suspense
            fallback={
              <div className="font-sans text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-3">
                Loading…
              </div>
            }
          >
            {ActivePart !== undefined ? (
              <ActivePart />
            ) : (
              <p className="text-ink-3">Coming soon.</p>
            )}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
