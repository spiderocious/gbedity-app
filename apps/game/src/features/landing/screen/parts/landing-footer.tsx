import { Logo } from '@gbedity/ui';
import { Link } from 'react-router-dom';

import { ROUTES } from '../../../../shared/constants/routes.ts';

// G — footer. Honest "free to use", the English + Pidgin nod, made-in-Lagos. Plus a quiet
// dev link to the screen index (/preview-screens) — dev-facing, right-aligned.
export function LandingFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-6 pb-10 pt-6">
      <div className="flex flex-col items-center gap-3 border-t border-ink-5 pt-7 sm:flex-row sm:justify-between sm:gap-4">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="font-sans text-[13px] text-ink-3">
            Free to play · English &amp; Pidgin · Made in Lagos
          </span>
        </div>
        <Link
          to={ROUTES.PREVIEW_SCREENS}
          className="font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-ink-3 hover:text-ink"
        >
          All screens →
        </Link>
      </div>
    </footer>
  );
}
