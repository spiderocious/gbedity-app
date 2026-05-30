import { Button } from '@gbedity/ui';
import { Play } from '@icons';

export function App() {
  return (
    <main className="mx-auto mt-16 flex max-w-2xl flex-col items-start gap-4 px-6">
      <h1 className="text-2xl font-semibold text-ink">Gbedity</h1>
      <p className="text-ink-secondary">Template scaffold — nothing built yet.</p>
      <Button leadingIcon={<Play size={16} />} onClick={() => console.warn('game button clicked')}>
        Play
      </Button>
    </main>
  );
}
