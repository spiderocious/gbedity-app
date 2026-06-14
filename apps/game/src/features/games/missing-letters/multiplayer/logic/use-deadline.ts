import { useEffect, useState } from 'react';

// Tick `secondsLeft` down from an absolute epoch-ms deadline. Multiplayer round timing is driven by
// the backend's shared `deadline`, NOT a client clock — so every device stays in lockstep. Returns 0
// when expired or when there's no deadline. Recomputes when the deadline changes (new round).
export function useDeadline(deadline: number | null): number {
  const compute = (): number => (deadline === null ? 0 : Math.max(0, (deadline - Date.now()) / 1000));
  const [secondsLeft, setSecondsLeft] = useState<number>(compute);

  useEffect(() => {
    if (deadline === null) {
      setSecondsLeft(0);
      return undefined;
    }
    setSecondsLeft(compute());
    const id = window.setInterval(() => {
      const left = Math.max(0, (deadline - Date.now()) / 1000);
      setSecondsLeft(left);
      if (left <= 0) window.clearInterval(id);
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  return secondsLeft;
}
