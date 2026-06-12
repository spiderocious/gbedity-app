import { useEffect, useRef, useState } from 'react';

// Counts down `from` → 0 (1s ticks), then calls onDone once. The wordmaster interstitial pattern,
// but as a hook. Used by the per-game flow to drive the "Get Ready 3·2·1" beat and the
// fixed-duration interstitials (intro / round-start / round-scores). Caller owns what shows per tick.
// onDone is kept in a ref so the tick effect depends only on `count` (no stale-closure churn).
export function useCountdown(from: number, onDone: () => void): number {
  const [count, setCount] = useState(from);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    setCount(from);
  }, [from]);

  useEffect(() => {
    if (count <= 0) {
      onDoneRef.current();
      return undefined;
    }
    const t = window.setTimeout(() => setCount((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [count]);

  return count;
}

