import type { GameId } from './constants';
import type { AnyGamePlugin } from './types';

// The plugin registry: every game registers its plugin here by GameId. The runtime/sessions look
// up a plugin by id. Real catalogue games (Block 3) self-register the same way the test games do.

const plugins = new Map<GameId, AnyGamePlugin>();

export const registerPlugin = (plugin: AnyGamePlugin): void => {
  plugins.set(plugin.manifest.id, plugin);
};

// Accepts any string — an unknown/invalid id simply misses (returns undefined), so the caller
// can validate client-supplied ids without an unsafe cast to GameId.
export const getPlugin = (id: string): AnyGamePlugin | undefined => plugins.get(id as GameId);

export const listPlugins = (): AnyGamePlugin[] => [...plugins.values()];
