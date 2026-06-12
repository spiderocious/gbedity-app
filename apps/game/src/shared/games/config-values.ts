// Live config values for the game currently being configured. The universal config controls write
// their value here (keyed by control id); buildStartConfig() reads them and maps to backend keys.
// Module-level + ref-counted by the configure screen (reset on game load) — there is only ever one
// configure screen open at a time, so a single shared bag is correct and avoids prop-drilling a
// setter through every control.

type ConfigValue = number | string | readonly string[] | boolean;

let values: Record<string, ConfigValue> = {};

export const configValues = {
  reset(): void {
    values = {};
  },
  // Seed a default when a control mounts (so unchanged controls still contribute their value).
  seed(id: string, value: ConfigValue): void {
    if (!(id in values)) values[id] = value;
  },
  set(id: string, value: ConfigValue): void {
    values[id] = value;
  },
  getAll(): Record<string, ConfigValue> {
    return { ...values };
  },
};
