import { useEffect, useRef } from 'react';

// Fire `callback` once, `ms` after mount. The callback is read from a ref so the timer is armed
// EXACTLY ONCE on mount and survives the parent re-rendering with a fresh callback identity — the
// flow component re-renders on every socket patch (~5/sec), so a [callback]-dep timer would be
// cleared+blocked on every patch and never fire (the "stuck on Get Ready" bug). Mount-only is the fix.
export function useTimeout(callback: () => void, ms: number): void {
  const cb = useRef(callback);
  cb.current = callback;
  useEffect(() => {
    const t = window.setTimeout(() => cb.current(), ms);
    return () => window.clearTimeout(t);
  }, [ms]);
}

// Run a side effect EXACTLY ONCE on mount (e.g. play a sound on entering a stage), regardless of
// the parent re-rendering with a fresh callback. Same ref pattern as useTimeout.
export function useOnMount(callback: () => void): void {
  const cb = useRef(callback);
  cb.current = callback;
  useEffect(() => {
    cb.current();
  }, []);
}
