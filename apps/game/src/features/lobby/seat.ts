import type { SeatIndex } from '@gbedity/ui';

// Map a roster index (0-based) to a stable seat colour 1–8 (the 8 seat ramp; never duplicated
// within a room until it wraps). Real seat assignment is the backend's concern later; for now
// index order gives each joined player a consistent colour.
export function seatForIndex(index: number): SeatIndex {
  return (((index % 8) + 1) as SeatIndex);
}
