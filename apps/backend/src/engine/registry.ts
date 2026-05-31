import type { GameId } from './constants';
import type { AnyGamePlugin } from './types';

// The plugin registry: every game registers its plugin here by GameId. The runtime/sessions look
// up a plugin by id. Real catalogue games (Block 3) self-register the same way the test games do.

const plugins = new Map<GameId, AnyGamePlugin>();

export const registerPlugin = (plugin: AnyGamePlugin): void => {
  plugins.set(plugin.manifest.id, plugin);
};

export const getPlugin = (id: GameId): AnyGamePlugin | undefined => plugins.get(id);

export const listPlugins = (): AnyGamePlugin[] => [...plugins.values()];
