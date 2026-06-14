import { useEffect, useState } from 'react';

// Tick `secondsLeft` from an absolute epoch-ms deadline. MP round timing is driven by the backend's
// shared `deadline` so all devices stay in lockstep — never a client clock. Returns 0 when expired
// or when deadline is null. Recomputes when the deadline changes (new question / phase).
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
  }, [deadline]);

  return secondsLeft;
}
