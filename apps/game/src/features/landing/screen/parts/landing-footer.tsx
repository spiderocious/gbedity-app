import { Logo } from '@gbedity/ui';

// G — footer. Honest "free to use", the English + Pidgin nod, made-in-Lagos.
// (No /preview link — that gallery is dev-facing tooling, not a user destination.)
export function LandingFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-6 pb-10 pt-6">
      <div className="flex flex-col items-center gap-3 border-t border-ink-5 pt-7 sm:flex-row sm:gap-4">
        <Logo size="sm" />
        <span className="font-sans text-[13px] text-ink-3">
          Free to play · English &amp; Pidgin · Made in Lagos
        </span>
      </div>
    </footer>
  );
}
