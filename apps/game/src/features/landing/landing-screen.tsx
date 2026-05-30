import { Button } from '@gbedity/ui';
import { Play } from '@icons';
import { Link } from 'react-router-dom';

export function LandingScreen() {
  return (
    <main className="mx-auto mt-16 flex max-w-2xl flex-col items-start gap-4 px-6">
      <h1 className="font-serif text-[40px] font-semibold leading-none tracking-[-0.02em] text-ink">
        Gbedity
      </h1>
      <p className="text-ink-3">
        A second-screen party game platform — phones as controllers, TV as the shared display.
      </p>
      <Button variant="celebrate" leadingIcon={<Play size={18} />}>
        Play
      </Button>
      <Link
        to="/preview"
        className="font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-action hover:text-action-deep"
      >
        Component preview →
      </Link>
    </main>
  );
}
