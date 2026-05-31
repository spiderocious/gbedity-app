import { now } from '@shared/time';

// Token-bucket per player (PRD §14 — guards Wordshot/Word Bomb ingestion bursts). Refills
// continuously; an action consumes a token. Exact rates tuned with load testing later.

const CAPACITY = 10; // burst allowance
const REFILL_PER_SEC = 5; // sustained actions/sec per player

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  // Returns true if the action is allowed (and consumes a token), false if rate-limited.
  allow(key: string): boolean {
    const current = now();
    const bucket = this.buckets.get(key) ?? { tokens: CAPACITY, lastRefill: current };
    const elapsedSec = (current - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsedSec * REFILL_PER_SEC);
    bucket.lastRefill = current;

    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket);
      return false;
    }
    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    return true;
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  // Evict buckets idle long enough to have fully refilled — they carry no state worth keeping.
  // A safety net for any bucket not cleared by disconnect; keeps the Map from growing unbounded.
  sweepStale(): void {
    const staleBefore = now() - (CAPACITY / REFILL_PER_SEC) * 1000;
    for (const [key, bucket] of this.buckets) {
      if (bucket.lastRefill < staleBefore) this.buckets.delete(key);
    }
  }
}
