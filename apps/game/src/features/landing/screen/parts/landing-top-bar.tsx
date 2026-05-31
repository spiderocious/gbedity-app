import { Logo } from '@gbedity/ui';
import { Link } from 'react-router-dom';

// A — top bar. Brand presence + a quiet how-it-works jump. (No /preview link — that
// gallery is dev-facing tooling, reached directly at /preview, not advertised to users.)
export function LandingTopBar() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
      <Link to="/" aria-label="Gbedity home" className="inline-flex">
        <Logo size="md" />
      </Link>
      <nav aria-label="Primary" className="flex items-center gap-5">
        <a
          href="#how-it-works"
          className="font-sans text-[13px] font-bold text-ink-3 hover:text-ink"
        >
          How it works
        </a>
      </nav>
    </header>
  );
}
