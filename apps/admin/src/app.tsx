import { Button } from '@gbedity/ui';
import { LayoutDashboard } from '@icons';

export function App() {
  return (
    <main className="mx-auto mt-16 flex max-w-2xl flex-col items-start gap-4 px-6">
      <h1 className="font-serif text-[40px] font-semibold leading-none tracking-[-0.02em] text-ink">
        Gbedity Admin
      </h1>
      <p className="text-ink-3">Operator surface for hosts, content, and league templates.</p>
      <Button leadingIcon={<LayoutDashboard size={18} />}>Get started</Button>
    </main>
  );
}
