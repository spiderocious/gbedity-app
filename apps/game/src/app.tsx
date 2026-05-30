import { Button } from '@gbedity/ui';

export function App() {
  return (
    <main className="app">
      <h1>Gbedity</h1>
      <p>Template scaffold — nothing built yet.</p>
      <Button onClick={() => console.warn('game button clicked')}>Play</Button>
    </main>
  );
}
