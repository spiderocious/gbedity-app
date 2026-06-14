import { configValues } from './config-values.ts';
import { getGameContent } from './game-content.tsx';
import { GameKey } from './games-manifest.ts';

// Client config richness — NOT a backend-existence gate. Every game the catalogue store returns is
// real and startable via its own `gameId` (the backend is the per-environment source of truth, so
// the frontend carries no hardcoded "real games" list). This only answers: does THIS client build a
// rich, bespoke configurator for the game yet? Most do; the rest fall back to the default config
// shell. (Replaces the old RealGameId / isRealGame / backendGameId guesswork.)

export function hasCustomConfig(key: GameKey): boolean {
  return getGameContent(key) !== undefined;
}

type UiValue = number | string | readonly string[] | boolean;
type UiValues = Record<string, UiValue>;
type BackendConfig = Record<string, unknown>;

const num = (v: UiValue | undefined): number | undefined => (typeof v === 'number' ? v : undefined);
const str = (v: UiValue | undefined): string | undefined => (typeof v === 'string' ? v : undefined);

// Common UI control ids → backend config keys, shared by most games.
// `count` → rounds, `time` → secondsPerRound. Per-game mappers extend/override below.
function common(u: UiValues): BackendConfig {
  const out: BackendConfig = {};
  const count = num(u.count);
  if (count !== undefined) out.rounds = count;
  const time = num(u.time);
  if (time !== undefined) out.secondsPerRound = time;
  return out;
}

// Parse a "5–8" / "Mixed" length-range pill into { minLen, maxLen }.
function lengthBand(v: UiValue | undefined): { minLen?: number; maxLen?: number } {
  const s = str(v);
  if (s === undefined || s === 'Mixed') return {};
  const m = /^(\d+)\D+(\d+)$/.exec(s); // handles the en-dash "5–8" and a plain hyphen
  if (!m) return {};
  return { minLen: Number(m[1]), maxLen: Number(m[2]) };
}

// Per-game mappers — translate the configurator's UI control ids into the backend config keys the
// plugin's configSchema accepts. A game with no entry sends the `common` subset (safe defaults).
const MAPPERS: Partial<Record<GameKey, (u: UiValues) => BackendConfig>> = {
  [GameKey.MISSING_LETTERS]: (u) => {
    const out: BackendConfig = { ...common(u), ...lengthBand(u.length) };
    const hidden = num(u.hidden);
    if (hidden !== undefined) out.hiddenCount = hidden; // 'hidden' control → backend hiddenCount
    return out;
  },
  // Investigation: 'duration' pills are MINUTES → backend investigateSeconds; 'caseKey' (empty ⇒
  // random) passes through so the host can start a chosen case.
  [GameKey.INVESTIGATION]: (u) => {
    const out: BackendConfig = {};
    const minutes = num(u.duration) ?? Number(str(u.duration));
    if (Number.isFinite(minutes) && minutes > 0) out.investigateSeconds = Math.round(minutes * 60);
    const caseKey = str(u.caseKey);
    if (caseKey !== undefined && caseKey !== '') out.caseKey = caseKey;
    return out;
  },
};

// Builds the config sent to POST /rooms/:code/start for the game currently being configured.
// Reads the live control values from the store and maps control ids → backend config keys. Unknown
// games fall back to the common subset; everything else relies on the backend's full defaults.
export function buildStartConfig(key?: GameKey): BackendConfig {
  const u = configValues.getAll();
  const mapper = key !== undefined ? MAPPERS[key] : undefined;
  return mapper ? mapper(u) : common(u);
}
