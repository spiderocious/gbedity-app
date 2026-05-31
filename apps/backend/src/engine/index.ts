import { registerPlugin } from './registry';
import { roundRobinTestGame } from './test-games/round-robin.plugin';
import { simultaneousTestGame } from './test-games/simultaneous.plugin';

// Engine bootstrap: register every available plugin. For this slice that's the two test games
// that close the contract (game-engine.md §8). Catalogue games (Block 3) register here too.
let bootstrapped = false;

export const bootstrapEngine = (): void => {
  if (bootstrapped) return;
  registerPlugin(simultaneousTestGame);
  registerPlugin(roundRobinTestGame);
  bootstrapped = true;
};

export { getPlugin, listPlugins } from './registry';
