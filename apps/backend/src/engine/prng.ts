import seedrandom from 'seedrandom';

// Seeded PRNG. The runtime hands each plugin a deterministic random() derived from the instance
// seed (game-engine.md §6) — plugins never call Math.random(), so replays/recovery reproduce.

export const makeRandom = (seed: string): (() => number) => seedrandom(seed);
